import os
import asyncio
import logging
import math
import dpath.util
import folium
from datetime import timedelta
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from FlightRadar24 import FlightRadar24API
from geopy.distance import geodesic
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]
ORIGIN_LATITUDE = 'airport/origin/position/latitude'
ORIGIN_LONGITUDE = 'airport/origin/position/longitude'
DESTINATION_LATITUDE = 'airport/destination/position/latitude'
DESTINATION_LONGITUDE = 'airport/destination/position/longitude'


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    async def async_visualise_fov_cone(service: ServiceCall) -> None:
        service_config = service.data.get("config")
        if not service_config:
            _LOGGER.error("Service call missing 'config' data")
            return

        temp_coordinator = WhatsThatPlaneCoordinator(hass, config=service_config)
        await temp_coordinator.async_generate_and_save_map()

    hass.services.async_register(DOMAIN, "visualise_fov_cone", async_visualise_fov_cone)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    if entry.data.get("visualise_fov_cone"):
        _LOGGER.info("Generating FOV map on first-time setup.")
        temp_coordinator = WhatsThatPlaneCoordinator(hass, entry=entry)
        await temp_coordinator.async_generate_and_save_map()
        new_data = {k: v for k, v in entry.data.items() if k != "visualise_fov_cone"}
        hass.config_entries.async_update_entry(entry, data=new_data)

    coordinator = WhatsThatPlaneCoordinator(hass, entry=entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(update_listener))
    return True


async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


class WhatsThatPlaneCoordinator(DataUpdateCoordinator):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry | None = None, config: dict | None = None):
        if entry:
            self.config_entry = entry
            self._config = {**entry.data, **entry.options}
        elif config:
            self.config_entry = None
            self._config = config
        else:
            raise ValueError("Coordinator must be initialized with either an entry or a config dict.")

        update_seconds = self._config.get("update_interval", 60)
        self.fr_api = FlightRadar24API()

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=update_seconds),
        )

    @property
    def config(self):
        return self._config

    def _calculate_bearing(self, your_latitude, your_longitude, flight_latitude, flight_longitude):
        delta_longitude = math.radians(flight_longitude - your_longitude)
        your_latitude = math.radians(your_latitude)
        flight_latitude = math.radians(flight_latitude)
        x = math.sin(delta_longitude) * math.cos(flight_latitude)
        y = math.cos(your_latitude) * math.sin(flight_latitude) - math.sin(your_latitude) * math.cos(flight_latitude) * math.cos(delta_longitude)
        initial_bearing = math.atan2(x, y)
        return (math.degrees(initial_bearing) + 360) % 360

    def _is_within_fov(self, bearing, direction, fov):
        if fov >= 360:
            return True
        half_fov = fov / 2
        lower_bound = (direction - half_fov) % 360
        upper_bound = (direction + half_fov) % 360
        return lower_bound <= bearing <= upper_bound if lower_bound < upper_bound else bearing >= lower_bound or bearing <= upper_bound

    async def async_generate_and_save_map(self):
        config = self.config
        your_latitude = config["latitude"]
        your_longitude = config["longitude"]
        facing_direction = config["facing_direction"]
        fov_cone = config["fov_cone"]
        radius_km = config["radius_km"]
        location_name = config.get("location_name", "default").strip()
        safe_filename = "".join(c for c in location_name if c.isalnum() or c in " _-").rstrip().lower().replace(" ", "_")

        folium_map = folium.Map(location=(your_latitude, your_longitude), zoom_start=12)
        folium.Marker([your_latitude, your_longitude], tooltip="Your Location", icon=folium.Icon(color='blue')).add_to(folium_map)

        def _destination_point(latitude, longitude, bearing, distance):
            earth_radius = 6371.0
            bearing_radian = math.radians(bearing)
            latitude1, longitude1 = map(math.radians, [latitude, longitude])
            latitude2 = math.asin(math.sin(latitude1) * math.cos(distance / earth_radius) + math.cos(latitude1) * math.sin(distance / earth_radius) * math.cos(bearing_radian))
            longitude2 = longitude1 + math.atan2(math.sin(bearing_radian) * math.sin(distance / earth_radius) * math.cos(latitude1), math.cos(distance / earth_radius) - math.sin(latitude1) * math.sin(latitude2))
            return math.degrees(latitude2), math.degrees(longitude2)

        if fov_cone >= 360:
            folium.Circle(
                location=(your_latitude, your_longitude),
                radius=radius_km * 1000,
                color='green',
                fill=True,
                fill_opacity=0.2,
                tooltip='Field of View'
            ).add_to(folium_map)
        else:
            arc_points = [(your_latitude, your_longitude)]
            for angle in range(int(-fov_cone / 2), int(fov_cone / 2) + 1):
                bearing = (facing_direction + angle) % 360
                arc_points.append(_destination_point(your_latitude, your_longitude, bearing, radius_km))
            arc_points.append((your_latitude, your_longitude))

            folium.Polygon(
                locations=arc_points,
                color='green', fill=True, fill_opacity=0.2, tooltip='Field of View'
            ).add_to(folium_map)


        directory_path = self.hass.config.path(f"www/community/{DOMAIN}")
        os.makedirs(directory_path, exist_ok=True)
        file_path = os.path.join(directory_path, f"visualise_fov_{safe_filename}.html")
        await self.hass.async_add_executor_job(folium_map.save, file_path)
        _LOGGER.info("Successfully generated FOV map at %s", file_path)

    async def _async_update_data(self):
        try:
            config = self.config
            your_latitude = config["latitude"]
            your_longitude = config["longitude"]
            radius_km = config["radius_km"] * 1000

            bounds = await self.hass.async_add_executor_job(
                self.fr_api.get_bounds_by_point, your_latitude, your_longitude, radius_km
            )
            all_flights = await self.hass.async_add_executor_job(
                self.fr_api.get_flights, None, bounds
            )

            visible_flights = []
            for flight in all_flights:
                if flight.latitude is None or flight.longitude is None:
                    continue

                flight_bearing = self._calculate_bearing(your_latitude, your_longitude, flight.latitude, flight.longitude)

                if self._is_within_fov(flight_bearing, config["facing_direction"], config["fov_cone"]):
                    flight_details = await self.hass.async_add_executor_job(self.fr_api.get_flight_details, flight)
                    
                    origin_position = (dpath.util.get(flight_details, ORIGIN_LATITUDE, default=None), dpath.util.get(flight_details, ORIGIN_LONGITUDE, default=None))
                    destination_position = (dpath.util.get(flight_details, DESTINATION_LATITUDE, default=None), dpath.util.get(flight_details, DESTINATION_LONGITUDE, default=None))
                    current_position = (flight.latitude, flight.longitude)

                    total_distance_km = 0
                    distance_traveled_km = 0
                    progress_percent = 0

                    if all(position is not None for position in origin_position) and all(position is not None for position in destination_position) and all(position is not None for position in current_position):
                        total_distance_km = round(geodesic(origin_position, destination_position).km)
                        distance_traveled_km = round(geodesic(origin_position, current_position).km)
                        if total_distance_km > 0:
                            progress_percent = min(round((distance_traveled_km / total_distance_km) * 100), 100)
                    
                    flight_details['total_distance_km'] = total_distance_km
                    flight_details['distance_traveled_km'] = distance_traveled_km
                    flight_details['progress_percent'] = progress_percent
                    
                    visible_flights.append(flight_details)
            return visible_flights
        except Exception as err:
            raise UpdateFailed(f"Error communicating with API: {err}")