import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from .const import DOMAIN

class WhatsThatPlaneConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            location_name = user_input.get("location_name", "").strip()
            title = "Visible Flights"
            if location_name:
                title = f"Visible Flights ({location_name})"
            return self.async_create_entry(title=title, data=user_input)

        default_latitude = self.hass.config.latitude
        default_longitude = self.hass.config.longitude

        data_schema = vol.Schema({
            vol.Optional("location_name"): str,
            vol.Required("latitude", default=default_latitude): vol.All(vol.Coerce(float), vol.Range(min=-90, max=90)),
            vol.Required("longitude", default=default_longitude): vol.All(vol.Coerce(float), vol.Range(min=-180, max=180)),
            vol.Required("radius_km", default=5): vol.Coerce(int),
            vol.Required("facing_direction", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=360)),
            vol.Required("fov_cone", default=90): vol.All(vol.Coerce(int), vol.Range(min=1, max=360)),
            vol.Required("update_interval", default=10): vol.All(vol.Coerce(int), vol.Range(min=1)),
            vol.Optional("visualise_fov_cone", default=False): bool,
        })
        return self.async_show_form(step_id="user", data_schema=data_schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return WhatsThatPlaneOptionsFlow()


class WhatsThatPlaneOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            visualise = user_input.pop("visualise_fov_cone", False)
            new_options = {**self.config_entry.options, **user_input}

            if visualise:
                service_config = {**self.config_entry.data, **new_options}
                await self.hass.services.async_call(
                    DOMAIN,
                    "visualise_fov_cone",
                    {"config": service_config},
                    blocking=True,
                )

            location_name = new_options.get("location_name", "").strip()
            title = "Visible Flights"
            if location_name:
                title = f"Visible Flights ({location_name})"
            
            self.hass.config_entries.async_update_entry(
                self.config_entry, title=title
            )
            return self.async_create_entry(title="", data=new_options)

        current_config = {**self.config_entry.data, **self.config_entry.options}
        options_schema = vol.Schema({
            vol.Optional("location_name", default=current_config.get("location_name", "")): str,
            vol.Required("latitude", default=current_config.get("latitude")): vol.All(vol.Coerce(float), vol.Range(min=-90, max=90)),
            vol.Required("longitude", default=current_config.get("longitude")): vol.All(vol.Coerce(float), vol.Range(min=-180, max=180)),
            vol.Required("radius_km", default=current_config.get("radius_km")): vol.Coerce(int),
            vol.Required("facing_direction", default=current_config.get("facing_direction")): vol.All(vol.Coerce(int), vol.Range(min=0, max=360)),
            vol.Required("fov_cone", default=current_config.get("fov_cone")): vol.All(vol.Coerce(int), vol.Range(min=1, max=360)),
            vol.Required("update_interval", default=current_config.get("update_interval")): vol.All(vol.Coerce(int), vol.Range(min=1)),
            vol.Optional("visualise_fov_cone", default=False): bool,
        })
        return self.async_show_form(step_id="init", data_schema=options_schema)