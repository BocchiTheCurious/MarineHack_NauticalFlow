import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, formatDate } from './modules/utils.js';
import { getSavedOptimizations, deleteOptimizationResult, getPorts, getCruiseShips, runOptimization, saveOptimizationResult } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

// --- MODULE-LEVEL VARIABLES ---
let map;
let optimizedRouteLayer = null; // To hold the map layer for the optimized route path
let portMarkersLayer = null;    // To hold the markers for the ports
let eezLayer = null; // To hold the EEZ boundary layer
let territorialSeasLayer = null; // To hold the Territorial Seas layer
let windLayer = null; // To hold the wind data layer
let waveHeightLayer = null; // To hold the wave height data layer
let cycloneLayer = null; // To hold the cyclone data layer
let lastOptimizationResult = null; // To store the latest results for export

// The main route object to store departure and arrival ports
const route = {
    departure: null,
    arrivals: []
};

// --- INITIALIZATION ---
/**
 * Main function that runs when the DOM is fully loaded.
 * It checks authentication, loads the layout, and initializes all page components.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Redirect to login if user is not authenticated
    if (!checkAuth()) return;

    // Load common layout elements
    await loadLayout();

    // Setup event listeners
    setupPortSelectionListeners();
    document.getElementById('run-optimization').addEventListener('click', handleRunOptimization);
    document.getElementById('export-pdf').addEventListener('click', exportResultsToPDF);
    document.getElementById('export-csv').addEventListener('click', exportResultsToCSV);

    // Initialize standard UI components
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Initialize page-specific components
    initializeMap();
    initializeSavedResults();
    populatePortDropdown('departure-port');
    populatePortDropdown('add-destination-port');
    populateVesselDropdown();
});

// --- PORT SELECTION LOGIC ---
/**
 * Sets up event listeners for the departure and destination port dropdowns and the "Add Port" button.
 */
function setupPortSelectionListeners() {
    const departureSelect = document.getElementById("departure-port");
    const destinationSelect = document.getElementById("add-destination-port");
    const addButton = document.getElementById("add-port-btn");
    const portsContainer = document.getElementById('destination-ports-container');

    // Handle departure port selection
    departureSelect.addEventListener('change', () => {
        const selectedOption = departureSelect.options[departureSelect.selectedIndex];
        if (selectedOption && !selectedOption.disabled) {
            route.departure = {
                name: selectedOption.value,
                latitude: parseFloat(selectedOption.dataset.latitude),
                longitude: parseFloat(selectedOption.dataset.longitude)
            };
            console.log("Departure Port set:", route.departure);
            departureSelect.disabled = true; // Disable dropdown after selection
            renderRouteBadges(); // Update the UI to show the selected port
        }
    });

    // Handle adding a new destination port
    addButton.addEventListener('click', () => {
        if (!route.departure) {
            toastr.warning("Please select a departure port first!", "Input Missing");
            return;
        }
        const selectedOption = destinationSelect.options[destinationSelect.selectedIndex];
        if (selectedOption && !selectedOption.disabled) {
            const newPort = {
                name: selectedOption.value,
                latitude: parseFloat(selectedOption.dataset.latitude),
                longitude: parseFloat(selectedOption.dataset.longitude)
            };
            // Prevent adding a duplicate port
            const isDuplicate = route.departure.name === newPort.name || route.arrivals.some(p => p.name === newPort.name);
            if (isDuplicate) {
                toastr.info(`'${newPort.name}' is already in the route.`, "Duplicate Port");
                return;
            }
            route.arrivals.push(newPort);
            console.log("Arrival Ports:", route.arrivals);
            renderRouteBadges(); // Update the UI
        }
    });

    // Use event delegation to handle removing any port badge
    portsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.btn-close');
        if (!target) return;
        
        // Check if it's the departure port remove button
        if (target.dataset.action === 'remove-departure') {
            // Reset the entire route
            route.departure = null;
            route.arrivals = [];
            // Re-enable and reset the departure dropdown
            departureSelect.disabled = false;
            departureSelect.selectedIndex = 0;
            // Clear any existing route from the map
            if (optimizedRouteLayer) map.removeLayer(optimizedRouteLayer);
            if (portMarkersLayer) map.removeLayer(portMarkersLayer);
            optimizedRouteLayer = null;
            portMarkersLayer = null;
            // Re-render the badges to show the cleared state
            renderRouteBadges();
            toastr.info("Route has been cleared. Please select a new departure port.", "Route Cleared");
        }
        // Check if it's an arrival port remove button
        else if (target.dataset.index) {
            const portIndexToRemove = parseInt(target.dataset.index, 10);
            route.arrivals.splice(portIndexToRemove, 1); // Remove the port from the array
            renderRouteBadges(); // Re-render the badges
        }
    });
}

/**
 * Renders the selected departure and arrival ports as dismissible badges in the UI.
 */
function renderRouteBadges() {
    const container = document.getElementById('destination-ports-container');
    container.innerHTML = ''; // Clear existing content

    // Create a badge for the departure port
    if (route.departure) {
        const departureBadge = document.createElement('span');
        departureBadge.className = 'port-badge bg-primary';
        departureBadge.innerHTML = `
            <i class="bi bi-anchor me-2"></i>
            ${route.departure.name} (Start)
            <button type="button" class="btn-close btn-close-white" aria-label="Remove" data-action="remove-departure"></button>
        `;
        container.appendChild(departureBadge);
    }

    // Create badges for all arrival ports
    route.arrivals.forEach((port, index) => {
        const portBadge = document.createElement('span');
        portBadge.className = 'port-badge';
        portBadge.innerHTML = `
            ${port.name}
            <button type="button" class="btn-close btn-close-white" aria-label="Remove" data-index="${index}"></button>
        `;
        container.appendChild(portBadge);
    });

    // Display a placeholder message if no destinations are added
    if (route.arrivals.length === 0 && !route.departure) {
        const placeholder = document.createElement('span');
        placeholder.className = 'text-muted fst-italic';
        placeholder.textContent = 'No destinations added yet.';
        container.appendChild(placeholder);
    } else if (route.departure && route.arrivals.length === 0) {
        const placeholder = document.createElement('span');
        placeholder.className = 'text-muted fst-italic ms-2';
        placeholder.textContent = 'Add a destination...';
        container.appendChild(placeholder);
    }
}

// --- OPTIMIZATION LOGIC ---
/**
 * Handles the "Run Optimization" button click. 
 * It validates the selected route, sends it to the backend for optimization,
 * and then displays the results on the map and in the comparison table.
 */
async function handleRunOptimization() {
    // 1. Get UI elements and current selections
    const runBtn = document.getElementById('run-optimization');
    const originalBtnText = runBtn.innerHTML;
    const selectedShipId = document.getElementById('vessel-name').value;

    // 2. Updated validation logic with specific Toastr alerts
    if (!route.departure || !selectedShipId || route.arrivals.length < 2) {
        let errorMessage = "Please ensure you have selected the following:<ul>";
        if (!route.departure) errorMessage += "<li>A departure port</li>";
        if (!selectedShipId) errorMessage += "<li>A vessel</li>";
        if (route.arrivals.length < 2) errorMessage += "<li>At least 2 destination ports</li>";
        errorMessage += "</ul>For best results, a route with 3 or more total ports is recommended.";
        toastr.warning(errorMessage, "Insufficient Data for Optimization", { timeOut: 8000 });
        return;
    }

    // 3. Update UI to show a loading state
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Optimizing...';

    // 4. Prepare the data for the API
    const originalRoutePorts = [route.departure, ...route.arrivals];
    const coordinates = originalRoutePorts.map(port => [port.latitude, port.longitude]);

    try {
        // 5. Call the API.
        const result = await runOptimization(coordinates, selectedShipId);
        toastr.success('Optimization complete!', 'Success');

        // 6. Process the result
        const standardMetrics = result.standard_metrics;
        const optimizedMetrics = result.optimized_metrics;
        const orderedPorts = [route.departure, ...result.best_route_indices.map(index => route.arrivals[index - 1])];
        
        // 7. Update UI with results
        updateComparisonTable(standardMetrics, optimizedMetrics, originalRoutePorts, orderedPorts);
        drawOptimizedRoute(orderedPorts, result.route_geometry);
        lastOptimizationResult = { standardMetrics, optimizedMetrics, standardRoutePorts: originalRoutePorts, optimizedRoutePorts: orderedPorts };
        
        const vesselSelect = document.getElementById('vessel-name');
        const vesselName = vesselSelect.options[vesselSelect.selectedIndex].text;
        const resultToSave = {
            route: originalRoutePorts.map(p => p.name).join(' → '),
            vessel: vesselName,
            fuelSaved: `${(standardMetrics.fuel_liters - optimizedMetrics.fuel_liters).toFixed(1)} L`,
            co2Reduced: `${(standardMetrics.co2_kg - optimizedMetrics.co2_kg).toFixed(1)} kg`,
            timeSaved: `${(standardMetrics.travel_time_hours - optimizedMetrics.travel_time_hours).toFixed(1)} hrs`
        };

        // 8. Save result and refresh saved results table
        await saveOptimizationResult(resultToSave);
        toastr.info('Optimization result has been saved.', 'Result Saved');
        await initializeSavedResults();

    } catch (error) {
        console.error("Optimization failed:", error);
        toastr.error(`Optimization failed: ${error.message}`, 'API Error');
    } finally {
        // 9. Always restore the button to its original state
        runBtn.disabled = false;
        runBtn.innerHTML = originalBtnText;
    }
}

// --- UI and MAP UPDATE FUNCTIONS ---
/**
 * Populates the comparison table with standard vs. optimized route metrics.
 * @param {object} standardMetrics - The calculated metrics for the original route.
 * @param {object} optimizedMetrics - The calculated metrics for the optimized route.
 * @param {Array<object>} standardRoutePorts - The original sequence of ports.
 * @param {Array<object>} optimizedRoutePorts - The optimized sequence of ports.
 */
function updateComparisonTable(standardMetrics, optimizedMetrics, standardRoutePorts, optimizedRoutePorts) {
    const formatImprovement = (standard, optimized) => {
        if (standard === 0) return 'N/A';
        const improvement = ((standard - optimized) / standard) * 100;
        const color = improvement >= 0 ? 'success' : 'danger';
        const sign = improvement >= 0 ? '' : ''; // No need for '+' sign
        return `<span class="badge bg-${color}">${sign}${improvement.toFixed(1)}% savings</span>`;
    };

    document.getElementById('standard-route-sequence').textContent = standardRoutePorts.map(p => p.name).join(' → ');
    document.getElementById('optimized-route-sequence').textContent = optimizedRoutePorts.map(p => p.name).join(' → ');
    document.getElementById('standard-fuel').textContent = standardMetrics.fuel_liters.toFixed(2);
    document.getElementById('optimized-fuel').textContent = optimizedMetrics.fuel_liters.toFixed(2);
    document.getElementById('fuel-improvement').innerHTML = formatImprovement(standardMetrics.fuel_liters, optimizedMetrics.fuel_liters);
    document.getElementById('standard-co2').textContent = standardMetrics.co2_kg.toFixed(2);
    document.getElementById('optimized-co2').textContent = optimizedMetrics.co2_kg.toFixed(2);
    document.getElementById('co2-improvement').innerHTML = formatImprovement(standardMetrics.co2_kg, optimizedMetrics.co2_kg);
    document.getElementById('standard-time').textContent = standardMetrics.travel_time_hours.toFixed(2) + ' hours';
    document.getElementById('optimized-time').textContent = optimizedMetrics.travel_time_hours.toFixed(2) + ' hours';
    document.getElementById('time-improvement').innerHTML = formatImprovement(standardMetrics.travel_time_hours, optimizedMetrics.travel_time_hours);
    document.getElementById('standard-distance').textContent = standardMetrics.distance_km.toFixed(2);
    document.getElementById('optimized-distance').textContent = optimizedMetrics.distance_km.toFixed(2);
    document.getElementById('distance-improvement').innerHTML = formatImprovement(standardMetrics.distance_km, optimizedMetrics.distance_km);
}

/**
 * Draws the optimized route (markers and polyline) on the Leaflet map.
 * @param {Array<object>} orderedPorts - The array of port objects in the optimized order.
 * @param {Array<Array<number>>} routeGeometry - The array of lat/lng pairs for the detailed route path.
 */
function drawOptimizedRoute(orderedPorts, routeGeometry) {
    if (optimizedRouteLayer) map.removeLayer(optimizedRouteLayer);
    if (portMarkersLayer) map.removeLayer(portMarkersLayer);

    const greenIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const markers = orderedPorts.map((port, index) => {
        // *** FIX: Start with an empty options object. ***
        const markerOptions = {};
        // *** Only add the custom icon for the starting port. ***
        if (index === 0) {
            markerOptions.icon = greenIcon;
        }
        const popupContent = `<b>${index === 0 ? 'Start/End' : `Stop ${index}`}</b>: ${port.name}`;
        // For other ports, Leaflet will use its default icon, preventing the error.
        return L.marker([port.latitude, port.longitude], markerOptions).bindPopup(popupContent);
    });

    portMarkersLayer = L.layerGroup(markers).addTo(map);

    optimizedRouteLayer = L.polyline(routeGeometry, {
        color: '#0d6efd', // A nice blue color
        weight: 5,
        opacity: 0.8
    }).addTo(map);

    map.fitBounds(optimizedRouteLayer.getBounds().pad(0.1));
}

// --- MAP INITIALIZATION AND DATA LOADING ---
/**
 * Initializes the Leaflet map, sets its properties, and loads all map layers.
 */
function initializeMap() {
    const seaBounds = L.latLngBounds(
        L.latLng(-12, 90),
        L.latLng(25, 135)
    );
    map = L.map('nautical-map', {
        center: [5, 110],
        zoom: 5,
        minZoom: 5,
        maxZoom: 8,
        maxBounds: seaBounds,
        maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap'
    }).addTo(map);

    loadMarineZones();
    addMarineZonesLegend();
}

/**
 * Fetches and renders the table of previously saved optimization results.
 */
async function initializeSavedResults() {
    try {
        const savedResults = await getSavedOptimizations();
        renderSavedResultsTable(savedResults);
    } catch (error) {
        console.error("Failed to initialize saved results:", error);
        toastr.error("Could not load saved results.", "Data Load Error");
    }
}

/**
 * Renders the saved optimization results into an HTML table.
 * @param {Array<object>} results - The array of result objects from the API.
 */
function renderSavedResultsTable(results) {
    const tableBody = document.getElementById('saved-results-body');
    tableBody.innerHTML = '';

    if (!results || results.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No saved optimizations yet.</td></tr>';
        return;
    }

    results.forEach(res => {
        const row = document.createElement('tr');
        row.dataset.resultId = res.id;
        row.innerHTML = `
            <td>${formatDate(res.timestamp)}</td>
            <td>${res.route}</td>
            <td>${res.vessel}</td>
            <td><span class="badge bg-success">${res.fuelSaved}</span></td>
            <td><span class="badge bg-info">${res.co2Reduced}</span></td>
            <td><span class="badge bg-warning">${res.timeSaved}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.addEventListener('click', async (event) => {
        const deleteBtn = event.target.closest('.delete-btn');
        if (!deleteBtn) return;
        
        const row = deleteBtn.closest('tr');
        const resultId = row.dataset.resultId;

        if (!deleteBtn.classList.contains('confirm-delete')) {
            deleteBtn.classList.add('confirm-delete', 'btn-danger');
            deleteBtn.classList.remove('btn-outline-danger');
            deleteBtn.innerHTML = '<i class="bi bi-check-lg"></i> Confirm';
            setTimeout(() => {
                if (deleteBtn.classList.contains('confirm-delete')) {
                    deleteBtn.classList.remove('confirm-delete', 'btn-danger');
                    deleteBtn.classList.add('btn-outline-danger');
                    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                }
            }, 3000);
        } else {
            try {
                await deleteOptimizationResult(resultId);
                row.remove();
                toastr.success('Result deleted.', 'Success');
            } catch (error) {
                toastr.error(`Failed to delete result: ${error.message}`, 'API Error');
                deleteBtn.classList.remove('confirm-delete', 'btn-danger');
                deleteBtn.classList.add('btn-outline-danger');
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            }
        }
    });
}

/**
 * Fetches the list of ports from the API and populates a dropdown menu.
 * @param {string} elementId - The ID of the <select> element to populate.
 */
async function populatePortDropdown(elementId) {
    const selectElement = document.getElementById(elementId);
    if (!selectElement) {
        console.error(`Dropdown with ID '${elementId}' not found!`);
        return;
    }
    try {
        const ports = await getPorts();
        selectElement.innerHTML = '<option selected disabled>Select a port...</option>';
        ports.forEach(port => {
            const option = document.createElement('option');
            option.value = port.name;
            option.dataset.latitude = port.latitude;
            option.dataset.longitude = port.longitude;
            option.textContent = port.name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error(`Failed to fetch and populate ports for #${elementId}:`, error);
        selectElement.innerHTML = '<option>Error loading ports</option>';
    }
}

/**
 * Fetches the list of cruise ships and populates the vessel dropdown.
 */
async function populateVesselDropdown() {
    const selectElement = document.getElementById('vessel-name');
    try {
        const ships = await getCruiseShips();
        selectElement.innerHTML = '<option selected disabled value="">Select a cruise ship...</option>';
        ships.forEach(ship => {
            const option = document.createElement('option');
            option.value = ship.id;
            option.textContent = ship.name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        selectElement.innerHTML = '<option>Error loading ships</option>';
    }
}

// --- MARINE ZONES & WEATHER FUNCTIONS ---
function loadMarineZones() {
    try {
        console.log('Starting marine zones load');
        loadEEZBoundaries();
        loadTerritorialSeas();
        loadWindData();
        loadWaveHeightData();
        loadCycloneData();
        console.log('All map data layers initiated for loading.');
    } catch (error) {
        console.error('Error loading map data:', error);
        toastr.warning('Failed to load some map data', 'Map Data Error');
    }
}

function loadEEZBoundaries() {
    try {
        const wmsUrl = "https://geo.vliz.be/geoserver/MarineRegions/wms";
        eezLayer = L.tileLayer.wms(wmsUrl, {
            layers: 'MarineRegions:eez',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            attribution: 'MarineRegions EEZ'
        }).addTo(map);
        console.log('EEZ WMS layer added successfully');
    } catch (error) {
        console.error('Failed to load EEZ WMS:', error);
    }
}

function loadTerritorialSeas() {
    try {
        const wmsUrl = "https://geo.vliz.be/geoserver/MarineRegions/wms";
        territorialSeasLayer = L.tileLayer.wms(wmsUrl, {
            layers: 'MarineRegions:eez_12nm',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            attribution: 'MarineRegions Territorial Seas'
        }).addTo(map);
        console.log('Territorial Seas WMS layer added successfully');
    } catch (error) {
        console.error('Failed to load Territorial Seas WMS:', error);
    }
}

function loadWindData() {
    try {
        const windUrl = 'https://www.openportguide.org/tiles/actual/wind_stream/5/{z}/{x}/{y}.png';
        windLayer = L.tileLayer(windUrl, {
            attribution: 'OpenPortGuide',
            transparent: true,
            opacity: 0.8
        }).addTo(map);
        console.log('Wind tile layer added successfully');
    } catch (error) {
        console.error('Failed to load wind data:', error);
    }
}

function loadWaveHeightData() {
    try {
        const waveHeightUrl = 'https://www.openportguide.org/tiles/actual/significant_wave_height/5/{z}/{x}/{y}.png';
        waveHeightLayer = L.tileLayer(waveHeightUrl, {
            attribution: 'OpenPortGuide',
            transparent: true,
            opacity: 0.7
        }).addTo(map);
        console.log('Wave Height tile layer added successfully');
    } catch (error) {
        console.error('Failed to load Wave Height data:', error);
    }
}

async function loadCycloneData() {
    try {
        const response = await fetch('../data/result.geojson');
        if (!response.ok) {
            throw new Error(`Failed to fetch cyclone data: ${response.status}`);
        }
        const cycloneData = await response.json();
        const cycloneMarkers = cycloneData.features.map(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            const { properties } = feature;
            const iconColor = getCycloneIconColor(properties.alertlevel);
            const customIcon = L.divIcon({
                className: 'cyclone-marker',
                html: `<div style="background-color: ${iconColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });
            return L.marker([lat, lon], { icon: customIcon }).bindPopup(createCyclonePopup(properties));
        });
        cycloneLayer = L.layerGroup(cycloneMarkers).addTo(map);
        console.log('Cyclone layer added successfully');
    } catch (error) {
        console.error('Failed to load cyclone data:', error);
        toastr.warning('Failed to load cyclone data', 'Map Data Error');
    }
}

function getCycloneIconColor(alertLevel) {
    switch (alertLevel?.toLowerCase()) {
        case 'red': return '#dc3545';
        case 'orange': return '#fd7e14';
        case 'yellow': return '#ffc107';
        case 'green': return '#198754';
        default: return '#6c757d';
    }
}

function createCyclonePopup(properties) {
    const alertLevel = properties.alertlevel || 'Unknown';
    const alertColor = getCycloneIconColor(alertLevel);
    return `
        <div style="min-width: 250px;">
            <h6 style="margin: 0 0 8px 0; color: ${alertColor}; font-weight: bold;">
                ${properties.eventname || 'Unnamed Cyclone'}
            </h6>
            <div style="font-size: 12px; line-height: 1.4;">
                <p><strong>Alert Level:</strong> <span style="color: ${alertColor}; font-weight: bold;">${alertLevel.toUpperCase()}</span></p>
                <p><strong>Severity:</strong> ${properties.severitydata?.severitytext || 'Unknown'}</p>
                <p><strong>Wind Speed:</strong> ${properties.severitydata?.severity || 'N/A'} ${properties.severitydata?.severityunit || ''}</p>
                <p><strong>Duration:</strong> ${formatCycloneDate(properties.fromdate)} - ${formatCycloneDate(properties.todate)}</p>
                ${properties.country ? `<p><strong>Affected Countries:</strong> ${properties.country}</p>` : ''}
                ${properties.description ? `<p><strong>Description:</strong> ${properties.description}</p>` : ''}
            </div>
        </div>
    `;
}

function formatCycloneDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
        return dateString;
    }
}

function addMarineZonesLegend() {
    const legend = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control legend');
            container.innerHTML = `
                <div style="background: rgba(255,255,255,0.9); padding: 10px; border-radius: 4px; font-size: 12px; min-width: 200px;">
                    <h6 style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Marine Zones & Weather</h6>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #42B7B7; margin-right: 8px;"></span><span>200 NM</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #C2DADA; margin-right: 8px;"></span><span>Territorial Sea (12 NM)</span></div>
                    <hr>
                    <h6 style="margin: 8px 0; font-weight: bold; color: #333;">Cyclone Alert Levels</h6>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #dc3545; border-radius: 50%; margin-right: 8px;"></span><span>Red - High Danger</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #fd7e14; border-radius: 50%; margin-right: 8px;"></span><span>Orange - Medium Danger</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #ffc107; border-radius: 50%; margin-right: 8px;"></span><span>Yellow - Low Danger</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #198754; border-radius: 50%; margin-right: 8px;"></span><span>Green - Minimal Danger</span></div>
                    <hr>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;"><input type="checkbox" id="wind-layer-toggle" checked style="margin-right: 8px;"><label for="wind-layer-toggle">Wind</label></div>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;"><input type="checkbox" id="wave-height-layer-toggle" checked style="margin-right: 8px;"><label for="wave-height-layer-toggle">Wave Height</label></div>
                    <div style="display: flex; align-items: center;"><input type="checkbox" id="cyclone-layer-toggle" checked style="margin-right: 8px;"><label for="cyclone-layer-toggle">Cyclones</label></div>
                </div>`;
            L.DomEvent.disableClickPropagation(container);
            container.querySelector('#wind-layer-toggle').addEventListener('change', e => map.hasLayer(windLayer) ? map.removeLayer(windLayer) : map.addLayer(windLayer));
            container.querySelector('#wave-height-layer-toggle').addEventListener('change', e => map.hasLayer(waveHeightLayer) ? map.removeLayer(waveHeightLayer) : map.addLayer(waveHeightLayer));
            container.querySelector('#cyclone-layer-toggle').addEventListener('change', e => map.hasLayer(cycloneLayer) ? map.removeLayer(cycloneLayer) : map.addLayer(cycloneLayer));
            return container;
        }
    });
    map.addControl(new legend());
}

// --- EXPORT FUNCTIONS ---
/**
 * Exports the last optimization result to a PDF file.
 */
function exportResultsToPDF() {
    if (!lastOptimizationResult) {
        toastr.warning('Please run an optimization analysis before exporting.', 'No Data to Export');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const { standardMetrics, optimizedMetrics, standardRoutePorts, optimizedRoutePorts } = lastOptimizationResult;
    const vesselSelect = document.getElementById('vessel-name');
    const vesselName = vesselSelect.options[vesselSelect.selectedIndex].text;

    doc.setFontSize(18);
    doc.text('Route Optimization Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Report generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Vessel: ${vesselName}`, 14, 36);

    const tableColumn = ["Metric", "Standard Route", "Optimized Route", "Improvement"];
    const tableRows = [];
    const formatImprovementText = (standard, optimized) => {
        if (standard === 0) return 'N/A';
        const improvement = (((standard - optimized) / standard) * 100).toFixed(1);
        return `${improvement}%`;
    };

    tableRows.push(['Route Sequence', standardRoutePorts.map(p => p.name).join(' -> '), optimizedRoutePorts.map(p => p.name).join(' -> '), '-']);
    tableRows.push(["Fuel (liters)", standardMetrics.fuel_liters.toFixed(2), optimizedMetrics.fuel_liters.toFixed(2), formatImprovementText(standardMetrics.fuel_liters, optimizedMetrics.fuel_liters)]);
    tableRows.push(["CO2 Emissions (kg)", standardMetrics.co2_kg.toFixed(2), optimizedMetrics.co2_kg.toFixed(2), formatImprovementText(standardMetrics.co2_kg, optimizedMetrics.co2_kg)]);
    tableRows.push(["Travel Time (hours)", standardMetrics.travel_time_hours.toFixed(2), optimizedMetrics.travel_time_hours.toFixed(2), formatImprovementText(standardMetrics.travel_time_hours, optimizedMetrics.travel_time_hours)]);
    tableRows.push(["Distance (km)", standardMetrics.distance_km.toFixed(2), optimizedMetrics.distance_km.toFixed(2), formatImprovementText(standardMetrics.distance_km, optimizedMetrics.distance_km)]);
    
    doc.autoTable(tableColumn, tableRows, { startY: 50 });
    doc.save('route_optimization_report.pdf');
    toastr.success('PDF report downloaded.', 'Export Complete');
}

/**
 * Exports the last optimization result to a CSV file.
 */
function exportResultsToCSV() {
    if (!lastOptimizationResult) {
        toastr.warning('Please run an optimization analysis before exporting.', 'No Data to Export');
        return;
    }
    const { standardMetrics, optimizedMetrics, standardRoutePorts, optimizedRoutePorts } = lastOptimizationResult;
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Metric", "Standard Value", "Optimized Value", "Unit"];
    csvContent += headers.join(",") + "\r\n";
    const rows = [
        ["Route Sequence", `"${standardRoutePorts.map(p=>p.name).join(' -> ')}"`, `"${optimizedRoutePorts.map(p=>p.name).join(' -> ')}"`, "text"],
        ["Fuel Consumption", standardMetrics.fuel_liters.toFixed(2), optimizedMetrics.fuel_liters.toFixed(2), "liters"],
        ["CO2 Emissions", standardMetrics.co2_kg.toFixed(2), optimizedMetrics.co2_kg.toFixed(2), "kg"],
        ["Travel Time", standardMetrics.travel_time_hours.toFixed(2), optimizedMetrics.travel_time_hours.toFixed(2), "hours"],
        ["Distance", standardMetrics.distance_km.toFixed(2), optimizedMetrics.distance_km.toFixed(2), "km"]
    ];

    rows.forEach(rowArray => {
        csvContent += rowArray.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "route_optimization_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastr.success('CSV data downloaded.', 'Export Complete');
}

