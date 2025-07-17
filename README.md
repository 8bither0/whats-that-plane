# What's that plane?!
A Home Assistant integration made for my partner who enjoys looking up flight information, specifically for planes that pass by her office window.

The unique part about this integration is that it will simulate a cone of vision in a specified direction and only report back flight information within the FOV. This cone of vision acts as the filter for returned flight information rather than an entire circle radius from the defined home position.

Once dialled in, you or your partner can also scream **"WHAT'S THAT PLANE?!"** every time a plane passes by and view a bunch of interesting stats while it's in line of sight. This can quickly become out of hand and you may start collecting sightings of planes' shiny custom livery variants.

The flight data is pulled using the unofficial SDK for FlightRadar24; [FlightRadarAPI](https://github.com/JeanExtreme002/FlightRadarAPI).

The exposed sensor information can be used to create interesting dashboard cards such as the example markdown card below:

![Example card](https://raw.githubusercontent.com/8bither0/whats-that-plane/main/example.jpg)

See [Adding visible flight information card to your dashboard](#Adding-visible-flight-information-card-to-your-dashboard) below for the template code to add this card to your own dashboard.

## Installation
### HACS via link (Recommended)
[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=8bither0&repository=whats-that-plane&category=integration)
1. Click the button above to open the integration in Home Assistant Community Store in Home Assistant.
2. Click `Add`.
3. Click the `Download` button in the bottom right corner.
4. Restart Home Assistant.
5. Now go to your Home Assistant settings and click on `Devices & services`.
6. Click the `Add Integration` button in the bottom right corner and search for `What's that plane?!`.
7. Select `What's that plane?!` and move onto the [Configuration](#Configuration) section.

### HACS via custom repositories
1. Go to the Home Assistant Community Store in Home Assistant.
2. Click on the kebab icon in the top right corner and choose `Custom repositories`.
3. In the `Repository` field, enter `https://github.com/8bither0/whats-that-plane` and select `Integration` as the `Type`.
4. Click `Add` then close `Custom repositories`.
5. If you now search HACS for `What's that plane?!` you should see the integration in the repository list. Click on the `What's that plane?!` integration.
6. Click the `Download` button in the bottom right corner.
7. Restart Home Assistant.
8. Now go to your Home Assistant settings and click on `Devices & services`.
9. Click the `Add Integration` button in the bottom right corner and search for `What's that plane?!`.
10. Select `What's that plane?!` and move onto the [Configuration](#Configuration) section.

### Manual
1. Clone this repository to your local machine.
2. Copy the `custom_components/whats_that_plane` directory to the `custom_components` directory in your Home Assistant file system.
3. Restart Home Assistant.
4. Now go to your Home Assistant settings and click on `Devices & services`.
5. Click the `Add Integration` button in the bottom right corner and search for `What's that plane?!`.
6. Select `What's that plane?!` and move onto the [Configuration](#Configuration) section.

## Configuration
To initially configure the integration, define the information below. This can be reconfigured via configuration entry options after initial setup:

| Option               | Required | Example value | Description |
| :------------------- | :------: | :-----------: | :---------- |
| `location_name`      | ❌       | `Home`        | A friendly name for your defined coordinates. This will be appended to the integration entry in the format `Visible Flights (Home)`. If empty, the integration entry will simply be called `Visible Flights`. This is useful when defining multiple entries. |
| `latitude`           | ✅       | `51.5285262`  | The latitude of your viewing location. This will default to the coordinates defined in your [homeassistant.local:8123/config/zone](http://homeassistant.local:8123/config/zone). |
| `longitude`          | ✅       | `-0.2663999`  | The longitude of your viewing location. This will default to the coordinates defined in your [homeassistant.local:8123/config/zone](http://homeassistant.local:8123/config/zone). |
| `radius_km`          | ✅       | `5`           | The radius distance boundary from your current location. e.g. `5` = 5km |
| `facing_direction`   | ✅       | `0`           | The degree bearing of the viewing direction. e.g. `0` = North, `90` = East, `180` = South, `270` = West. |
| `fov_cone`           | ✅       | `90`          | The number of degrees the field of view cone should be. |
| `update_interval`    | ✅       | `10`          | The number of seconds between each poll for flight information. |
| `visualise_fov_cone` | ❌       | ✅            | If checked, a HTML map which visualises your defined location and relative FOV cone will be generated. This is useful when first configuring an entry to ensure it matches your desired real life FOV. The HTML file is saved in the following location / format on your Home Assistant file system `config/www/community/whats_that_plane/visualise_fov_{location_name}.html`. If `location_name` is empty, the file is named `visualise_fov_default.html`. |

> **TIP**: To make the initial configuration process easier, you can use `visualise_fov_cone` and create a dashboard card to easily visualise your FOV cone settings.
>
> ![Example map](https://raw.githubusercontent.com/8bither0/whats-that-plane/main/example_map.jpg)
>
> Use the template below and replace [`default`] with your location name if you specified one during setup.
> ```
> type: iframe
> url: /local/community/whats_that_plane/visualise_fov_default.html
> aspect_ratio: 100%
> ```
> Once the dashboard card is set up, simply change your configuration settings then refer back to the dashboard card to view how your edits change the FOV cone **(you may need to hard refresh your browser page to force an update due to caching)**. Or you can download the HTML file directly from your Home Assistant file system.

After configuring the integration, a new sensor named `sensor.visible_flights` will be created. This will update at the frequency defined by the option `update_interval` and list flights visible within the defined field of view. The exposed sensor information can be used to create a variety of interesting dashboard cards. See [Adding visible flight information card to your dashboard](#Adding-visible-flight-information-card-to-your-dashboard) for more information.

## Adding visible flight information card to your dashboard
The template code required to achieve the card shown in the screenshot above can be found below. To create the card in dashboards that you have control over and are able to add cards to:
1. Click the pencil icon in the top right corner to `Edit dashboard`.
2. Click the `Add card` button in the bottom right corner.
3. Search for and click on the `Manual` card type.
4. Copy and paste the code below into the code text field.
5. Click `Save`.
6. Click `Done` in the top right corner.

> If you haven't changed the default name of the sensor, you should simply be able to copy and paste the code below and it should work with no changes required. Otherwise, please ensure that the sensor name on line 4 is correct (Default: `sensor.visible_flights`):

```
type: markdown
title: What's that plane?!
content: >-
  {% set flights = state_attr('sensor.visible_flights', 'flights') %}
  {% if flights and flights | count > 0 %}
  {% for flight in flights %}

  {% if flight.callsign == "Blocked" %} 🚫 [**{{ flight.callsign }}**]({{ flight.flightradar_link }})
  {% if flight.aircraft_model %}
  **{{ flight.aircraft_model }}** *({{ flight.aircraft_type }})* | **Registration:** {{ flight.aircraft_registration }}
  {% endif %}
  {%- set image = flight.large_aircraft_image_link or flight.medium_aircraft_image_link or flight.small_aircraft_image_link or flight.thumbnail_aircraft_image_link %}
  {% if image %}
    ![]({{ image }})
  {% endif %}

  {% elif flight.callsign %}
  ✈️ **{{ flight.airline_name }} [**{{ flight.callsign }}**]({{ flight.flightradar_link }}) (**{{ flight.origin_airport_code }} → {{ flight.destination_airport_code }}**)**


  {% if flight.total_distance_km and flight.total_distance_km > 0 %}
    {%- set bar_width = 20 -%}
    {%- set plane_pos = max(1, (bar_width * flight.progress_percent / 100) | round | int) -%}
    **{{ flight.origin_country_code_long or flight.origin_country_code }} {{ flight.origin_flag_emoji or flight.origin_airport_code }}** `{{ '─' * (plane_pos - 1) }}✈️{{ '─' * (bar_width - plane_pos) }}` **{{ flight.destination_flag_emoji or flight.destination_airport_code }} {{ flight.destination_country_code_long or flight.destination_country_code }}**
    📏 **Distance:** *{{ flight.distance_traveled_km }} of {{ flight.total_distance_km }} km ({{ flight.progress_percent }}%)*
    📈 **Altitude:** {{ flight.altitude_ft | default(0, true) | round(0) }} ft | **Speed:** {{ flight.ground_speed_kts | default(0, true) }} kts ({{ ((flight.ground_speed_kts | default(0, true)) * 1.15078) | round(0) }} mph)
    {% if flight.total_flight_time_formatted %} 🕑 **Total Flight Time:** {{ flight.total_flight_time_formatted }}
    {% endif %}
  {% endif %}

  {% if flight.origin_city or flight.origin_country or flight.destination_city or flight.destination_country or flight.origin_airport_name or flight.destination_airport_name %}
    🌍 {{ flight.origin_city }}, _**{{ flight.origin_country }}**_ → {{ flight.destination_city }}, _**{{ flight.destination_country }}**_
    🛂 {{ flight.origin_airport_name | replace('Airport', '') | trim }} → {{ flight.destination_airport_name | replace('Airport', '') | trim }}
  {% endif %}

  {% if flight.scheduled_departure_time_local %} {% set departure_delay = flight.departure_delay_mins if flight.departure_delay_mins is not none else flight.estimated_departure_delay_mins %}
  🛫 **Scheduled Departure:** {{ flight.scheduled_departure_time_local }}
  {% if departure_delay is not none %}
  {% if departure_delay > 0 %}
    - ⚠️ **Delayed: {{ departure_delay }} minutes**
  {% elif departure_delay < 0 %}
    - ✅ **Early: {{ departure_delay | abs }} minutes**
  {% endif %}
  {% endif %}
  {% if flight.real_departure_time_local %}
    - **Actual Departure:** {{ flight.real_departure_time_local }}
  {% elif flight.estimated_departure_time_local %}
    - **Estimated Departure:** {{ flight.estimated_departure_time_local }}
  {% endif %}
  {% endif %}

  {% if flight.scheduled_arrival_time_local %} {% set arrival_delay = flight.arrival_delay_mins if flight.arrival_delay_mins is not none else flight.estimated_arrival_delay_mins %}
  🛬 **Scheduled Arrival:** {{ flight.scheduled_arrival_time_local }}
  {% if arrival_delay is not none %}
  {% if arrival_delay > 0 %}
    - ⚠️ **Delayed: {{ arrival_delay }} minutes**
  {% elif arrival_delay < 0 %}
    - ✅ **Early: {{ arrival_delay | abs }} minutes**
  {% endif %} {% endif %} {% if flight.real_arrival_time_local %}
    - **Actual Arrival:** {{ flight.real_arrival_time_local }}
  {% elif flight.estimated_arrival_time_local %}
    - **Estimated Arrival:** {{ flight.estimated_arrival_time_local }}
  {% endif %} {% endif %}

  {% if flight.aircraft_model %}
    **{{ flight.aircraft_model }}** *({{ flight.aircraft_type }})* | **Registration:** {{ flight.aircraft_registration }} {% endif %}
  {%- set image = flight.large_aircraft_image_link or flight.medium_aircraft_image_link or flight.small_aircraft_image_link or flight.thumbnail_aircraft_image_link %}
  {% if image %}
    ![]({{ image }})
  {% endif %}

  ***
  
  {% endif %}
  {% endfor %}
  {% else %}
    No visible flights at the moment.
  {% endif %}
```

## Support
This was a fun little weekend project and I'm unlikely to actively support this. However, if you encounter any issues or have questions, please open an [issue](https://github.com/8bither0/whats-that-plane/issues) on GitHub and I will review if/when I'm able to.

## License
This project is licensed under the MIT License. See the [LICENSE](https://github.com/8bither0/whats-that-plane/blob/main/LICENSE) file for details.