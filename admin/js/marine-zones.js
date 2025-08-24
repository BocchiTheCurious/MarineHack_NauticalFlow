import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, showLoader, hideLoader } from './modules/utils.js';
import { loadLayout } from './modules/layout.js';

let map;
let eezLayer = null;
let territorialSeasLayer = null;
let windLayer = null;
let waveHeightLayer = null;


// Debug logging function
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp: timestamp,
        message: message,
        data: data
    };
    
    console.log(`[DEBUG] ${timestamp}: ${message}`, data);
    
    // Send to debug server
    fetch('/api/debug', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
    }).catch(err => {
        if (err.message && !err.message.includes('405')) {
            console.warn('Debug logging failed:', err);
        }
    });
}

/**
 * Main function to initialize the marine zones page.
 */
function initializeMarineZonesPage() {
    // Initialize the interactive map
    initializeMap();

    // Load marine zones data
    loadMarineZones();
}

/**
 * Initializes the Leaflet map.
 */
function initializeMap() {
    // Define Southeast Asia bounds
    const seaBounds = [
        [-12, 90],  // Southwest corner (lat, lng)
        [25, 135]   // Northeast corner (lat, lng)
    ];
    
    // Initialize map with Southeast Asia center - no restrictive bounds
    map = L.map('marine-zones-map', {
        center: [5, 110],  // Centered on Southeast Asia
        zoom: 4,
        dragging: true,                 // Enable dragging/panning
        touchZoom: true,                // Enable touch zoom
        scrollWheelZoom: true,          // Enable scroll wheel zoom
        doubleClickZoom: true,          // Enable double-click zoom
        boxZoom: false,                 // Disable box zoom
        keyboard: false,                // Disable keyboard navigation
        zoomControl: true               // Enable zoom controls
    }).setView([5, 110], 4);
    
    // Add OpenStreetMap tiles with restricted zoom levels
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: 3,                     // Minimum zoom level
        maxZoom: 8,                     // Maximum zoom level
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add custom bounds restriction
    restrictToSoutheastAsia(seaBounds);
    
    // Add legend for marine zones
    addMarineZonesLegend();
}

/**
 * Loads marine zones data (EEZ and Territorial Seas)
 */
async function loadMarineZones() {
    try {
        debugLog('Starting marine zones load');
        showAlert('Loading marine zones...', 'info');
        
        // Load EEZ and Territorial Seas using WMS
        await Promise.all([
            loadEEZBoundaries(),
            loadTerritorialSeas(),
            loadWindData(),
            loadWaveHeightData(),
        ]);
        
        debugLog('All map data loaded completed successfully');
        showAlert('All map data loaded successfully!', 'success');
        
    } catch (error) {
        debugLog('Error loading map data', { error: error.message });
        console.error('Error loading map data:', error);
        showAlert('Failed to load some map data', 'warning');
    }
}

/**
 * Loads EEZ boundaries (200 NM) using WMS
 */
async function loadEEZBoundaries() {
    try {
        debugLog('Starting EEZ boundaries load using WMS');
        
        // Use WMS endpoint for EEZ (200nm)
        const wmsUrl = "https://geo.vliz.be/geoserver/MarineRegions/wms";
        
        // Create WMS layer for EEZ boundaries
        const eezWMS = L.tileLayer.wms(wmsUrl, {
            layers: 'MarineRegions:eez',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            attribution: 'MarineRegions EEZ'
        });
        
        debugLog('Adding EEZ WMS layer to map');
        
        // Add the WMS layer to the map
        eezWMS.addTo(map);
        
        // Store reference to the layer
        eezLayer = eezWMS;
        
        debugLog('EEZ WMS layer added successfully');
        console.log('EEZ WMS layer loaded successfully');
        
    } catch (error) {
        debugLog('EEZ WMS loading failed', { error: error.message });
        console.error('Failed to load EEZ WMS:', error);
    }
}

/**
 * Loads Territorial Seas (12 NM) using WMS
 */
async function loadTerritorialSeas() {
    try {
        debugLog('Starting Territorial Seas load using WMS');
        
        // Use WMS endpoint for territorial seas (12nm)
        const wmsUrl = "https://geo.vliz.be/geoserver/MarineRegions/wms";
        const bbox = "90,-12,135,25"; // Southeast Asia bbox
        
        // Create WMS layer for territorial seas
        const territorialSeasWMS = L.tileLayer.wms(wmsUrl, {
            layers: 'MarineRegions:eez_12nm',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            attribution: 'MarineRegions Territorial Seas'
        });
        
        debugLog('Adding Territorial Seas WMS layer to map');
        
        // Add the WMS layer to the map
        territorialSeasWMS.addTo(map);
        
        // Store reference to the layer
        territorialSeasLayer = territorialSeasWMS;
        
        debugLog('Territorial Seas WMS layer added successfully');
        console.log('Territorial Seas WMS layer loaded successfully');
        
    } catch (error) {
        debugLog('Territorial Seas WMS loading failed', { error: error.message });
        console.error('Failed to load Territorial Seas WMS:', error);
    }
}

/**
 * Loads Wind data using a tile layer from OpenPortGuide
 */
async function loadWindData() {
    try {
        debugLog('Starting Wind data load');

        const windUrl = 'http://www.openportguide.org/tiles/actual/wind_stream/5/{z}/{x}/{y}.png';

        const windTileLayer = L.tileLayer(windUrl, {
            attribution: 'OpenPortGuide',
            transparent: true,
            opacity: 0.8
        });

        debugLog('Adding Wind tile layer to map');
        
        windTileLayer.addTo(map);
        windLayer = windTileLayer;
        
        debugLog('Wind tile layer added successfully');
        console.log('Wind tile layer loaded successfully');

    } catch (error) {
        debugLog('Wind data loading failed', { error: error.message });
        console.error('Failed to load wind data:', error);
    }
}

/**
 * Loads Wave Height data using a tile layer from OpenSeaMap.
 */
async function loadWaveHeightData() {
    try {
        debugLog('Starting Wave Height data load');

        const waveHeightUrl = 'http://www.openportguide.org/tiles/actual/significant_wave_height/5/{z}/{x}/{y}.png';

        const waveHeightTileLayer = L.tileLayer(waveHeightUrl, {
            attribution: 'OpenPortGuide',
            transparent: true,
            opacity: 0.7
        });

        debugLog('Adding Wave Height tile layer to map');
        
        waveHeightTileLayer.addTo(map);
        waveHeightLayer = waveHeightTileLayer;
        
        debugLog('Wave Height tile layer added successfully');
        console.log('Wave Height tile layer loaded successfully');

    } catch (error) {
        debugLog('Wave Height data loading failed', { error: error.message });
        console.error('Failed to load Wave Height data:', error);
    }
}

/**
 * Adds a legend for marine zones and weather data with interactive toggles.
 */
function addMarineZonesLegend() {
    const legend = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control legend');
            
            container.innerHTML = `
                <div style="background: rgba(255,255,255,0.9); padding: 10px; border-radius: 4px; font-size: 12px; min-width: 200px;">
                    <h6 style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Marine Zones & Weather</h6>
                    <div style="margin-bottom: 5px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: #42B7B7; margin-right: 8px;"></span>
                        <span>200 NM</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: #C2DADA; margin-right: 8px;"></span>
                        <span>Territorial Sea (12 NM)</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: #FFFF00; margin-right: 8px;"></span>
                        <span>Joint Region</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: #FF0000; margin-right: 8px;"></span>
                        <span>Overlapping Claims</span>
                    </div>
                    
                    <hr>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                         <input type="checkbox" id="wind-layer-toggle" checked style="margin-right: 8px;">
                        <label for="wind-layer-toggle">Wind</label>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="wave-height-layer-toggle" checked style="margin-right: 8px;">
                        <label for="wave-height-layer-toggle">Wave Height</label>
                    </div>
                </div>
            `;

            // Prevent map interactions when clicking on the legend
            container.onmousedown = container.ondblclick = container.onmousewheel = L.DomEvent.stopPropagation;

            // Add event listeners for the checkboxes
            const windToggle = container.querySelector('#wind-layer-toggle');
            const waveHeightToggle = container.querySelector('#wave-height-layer-toggle');

            windToggle.addEventListener('change', function() {
                if (this.checked) {
                    if (windLayer) map.addLayer(windLayer);
                } else {
                    if (windLayer) map.removeLayer(windLayer);
                }
            });

            waveHeightToggle.addEventListener('change', function() {
                if (this.checked) {
                    if (waveHeightLayer) map.addLayer(waveHeightLayer);
                } else {
                    if (waveHeightLayer) map.removeLayer(waveHeightLayer);
                }
            });

            return container;
        }
    });
    
    map.addControl(new legend());
}

/**
 * Restricts map movement to Southeast Asia bounds while allowing free movement within
 */
function restrictToSoutheastAsia(bounds) {
    // Add event listener for map movement
    map.on('moveend', function() {
        const currentBounds = map.getBounds();
        const southwest = currentBounds.getSouthWest();
        const northeast = currentBounds.getNorthEast();
        
        // Check if map has moved outside Southeast Asia bounds
        if (southwest.lng < bounds[0][1] || northeast.lng > bounds[1][1] ||
            southwest.lat < bounds[0][0] || northeast.lat > bounds[1][0]) {
            
            // Calculate new center to keep map within bounds
            let newLat = map.getCenter().lat;
            let newLng = map.getCenter().lng;
            
            // Restrict longitude
            if (newLng < bounds[0][1]) newLng = bounds[0][1] + 0.5;
            if (newLng > bounds[1][1]) newLng = bounds[1][1] - 0.5;
            
            // Restrict latitude
            if (newLat < bounds[0][0]) newLat = bounds[0][0] + 0.5;
            if (newLat > bounds[1][0]) newLat = bounds[1][0] - 0.5;
            
            // Smoothly pan back to valid position
            map.panTo([newLat, newLng], {
                animate: true,
                duration: 0.5
            });
        }
    });
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', async () => { 
    if (!checkAuth()) return;

    await loadLayout();

    // Initialize common UI components
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Initialize the marine zones page
    initializeMarineZonesPage();

    hideLoader();
});