import dpath.util
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from .const import DOMAIN, COUNTRY_CODE_MAP, TIMEZONE_ABBREVIATION_MAP

CALLSIGN = 'identification/callsign'
FLIGHT_ID = 'identification/id'
AIRLINE_NAME = 'airline/name'
AIRCRAFT_MODEL = 'aircraft/model/text'
AIRCRAFT_TYPE = 'aircraft/model/code'
AIRCRAFT_REGISTRATION = 'aircraft/registration'
LARGE_AIRCRAFT_IMAGE = 'aircraft/images/large/0/src'
MEDIUM_AIRCRAFT_IMAGE = 'aircraft/images/medium/0/src'
SMALL_AIRCRAFT_IMAGE = 'aircraft/images/small/0/src'
THUMBNAIL_AIRCRAFT_IMAGE = 'aircraft/images/thumbnails/0/src'

ALTITUDE = 'altitude'
GROUND_SPEED = 'ground_speed'
GROUND_SPEED_KTS = 'ground_speed_kts'
HEADING = 'heading'
LATITUDE = 'latitude'
LONGITUDE = 'longitude'

ORIGIN_CITY = 'airport/origin/position/region/city'
ORIGIN_COUNTRY = 'airport/origin/position/country/name'
ORIGIN_COUNTRY_CODE = 'airport/origin/position/country/code'
ORIGIN_COUNTRY_CODELONG = 'airport/origin/position/country/codeLong'
ORIGIN_AIRPORT_NAME = 'airport/origin/name'
ORIGIN_AIRPORT_CODE = 'airport/origin/code/iata'
ORIGIN_TIMEZONE_NAME = 'airport/origin/timezone/name'
ORIGIN_LATITUDE = 'airport/origin/position/latitude'
ORIGIN_LONGITUDE = 'airport/origin/position/longitude'

DESTINATION_CITY = 'airport/destination/position/region/city'
DESTINATION_COUNTRY = 'airport/destination/position/country/name'
DESTINATION_COUNTRY_CODE = 'airport/destination/position/country/code'
DESTINATION_COUNTRY_CODELONG = 'airport/destination/position/country/codeLong'
DESTINATION_AIRPORT_NAME = 'airport/destination/name'
DESTINATION_AIRPORT_CODE = 'airport/destination/code/iata'
DESTINATION_TIMEZONE_NAME = 'airport/destination/timezone/name'
DESTINATION_LATITUDE = 'airport/destination/position/latitude'
DESTINATION_LONGITUDE = 'airport/destination/position/longitude'

TIME_SCHEDULED_DEPARTURE = 'time/scheduled/departure'
TIME_ESTIMATED_DEPARTURE = 'time/estimated/departure'
TIME_REAL_DEPARTURE = 'time/real/departure'

TIME_SCHEDULED_ARRIVAL = 'time/scheduled/arrival'
TIME_ESTIMATED_ARRIVAL = 'time/estimated/arrival'
TIME_REAL_ARRIVAL = 'time/real/arrival'


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WhatsThatPlaneSensor(coordinator)])


class WhatsThatPlaneSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_name = "Visible Flights"
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_visible_flights"
        self._attr_icon = "mdi:airplane"
        self._attr_extra_state_attributes = {}
        self.update_sensor_data()

    def _code_to_flag_emoji(self, country_code):
        if not country_code or len(country_code) != 2:
            return None
        return "".join(chr(ord(char.upper()) - 65 + 127462) for char in country_code)

    def _format_time_local(self, timestamp, tz_name):
        if timestamp is None or not tz_name:
            return None
        try:
            utc_datetime = datetime.fromtimestamp(timestamp, tz=ZoneInfo("UTC"))
            local_datetime = utc_datetime.astimezone(ZoneInfo(tz_name))

            timezone_abbreviation = TIMEZONE_ABBREVIATION_MAP.get(tz_name, local_datetime.tzname())

            offset_seconds = local_datetime.utcoffset().total_seconds()
            offset_hours = offset_seconds / 3600
            offset_string = f"UTC{int(offset_hours):+}"

            if timezone_abbreviation and any(c.isalpha() for c in timezone_abbreviation):
                return f"{local_datetime.strftime('%-I:%M %p')} ({timezone_abbreviation} {offset_string})"
            else:
                return f"{local_datetime.strftime('%-I:%M %p')} ({offset_string})"

        except (ZoneInfoNotFoundError, ValueError):
            return datetime.fromtimestamp(timestamp).strftime('%-I:%M %p')

    def _format_duration(self, seconds):
        if seconds is None or seconds < 0:
            return None

        hours, remainder = divmod(seconds, 3600)
        minutes, _ = divmod(remainder, 60)

        if hours < 1:
            return f"{int(minutes)} minutes"
        else:
            return f"{int(hours)} hours {int(minutes)} minutes"

    def _format_flight_data(self, flight_info):
        flight = flight_info.get("data", {})
        if not flight:
            return None

        # Flight information
        callsign = dpath.util.get(flight, CALLSIGN, default=None) or flight.get('callsign')
        flight_id = dpath.util.get(flight, FLIGHT_ID, default=None)
        origin_country_code = dpath.util.get(flight, ORIGIN_COUNTRY_CODE, default=None)
        destination_country_code = dpath.util.get(flight, DESTINATION_COUNTRY_CODE, default=None)
        origin_2_letter_code = COUNTRY_CODE_MAP.get(origin_country_code, origin_country_code)
        destination_2_letter_code = COUNTRY_CODE_MAP.get(destination_country_code, destination_country_code)
        flightradar_link = None
        if flight_id:
            if callsign == "Blocked":
                flightradar_link = f"https://www.flightradar24.com/{flight_id}"
            elif callsign:
                flightradar_link = f"https://www.flightradar24.com/{callsign}/{flight_id}"

        # Flight time data
        scheduled_departure = dpath.util.get(flight, TIME_SCHEDULED_DEPARTURE, default=None)
        scheduled_arrival = dpath.util.get(flight, TIME_SCHEDULED_ARRIVAL, default=None)
        real_departure = dpath.util.get(flight, TIME_REAL_DEPARTURE, default=None)
        real_arrival = dpath.util.get(flight, TIME_REAL_ARRIVAL, default=None)
        estimated_departure = dpath.util.get(flight, TIME_ESTIMATED_DEPARTURE, default=None)
        estimated_arrival = dpath.util.get(flight, TIME_ESTIMATED_ARRIVAL, default=None)
        origin_timezone_name = dpath.util.get(flight, ORIGIN_TIMEZONE_NAME, default=None)
        destination_timezone_name = dpath.util.get(flight, DESTINATION_TIMEZONE_NAME, default=None)

        # Calculate delays
        departure_delay_mins = None
        if scheduled_departure and real_departure:
            departure_delay_mins = (real_departure - scheduled_departure) // 60

        estimated_departure_delay_mins = None
        if scheduled_departure and estimated_departure:
            estimated_departure_delay_mins = (estimated_departure - scheduled_departure) // 60

        arrival_delay_mins = None
        if scheduled_arrival and real_arrival:
            arrival_delay_mins = (real_arrival - scheduled_arrival) // 60

        estimated_arrival_delay_mins = None
        if scheduled_arrival and estimated_arrival:
            estimated_arrival_delay_mins = (estimated_arrival - scheduled_arrival) // 60

        # Calculate total flight time
        effective_departure = real_departure or estimated_departure or scheduled_departure
        effective_arrival = real_arrival or estimated_arrival or scheduled_arrival

        total_flight_time_formatted = None
        if effective_departure and effective_arrival:
            duration_seconds = effective_arrival - effective_departure
            total_flight_time_formatted = self._format_duration(duration_seconds)

        # Last seen time for historic flights
        last_seen_time_formatted = None
        last_seen_timestamp = flight_info.get("last_seen")
        if last_seen_timestamp:
            time_diff = datetime.now(timezone.utc) - datetime.fromtimestamp(last_seen_timestamp, tz=timezone.utc)

            days = time_diff.days
            hours, remainder = divmod(time_diff.seconds, 3600)
            minutes, _ = divmod(remainder, 60)

            if days > 0:
                last_seen_time_formatted = f"{days}d ago"
            elif hours > 0:
                last_seen_time_formatted = f"{hours}h ago"
            elif minutes > 0:
                last_seen_time_formatted = f"{minutes}m ago"
            else:
                last_seen_time_formatted = "Just now"

        return {
            "callsign": callsign,
            "flight_id": flight_id,
            "flightradar_link": flightradar_link,
            "airline_name": dpath.util.get(flight, AIRLINE_NAME, default=None),
            "aircraft_model": dpath.util.get(flight, AIRCRAFT_MODEL, default=None),
            "aircraft_type": dpath.util.get(flight, AIRCRAFT_TYPE, default=None),
            "aircraft_registration": dpath.util.get(flight, AIRCRAFT_REGISTRATION, default=None),
            "large_aircraft_image_link": dpath.util.get(flight, LARGE_AIRCRAFT_IMAGE, default=None),
            "medium_aircraft_image_link": dpath.util.get(flight, MEDIUM_AIRCRAFT_IMAGE, default=None),
            "small_aircraft_image_link": dpath.util.get(flight, SMALL_AIRCRAFT_IMAGE, default=None),
            "thumbnail_aircraft_image_link": dpath.util.get(flight, THUMBNAIL_AIRCRAFT_IMAGE, default=None),

            "latitude": flight.get(LATITUDE),
            "longitude": flight.get(LONGITUDE),
            "altitude": flight.get(ALTITUDE),
            "ground_speed": flight.get(GROUND_SPEED),
            "ground_speed_kts": flight.get(GROUND_SPEED_KTS),
            "heading": flight.get(HEADING),
            "total_distance": flight.get("total_distance"),
            "distance_traveled": flight.get("distance_traveled"),
            "progress_percent": flight.get("progress_percent"),
            "total_flight_time_formatted": total_flight_time_formatted,
            "trail": flight.get("trail", []),

            "origin_city": dpath.util.get(flight, ORIGIN_CITY, default=None),
            "origin_country": dpath.util.get(flight, ORIGIN_COUNTRY, default=None),
            "origin_country_code": origin_country_code,
            "origin_country_code_long": dpath.util.get(flight, ORIGIN_COUNTRY_CODELONG, default=None),
            "origin_flag_emoji": self._code_to_flag_emoji(origin_2_letter_code),
            "origin_airport_name": dpath.util.get(flight, ORIGIN_AIRPORT_NAME, default=None),
            "origin_airport_code": dpath.util.get(flight, ORIGIN_AIRPORT_CODE, default=None),
            "origin_latitude": dpath.util.get(flight, ORIGIN_LATITUDE, default=None),
            "origin_longitude": dpath.util.get(flight, ORIGIN_LONGITUDE, default=None),

            "destination_city": dpath.util.get(flight, DESTINATION_CITY, default=None),
            "destination_country": dpath.util.get(flight, DESTINATION_COUNTRY, default=None),
            "destination_country_code": destination_country_code,
            "destination_country_code_long": dpath.util.get(flight, DESTINATION_COUNTRY_CODELONG, default=None),
            "destination_flag_emoji": self._code_to_flag_emoji(destination_2_letter_code),
            "destination_airport_name": dpath.util.get(flight, DESTINATION_AIRPORT_NAME, default=None),
            "destination_airport_code": dpath.util.get(flight, DESTINATION_AIRPORT_CODE, default=None),
            "destination_latitude": dpath.util.get(flight, DESTINATION_LATITUDE, default=None),
            "destination_longitude": dpath.util.get(flight, DESTINATION_LONGITUDE, default=None),

            "scheduled_departure_time_local": self._format_time_local(scheduled_departure, origin_timezone_name),
            "estimated_departure_time_local": self._format_time_local(estimated_departure, origin_timezone_name),
            "real_departure_time_local": self._format_time_local(real_departure, origin_timezone_name),
            "estimated_departure_delay_mins": estimated_departure_delay_mins,
            "departure_delay_mins": departure_delay_mins,

            "scheduled_arrival_time_local": self._format_time_local(scheduled_arrival, destination_timezone_name),
            "estimated_arrival_time_local": self._format_time_local(estimated_arrival, destination_timezone_name),
            "real_arrival_time_local": self._format_time_local(real_arrival, destination_timezone_name),
            "estimated_arrival_delay_mins": estimated_arrival_delay_mins,
            "arrival_delay_mins": arrival_delay_mins,

            "last_seen_time_formatted": last_seen_time_formatted,
        }

    @property
    def native_value(self):
        return self._attr_native_value

    @property
    def extra_state_attributes(self):
        return self._attr_extra_state_attributes

    def _handle_coordinator_update(self) -> None:
        self.update_sensor_data()
        self.async_write_ha_state()

    def update_sensor_data(self):
        visible_flights = self.coordinator.data or []
        self._attr_native_value = len(visible_flights)

        flights_data = [self._format_flight_data(flight) for flight in visible_flights if flight]
        historic_flights = self.coordinator.historic_flights or []
        historic_flights_data = [self._format_flight_data(flight) for flight in historic_flights if flight]

        config = self.coordinator.config
        config_attributes = {
            "latitude": config.get("latitude"),
            "longitude": config.get("longitude"),
            "radius_km": config.get("radius_km"),
            "facing_direction": config.get("facing_direction"),
            "fov_cone": config.get("fov_cone"),
            "distance_units": config.get("distance_units", "metric"),
            "altitude_units": config.get("altitude_units", "imperial"),
            "speed_units": config.get("speed_units", "imperial"),
        }

        self._attr_extra_state_attributes = {
            "config": config_attributes,
            "flights": flights_data,
            "historic_flights": historic_flights_data,
        }