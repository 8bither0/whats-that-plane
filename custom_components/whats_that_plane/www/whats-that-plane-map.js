class WhatsThatPlaneMap extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._map = null;
    this._planeMarkers = {};
    this._planePaths = {};
    this._colorCache = {};
    this._airportMarkersLayer = null;
    this._selectedFlight = null;
    this._locationMarker = null;
    this._fovCone = null;
    this._updateTimer = null;
    this.goldenRatioConjugate = 0.61803398875;
    this.hue = Math.random();
    this._selectedFlightId = null;
    this._infoCardIsCollapsed = true;
    this.mapInitialized = false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        #map-container {
            position: relative;
            overflow: hidden;
            height: 500px;
            outline: 1px solid transparent;
        }
        #map {
          height: 100%;
          z-index: 0;
          visibility: hidden;
        }
        #loader {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: var(--primary-font-family, sans-serif);
          color: var(--primary-text-color);
          text-align: center;
        }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background-color: #fff;
          color: #000;
        }
        .leaflet-control-layers {
            background: #fff;
            border-radius: 4px;
            border: 2px solid rgba(0,0,0,0.2);
            max-height: 34px;
            width: 34px;
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .leaflet-control-layers-expanded {
            width: auto;
            height: auto;
            max-height: 150px;
            padding: 6px 10px;
            display: block;
        }
        a.leaflet-control-layers-toggle {
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .leaflet-control-zoom-in, .leaflet-control-zoom-out {
            display: flex;
            align-items: center;
            justify-content: center;
            text-indent: 0;
        }
        .leaflet-control-home a, .leaflet-control-info a {
            width: 26px;
            height: 26px;
            display: block;
        }
        #info-card {
            position: absolute;
            bottom: 10px;
            left: 10px;
            z-index: 1000;
            width: 300px;
            background-color: #fff;
            color: #000;
            padding: 12px;
            border: 2px solid rgba(0,0,0,0.2);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.3s ease-in-out;
            transform: translateY(calc(100% + 20px));
            font-family: var(--primary-font-family, sans-serif);
        }
        #info-card.visible {
            transform: translateY(0);
        }
        #info-card-header, .detail-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        #info-card-header {
            padding-bottom: 8px;
        }
        #info-card-header-text, .detail-row > span:first-child {
            flex-grow: 1;
        }
        #info-card-details {
            margin-top: 8px;
        }
        .zoom-icon {
            cursor: pointer;
            width: 20px;
            height: 20px;
            display: block;
            flex-shrink: 0;
        }
        .leaflet-control-info {
            background: #fff;
            border: 2px solid rgba(0,0,0,0.2);
            border-radius: 4px;
            background-clip: padding-box;
        }
        .lds-ring { display: inline-block; position: relative; width: 80px; height: 80px; }
        .lds-ring div { box-sizing: border-box; display: block; position: absolute; width: 64px; height: 64px; margin: 8px; border: 8px solid var(--primary-text-color); border-radius: 50%; animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite; border-color: var(--primary-text-color) transparent transparent transparent; }
        .lds-ring div:nth-child(1) { animation-delay: -0.45s; }
        .lds-ring div:nth-child(2) { animation-delay: -0.3s; }
        .lds-ring div:nth-child(3) { animation-delay: -0.15s; }
        @keyframes lds-ring { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
      <link rel="stylesheet" href="/local/community/whats_that_plane/leaflet.css"/>
      <div id="loader"><div class="lds-ring"><div></div><div></div><div></div><div></div></div><p>Loading Map...</p></div>
      <div id="map-container">
        <div id="map"></div>
        <div id="info-card">
          <div id="info-card-header">
            <div id="info-card-header-text">
              <b>
                <span class="zoom-icon" id="zoom-to-flight" title="Recenter on flight" style="display: inline-block; vertical-align: middle;">
                  <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8M3.05,13H1V11H3.05C3.5,6.83 6.83,3.5 11,3.05V1H13V3.05C17.17,3.5 20.5,6.83 20.95,11H23V13H20.95C20.5,17.17 17.17,20.5 13,20.95V23H11V20.95C6.83,20.5 3.5,17.17 3.05,13M12,5A7,7 0 0,0 5,12A7,7 0 0,0 12,19A7,7 0 0,0 19,12A7,7 0 0,0 12,5Z" /></svg>
                </span>
                <span id="info-card-airline"></span>
                <a id="info-card-flight-link" href="#" target="_blank" style="color: #4363d8;"></a>
                <span id="info-card-route"></span>
              </b>
            </div>
            <div id="info-card-header-actions">
              <span class="zoom-icon" id="zoom-to-route" title="Zoom to flight route">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L21.5,20L20,21.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" /></svg>
              </span>
            </div>
          </div>
          <hr style="margin: 0 0 8px 0; border: 0; border-top: 1px solid #eee;">
          <div id="info-card-details">
            <div class="detail-row">
              <span>
                <span id="info-card-origin-emoji"></span>
                <b>From:</b>
                <span id="info-card-origin-details"></span>
              </span>
              <span class="zoom-icon" id="zoom-to-origin" title="Zoom to origin">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L21.5,20L20,21.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" /></svg>
              </span>
            </div>
            <div class="detail-row">
              <span>
                <span id="info-card-dest-emoji"></span>
                <b>To:</b>
                <span id="info-card-dest-details"></span>
              </span>
              <span class="zoom-icon" id="zoom-to-destination" title="Zoom to destination">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L21.5,20L20,21.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" /></svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
      
    this.shadowRoot.getElementById('info-card').addEventListener('click', (e) => {
        if (!this._selectedFlight) return;
        const target = e.target.closest('.zoom-icon');
        if (!target) return;
        
        if (target.id === 'zoom-to-flight') {
            this._recenterOnFlight(this._selectedFlight);
        } else if (target.id === 'zoom-to-origin') {
            this._zoomToOrigin(this._selectedFlight);
        } else if (target.id === 'zoom-to-destination') {
            this._zoomToDestination(this._selectedFlight);
        } else if (target.id === 'zoom-to-route') {
            this._zoomToFlightRoute(this._selectedFlight);
        }
    });
  }

  connectedCallback() {
    this.initMap();
  }

  setConfig(config) {
      if (!config.entity) {
          this.renderError('You need to define an entity in the card configuration.');
          return;
      }
      this._config = config;
  }

  renderError(error) {
      this.shadowRoot.innerHTML = `<style>.error { color: var(--error-color, #db4437); background-color: #fff; padding: 16px; }</style><div class="error">${error}</div>`;
  }

  set hass(hass) {
      if (!hass || !this._map) return;
      this._hass = hass;

      if (!this.mapInitialized && this._hass.config) {
          this._map.setView([this._hass.config.latitude, this._hass.config.longitude], 11);
          this.mapInitialized = true;
      }

      if (this._updateTimer) {
        cancelAnimationFrame(this._updateTimer);
      }
      
      this._updateTimer = requestAnimationFrame(() => {
          this.updateMap();
      });
  }
  
  _updateAllElementsOpacity() {
    const isFlightSelected = !!this._selectedFlightId;
    const dimOpacity = 0.3;

    for (const flightId in this._planeMarkers) {
        const isSelected = flightId === this._selectedFlightId;
        const opacity = isFlightSelected ? (isSelected ? 1.0 : dimOpacity) : 1.0;
        
        if (this._planeMarkers[flightId]) {
            this._planeMarkers[flightId].setOpacity(opacity);
        }
        if (this._planePaths[flightId]) {
            this._planePaths[flightId].outline.setStyle({ opacity: opacity * 0.8 });
            this._planePaths[flightId].inline.setStyle({ opacity: opacity * 0.9 });
        }
    }

    if (this._locationMarker) {
        this._locationMarker.setOpacity(isFlightSelected ? dimOpacity : 1.0);
    }
  }


  _deselectFlight() {
    this._selectedFlightId = null;
    this._selectedFlight = null;
    this._setInfoCardCollapsed(true);
    if (this._infoControl) {
        this._map.removeControl(this._infoControl);
        this._infoControl = null;
    }
    if (this._airportMarkersLayer) {
        this._airportMarkersLayer.clearLayers();
    }
    this._updateAllElementsOpacity();
  }
    
  _showFlightInfo(flight) {
    if (!flight) return;
    const flightId = flight.flight_id || flight.callsign;
    
    this._selectedFlightId = flightId;
    this._selectedFlight = flight;
    this._updateInfoCardContent(flight);
    this._setInfoCardCollapsed(false);
    this._drawAirportMarkers(flight);
    this._updateAllElementsOpacity();
  }

  _drawAirportMarkers(flight) {
    if (!this._airportMarkersLayer) return;
    this._airportMarkersLayer.clearLayers();

    const airportIcon = (color) => L.divIcon({
        html: `<svg viewBox="0 0 24 24" width="32" height="32" style="color: ${color}; filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.7)); transform: translate3d(0, 0, 0);"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13S15.87 2 12 2zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 32]
    });
    
    if (flight.origin_latitude && flight.origin_longitude) {
        L.marker([flight.origin_latitude, flight.origin_longitude], { icon: airportIcon('#3CB44B') })
            .addTo(this._airportMarkersLayer)
            .bindPopup(`<b>Origin:</b><br>${flight.origin_airport_name || 'Unknown'}`);
    } else if (flight.trail && flight.trail.length > 0) {
        const firstPoint = flight.trail[flight.trail.length - 1];
        if (firstPoint.lat && firstPoint.lng) {
            L.marker([firstPoint.lat, firstPoint.lng], { icon: airportIcon('#3CB44B') })
                .addTo(this._airportMarkersLayer)
                .bindPopup(`<b>First Tracked Location</b>`);
        }
    }

    if (flight.destination_latitude && flight.destination_longitude) {
        L.marker([flight.destination_latitude, flight.destination_longitude], { icon: airportIcon('#4363D8') })
            .addTo(this._airportMarkersLayer)
            .bindPopup(`<b>Destination:</b><br>${flight.destination_airport_name || 'Unknown'}`);
    }
  }
    
  _updateInfoCardContent(flight) {
    if (!flight) return;

    const {
      callsign, flightradar_link, airline_name, origin_airport_code,
      destination_airport_code, origin_city, origin_country, origin_flag_emoji,
      destination_city, destination_country, destination_flag_emoji
    } = flight;

    this.shadowRoot.getElementById('info-card-airline').textContent = `${airline_name || 'None'} `;
    
    const flightLink = this.shadowRoot.getElementById('info-card-flight-link');
    if (flightradar_link) {
      flightLink.href = flightradar_link;
      flightLink.textContent = callsign || 'None';
      flightLink.style.display = 'inline';
    } else {
      flightLink.style.display = 'none';
    }

    this.shadowRoot.getElementById('info-card-route').textContent = ` (${origin_airport_code || 'None'} → ${destination_airport_code || 'None'})`;
    this.shadowRoot.getElementById('info-card-origin-emoji').textContent = origin_flag_emoji || '';
    this.shadowRoot.getElementById('info-card-origin-details').textContent = ` ${origin_city || 'None'}, ${origin_country || 'None'}`;
    this.shadowRoot.getElementById('info-card-dest-emoji').textContent = destination_flag_emoji || '';
    this.shadowRoot.getElementById('info-card-dest-details').textContent = ` ${destination_city || 'None'}, ${destination_country || 'None'}`;
  }
  
  _setInfoCardCollapsed(isCollapsed) {
    const infoCard = this.shadowRoot.getElementById('info-card');
    if (!infoCard || !this._map) return;
    
    this._infoCardIsCollapsed = isCollapsed;
    
    if (isCollapsed) {
        infoCard.classList.remove('visible');
        if (!this._infoControl && this._selectedFlightId) {
            const InfoControl = L.Control.extend({
                options: { position: 'bottomleft' },
                onAdd: (map) => {
                    const container = L.DomUtil.create('div', 'leaflet-control-info leaflet-bar');
                    const link = L.DomUtil.create('a', '', container);
                    link.href = '#';
                    link.title = 'Show Flight Info';
                    link.role = 'button';
                    link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="display: block; margin: auto; padding-top: 3px;"><path fill="#333" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
                    L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', () => this._setInfoCardCollapsed(false));
                    return container;
                }
            });
            this._infoControl = new InfoControl();
            this._map.addControl(this._infoControl);
        }
    } else {
        infoCard.classList.add('visible');
        if (this._infoControl) {
            this._map.removeControl(this._infoControl);
            this._infoControl = null;
        }
    }
  }

  async initMap() {
    if (this._map) return;

    const mapElement = this.shadowRoot.querySelector('#map');
    const loaderElement = this.shadowRoot.querySelector('#loader');
    if (!mapElement || !loaderElement) return;

    try {
        if (typeof L === 'undefined') {
            await this._loadScript('/local/community/whats_that_plane/leaflet.js');
        }

        if (L.DomUtil.setPosition) {
            const originalSetPosition = L.DomUtil.setPosition;
            L.DomUtil.setPosition = function (el, point) {
                originalSetPosition(el, point.floor());
            };
        }

        this._map = L.map(mapElement, { zoomControl: false });
        
        const HomeControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-control-home leaflet-bar');
                const link = L.DomUtil.create('a', '', container);
                link.href = '#';
                link.title = 'Recenter Map';
                link.role = 'button';
                link.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="display: block; margin: auto; padding-top: 4px;"><path fill="#333" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
                L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', () => {
                    this._hideAllPaths();
                    map.flyTo([this._initialLatitude, this._initialLongitude], this._initialZoom, { duration: 0.5 });
                    link.blur();
                });
                return container;
            }
        });
        this._map.addControl(new HomeControl());
        
        L.control.zoom({ position: 'topleft' }).addTo(this._map);

        this._map.on('click', () => this._deselectFlight());

        this._map.on('zoomstart', () => this._temporarilyHidePaths());
        this._map.on('zoomend moveend', () => {
            this._map.invalidateSize({ pan: false });
            this._updateAllElementsOpacity();
        });


        const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

        L.tileLayer(tileUrl, {
            attribution: attribution,
            maxZoom: 18,
        }).addTo(this._map);

        this._map.whenReady(() => {
            loaderElement.style.display = 'none';
            mapElement.style.visibility = 'visible';
            this._map.invalidateSize();
        });

        const savedLayers = JSON.parse(localStorage.getItem('whats-that-plane-layers')) || {};
        const getLayerState = (layerName, defaultState) => savedLayers[layerName] === undefined ? defaultState : savedLayers[layerName];

        this._locationLayer = L.layerGroup();
        this._visibleFlightsLayer = L.layerGroup();
        this._historicFlightsLayer = L.layerGroup();
        this._airportMarkersLayer = L.layerGroup();

        const overlayMaps = {
            "Visible Flights": this._visibleFlightsLayer,
            "Historic Flights": this._historicFlightsLayer,
            "My Location & FOV": this._locationLayer,
            "Flight Origin / Destination": this._airportMarkersLayer
        };

        for (const layerName in overlayMaps) {
            if (getLayerState(layerName, true)) {
                this._map.addLayer(overlayMaps[layerName]);
            }
        }
        
        const layersControl = L.control.layers(null, overlayMaps, { position: 'topright' }).addTo(this._map);
        
        const layersToggle = this.shadowRoot.querySelector('.leaflet-control-layers-toggle');
        if (layersToggle) {
            layersToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20"><path fill="#333" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5zM2 12l10 5 10-5-10-5-10 5z"/></svg>';
        }

        L.DomEvent.off(layersControl.getContainer(), 'mouseenter');
        L.DomEvent.off(layersControl.getContainer(), 'mouseleave');

        this._map.on('overlayadd', (e) => {
            this._saveLayerState(e.name, true);
            if (this._updateTimer) {
                cancelAnimationFrame(this._updateTimer);
            }
            this._updateTimer = requestAnimationFrame(() => {
                this.updateMap();
            });
        });
        this._map.on('overlayremove', (e) => this._saveLayerState(e.name, false));

        const resizeObserver = new ResizeObserver(() => {
            this._map.invalidateSize();
        });
        const mapContainer = this.shadowRoot.getElementById('map-container');
        resizeObserver.observe(mapContainer);

    } catch (error) {
        this.renderError('Could not load the map. Please check your internet connection.');
        console.error('Map Initialization Error:', error);
        if (loaderElement) loaderElement.style.display = 'none';
    }
  }

  _saveLayerState(layerName, isVisible) {
      const savedLayers = JSON.parse(localStorage.getItem('whats-that-plane-layers')) || {};
      savedLayers[layerName] = isVisible;
      localStorage.setItem('whats-that-plane-layers', JSON.stringify(savedLayers));
  }
  
  _hideAllPaths() {
    for (const flightId in this._planeMarkers) {
      if (this._planeMarkers.hasOwnProperty(flightId)) {
        if (this._planeMarkers[flightId]) {
          this._planeMarkers[flightId].setOpacity(0);
        }

        if (this._planePaths[flightId]) {
          this._planePaths[flightId].outline.setStyle({ opacity: 0 });
          this._planePaths[flightId].inline.setStyle({ opacity: 0 });
        }
      }
    }
  }

  _temporarilyHidePaths() {
    for (const flightId in this._planeMarkers) {
      if (this._planeMarkers.hasOwnProperty(flightId)) {
        if (this._selectedFlightId && flightId !== this._selectedFlightId) {
          continue;
        }
        
        if (this._planeMarkers[flightId]) {
          this._planeMarkers[flightId].setOpacity(0);
        }

        if (this._planePaths[flightId]) {
          this._planePaths[flightId].outline.setStyle({ opacity: 0 });
          this._planePaths[flightId].inline.setStyle({ opacity: 0 });
        }
      }
    }
  }

  updateMap() {
    if (!this._hass) return;
    const entityState = this._hass.states[this._config.entity];
    if (!entityState) {
        this.renderError(`Entity not found: ${this._config.entity}`);
        return;
    }

    this._state = entityState;

    if (!this.staticElementsDrawn) this.drawStaticElements();
    this.drawFlightElements();
  }

  drawStaticElements() {
    const config = this._state.attributes.config;
    if (!config) return;

    this.staticElementsDrawn = true;
    
    this._initialLatitude = config.latitude;
    this._initialLongitude = config.longitude;
    this._initialZoom = 11;

    this._map.setView([this._initialLatitude, this._initialLongitude], this._initialZoom);
    this._locationLayer.clearLayers();

    const locationIcon = L.divIcon({ html: `<svg viewbox="0 0 24 24" width="32" height="32" role="img" aria-hidden="true" style="color: #d32f2f; transform: translate3d(0, 0, 0);"><path fill="currentColor" d="M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22S19,14.25 19,9C19,5.13 15.87,2 12,2M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5Z" /></svg>`, className: '', iconSize: [32, 32], iconAnchor: [16, 32] });
    this._locationMarker = L.marker([config.latitude, config.longitude], { icon: locationIcon }).addTo(this._locationLayer).bindPopup("<b>My Location</b>");

    const fovPoints = this._calculateFovCone(config.latitude, config.longitude, config.facing_direction, config.fov_cone, config.radius_km);
    this._fovCone = L.polygon(fovPoints, { color: 'green', fillOpacity: 0.05, opacity: 0.3, interactive: false }).addTo(this._locationLayer);
  }

  drawFlightElements() {
    this._visibleFlightsLayer.clearLayers();
    this._historicFlightsLayer.clearLayers();
    this._planeMarkers = {};
    this._planePaths = {};

    let selectedFlightData = null;

    const processFlights = (flights, type) => {
        (flights || []).forEach(flight => {
            const id = flight.flight_id || flight.callsign;
            if (id === this._selectedFlightId) {
                selectedFlightData = flight;
            }
            this.drawFlight(flight, type);
        });
    };

    processFlights(this._state.attributes.flights, 'visible');
    processFlights(this._state.attributes.historic_flights, 'historic');
    
    const allFlights = (this._state.attributes.flights || []).concat(this._state.attributes.historic_flights || []);
    const allFlightIds = new Set(allFlights.map(f => f.flight_id || f.callsign));

    if (this._selectedFlightId && !allFlightIds.has(this._selectedFlightId)) {
        this._deselectFlight();
    } else {
        this._updateAllElementsOpacity();
    }
    
    if (selectedFlightData) {
        this._updateInfoCardContent(selectedFlightData);
    }
  }


  _hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  _rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  _generateNextColor() {
    this.hue += this.goldenRatioConjugate;
    this.hue %= 1;
    const [r, g, b] = this._hslToRgb(this.hue, 0.8, 0.5);
    return this._rgbToHex(r, g, b);
  }

  _getFlightColor(flightId) {
    if (!this._colorCache[flightId]) {
      this._colorCache[flightId] = this._generateNextColor();
    }
    return this._colorCache[flightId];
  }

  _zoomToFlightRoute(flight) {
    if (!flight || !this._map) return;
    this._temporarilyHidePaths();

    const boundsPoints = [];
    if (flight.latitude && flight.longitude) boundsPoints.push([flight.latitude, flight.longitude]);
    if (flight.origin_latitude && flight.origin_longitude) {
      boundsPoints.push([flight.origin_latitude, flight.origin_longitude]);
    } else if (flight.trail && flight.trail.length > 0) {
      const oldestPoint = flight.trail[flight.trail.length - 1];
      if (oldestPoint && oldestPoint.lat && oldestPoint.lng) boundsPoints.push([oldestPoint.lat, oldestPoint.lng]);
    }

    if (flight.trail && flight.trail.length > 0) {
      flight.trail.forEach(p => { if (p.lat && p.lng) boundsPoints.push([p.lat, p.lng]); });
    }
    
    if (boundsPoints.length > 1) {
      this._map.flyToBounds(boundsPoints, { padding: [50, 50], maxZoom: 13, duration: 0.5 });
    } else if (boundsPoints.length === 1) {
      this._map.flyTo(boundsPoints[0], 10, { duration: 0.5 });
    }
  }
  
  _recenterOnFlight(flight) {
    if (!flight || !this._map) return;
    this._temporarilyHidePaths();
    if (flight.latitude && flight.longitude) {
        this._map.flyTo([flight.latitude, flight.longitude], 10, { duration: 0.5 });
    }
  }

  _zoomToOrigin(flight) {
    if (!flight || !this._map) return;
    this._temporarilyHidePaths();
    if (flight.origin_latitude && flight.origin_longitude) {
        this._map.flyTo([flight.origin_latitude, flight.origin_longitude], 12, { duration: 0.5 });
    } else if (flight.trail && flight.trail.length > 0) {
        const firstPoint = flight.trail[flight.trail.length - 1];
        if (firstPoint.lat && firstPoint.lng) {
            this._map.flyTo([firstPoint.lat, firstPoint.lng], 12, { duration: 0.5 });
        }
    }
  }

  _zoomToDestination(flight) {
    if (!flight || !this._map) return;
    this._temporarilyHidePaths();
    if (flight.destination_latitude && flight.destination_longitude) {
        this._map.flyTo([flight.destination_latitude, flight.destination_longitude], 12, { duration: 0.5 });
    }
  }

  drawFlight(flight, type) {
      if (!flight.latitude || !flight.longitude) return;

      const flightId = flight.flight_id || flight.callsign;
      const layer = (type === 'visible') ? this._visibleFlightsLayer : this._historicFlightsLayer;
      const uniqueColor = this._getFlightColor(flightId);
      
      const clickHandler = (e) => {
          L.DomEvent.stopPropagation(e);
          this._showFlightInfo(flight);
          this._zoomToFlightRoute(flight);
      }
      
      const highlight = () => {
        if (this._planeMarkers[flightId]) this._planeMarkers[flightId].setOpacity(1.0);
        if (this._planePaths[flightId]) {
            this._planePaths[flightId].inline.setStyle({ weight: 4, opacity: 1 });
            this._planePaths[flightId].outline.setStyle({ weight: 6, opacity: 1 });
        }
      };
      
      const reset = () => {
        if (!this._planeMarkers[flightId]) return;

        if (this._selectedFlightId && flightId !== this._selectedFlightId) {
            const dimOpacity = 0.3;
            this._planeMarkers[flightId].setOpacity(dimOpacity);
            if (this._planePaths[flightId]) {
              this._planePaths[flightId].inline.setStyle({ weight: 2, opacity: dimOpacity });
              this._planePaths[flightId].outline.setStyle({ weight: 4, opacity: dimOpacity * 0.8 });
            }
        } else {
            this._planeMarkers[flightId].setOpacity(1.0);
            if (this._planePaths[flightId]) {
              this._planePaths[flightId].inline.setStyle({ weight: 2, opacity: 0.9 });
              this._planePaths[flightId].outline.setStyle({ weight: 4, opacity: 0.8 });
            }
        }
      };

      if (flight.trail && flight.trail.length > 0) {
        const trailPoints = flight.trail.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
        const currentPosition = [flight.latitude, flight.longitude];
        trailPoints.unshift(currentPosition);
        
        const outline = L.polyline(trailPoints, { color: '#FFFFFF', weight: 4, opacity: 0.8 });
        const inline = L.polyline(trailPoints, { color: uniqueColor, weight: 2, opacity: 0.9 });
        outline.addTo(layer); 
        inline.addTo(layer);
        this._planePaths[flightId] = { outline, inline };
        
        [outline, inline].forEach(p => { 
            p.on('mouseover', highlight); 
            p.on('mouseout', reset); 
            p.on('click', clickHandler);
        });
    }

      const planeIcon = L.divIcon({ html: `<div style="transform: rotate(${flight.heading || 0}deg); filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.7));"><svg viewbox="0 0 24 24" width="30" height="30" role="img" aria-hidden="true" style="color: ${uniqueColor};"><path fill="currentColor" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg></div>`, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });

      const marker = L.marker([flight.latitude, flight.longitude], { icon: planeIcon });
      marker.addTo(layer);
      marker.on('mouseover', highlight);
      marker.on('mouseout', reset);
      marker.on('click', clickHandler);
      this._planeMarkers[flightId] = marker;
  }

  _calculateFovCone(lat, lon, dir, fov, rad) {
    const toRad = (d) => d * Math.PI / 180;
    const toDeg = (r) => r * 180 / Math.PI;
    const earthRad = 6371;
    const p = [[lat, lon]];
    for (let i = -fov / 2; i <= fov / 2; i++) {
      const b = toRad((dir + i + 360) % 360);
      const lat1 = toRad(lat);
      const lon1 = toRad(lon);
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(rad / earthRad) + Math.cos(lat1) * Math.sin(rad / earthRad) * Math.cos(b));
      const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(rad / earthRad) * Math.cos(lat1), Math.cos(rad / earthRad) - Math.sin(lat1) * Math.sin(lat2));
      p.push([toDeg(lat2), toDeg(lon2)]);
    }
    p.push([lat, lon]);
    return p;
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  getCardSize() { return 6; }
}

customElements.define('whats-that-plane-map', WhatsThatPlaneMap);