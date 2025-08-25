import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, formatDate } from './modules/utils.js';
import { getSavedOptimizations, deleteOptimizationResult, getPorts, getCruiseShips, runOptimization } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

// --- MODULE-LEVEL VARIABLES ---
let map;
let optimizedRouteLayer = null; // To hold the map layer for the optimized route
let eezLayer = null; // To hold the EEZ boundary layer
let territorialSeasLayer = null; // To hold the Territorial Seas layer
let windLayer = null; // To hold the wind data layer
let waveHeightLayer = null; // To hold the wave height data layer

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
    populateVesselDropdown(); // <-- MOVED HERE
});



// --- PORT SELECTION LOGIC ---
/**
 * Sets up event listeners for the departure and destination port dropdowns and the "Add Port" button.
 */
function setupPortSelectionListeners() {
    const departureSelect = document.getElementById("departure-port");
    const destinationSelect = document.getElementById("add-destination-port");
    const addButton = document.getElementById("add-port-btn");

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
            showAlert("Please select a departure port first!", "warning");
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
                showAlert(`'${newPort.name}' is already in the route.`, "info");
                return;
            }
            route.arrivals.push(newPort);
            console.log("Arrival Ports:", route.arrivals);
            renderRouteBadges(); // Update the UI
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
    if (route.arrivals.length === 0) {
        const placeholder = document.createElement('span');
        if (route.departure) { // If departure is set but no arrivals
            placeholder.className = 'text-muted fst-italic ms-2';
            placeholder.textContent = 'Add a destination...';
        } else { // If nothing is set
            placeholder.className = 'text-muted fst-italic';
            placeholder.textContent = 'No destinations added yet.';
        }
        container.appendChild(placeholder);
    }

    // Add event listeners to the "remove" buttons on the arrival port badges
    container.querySelectorAll('.btn-close').forEach(button => {
        button.addEventListener('click', (e) => {
            const portIndexToRemove = parseInt(e.target.dataset.index, 10);
            route.arrivals.splice(portIndexToRemove, 1); // Remove the port from the array
            renderRouteBadges(); // Re-render the badges
        });
    });
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

    // 2. Validate inputs (no changes here)
    if (!route.departure || route.arrivals.length < 2 || !selectedShipId) {
        showAlert("Please select a departure port, at least two destination ports, and a vessel.", "warning");
        return;
    }

    // 3. Update UI to show a loading state (no changes here)
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Optimizing...';

    // 4. Prepare the data for the API (no changes here)
    const originalRoutePorts = [route.departure, ...route.arrivals];
    const coordinates = originalRoutePorts.map(port => [port.latitude, port.longitude]);

    try {
        // 5. Call the API. The 'result' object now contains both standard and optimized metrics.
        const result = await runOptimization(coordinates, selectedShipId);
        showAlert('Optimization complete!', 'success');

        // 6. Get the metrics directly from the result. NO frontend calculation needed.
        const standardMetrics = result.standard_metrics;
        const optimizedMetrics = result.optimized_metrics;
        
        // 7. Reconstruct the ordered port list for the UI map
        const orderedPorts = [route.departure];
        result.best_route_indices.forEach(index => {
            // API indices (1, 2, 3...) correspond to the arrivals array (0, 1, 2...)
            orderedPorts.push(route.arrivals[index - 1]);
        });
        
        // 8. Update the UI with the fair comparison results
        updateComparisonTable(standardMetrics, optimizedMetrics, originalRoutePorts, orderedPorts);
        drawOptimizedRoute(orderedPorts);

    } catch (error) {
        // Handle any errors from the API call
        console.error("Optimization failed:", error);
        showAlert(`Optimization failed: ${error.message}`, 'danger');
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
 * @param {object} optimizedResult - The optimization results from the API.
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

    // Update the table using the new, consistent data objects
    document.getElementById('standard-route-sequence').textContent = standardRoutePorts.map(p => p.name).join(' → ');
    document.getElementById('optimized-route-sequence').textContent = optimizedRoutePorts.map(p => p.name).join(' → ');
    
    document.getElementById('standard-fuel').textContent = standardMetrics.fuel_liters.toFixed(2);
    document.getElementById('optimized-fuel').textContent = optimizedMetrics.fuel_liters.toFixed(2);
    document.getElementById('fuel-improvement').innerHTML = formatImprovement(standardMetrics.fuel_liters, optimizedMetrics.fuel_liters);
    
    document.getElementById('standard-co2').textContent = standardMetrics.co2_kg.toFixed(2);
    document.getElementById('optimized-co2').textContent = optimizedMetrics.co2_kg.toFixed(2);
    document.getElementById('co2-improvement').innerHTML = formatImprovement(standardMetrics.co2_kg, optimizedMetrics.co2_kg);
    
    document.getElementById('standard-distance').textContent = standardMetrics.distance_km.toFixed(2);
    document.getElementById('optimized-distance').textContent = optimizedMetrics.distance_km.toFixed(2);
    document.getElementById('distance-improvement').innerHTML = formatImprovement(standardMetrics.distance_km, optimizedMetrics.distance_km);
}

/**
 * Draws the optimized route (markers and polyline) on the Leaflet map.
 * @param {Array<object>} orderedPorts - The array of port objects in the optimized order.
 */
function drawOptimizedRoute(orderedPorts) {
    // Clear any existing route from the map
    if (optimizedRouteLayer) {
        map.removeLayer(optimizedRouteLayer);
    }

    const routePoints = [];
    const routeMarkers = [];

    orderedPorts.forEach((port, index) => {
        const point = [port.latitude, port.longitude];
        routePoints.push(point);

        let marker;
        if (index === 0) { // Special marker for the start/end port
            const greenIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });
            marker = L.marker(point, { icon: greenIcon }).bindPopup(`<b>Start/End:</b> ${port.name}`);
        } else { // Standard marker for other stops
            marker = L.marker(point).bindPopup(`<b>Stop ${index}:</b> ${port.name}`);
        }
        routeMarkers.push(marker);
    });
    
    // Add the starting point again to close the loop
    routePoints.push([orderedPorts[0].latitude, orderedPorts[0].longitude]);

    // Create the polyline and layer group
    const routePolyline = L.polyline(routePoints, { color: 'blue', weight: 4, opacity: 0.8 });
    optimizedRouteLayer = L.layerGroup([...routeMarkers, routePolyline]);
    optimizedRouteLayer.addTo(map);

    // Zoom the map to fit the new route
    map.fitBounds(routePolyline.getBounds().pad(0.1));
}


// --- MAP INITIALIZATION AND DATA LOADING ---
/**
 * Initializes the Leaflet map, sets its properties, and loads all map layers.
 */
function initializeMap() {
    const seaBounds = L.latLngBounds(
        L.latLng(-12, 90),  // Southwest corner
        L.latLng(25, 135)   // Northeast corner
    );
    
    map = L.map('nautical-map', {
        center: [5, 110],
        zoom: 5,
        minZoom: 5,
        maxZoom: 8,
        maxBounds: seaBounds, // Use Leaflet's built-in bounds restriction
        maxBoundsViscosity: 1.0 // Makes the bounds completely solid
    });
    
    // Add base map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add sea mark tiles
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap'
    }).addTo(map);
    
    // Load marine zones and weather data layers
    loadMarineZones();
    
    // Add the interactive legend control to the map
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
        showAlert("Could not load saved results.", "danger");
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

    // Add a single event listener to the table body for handling delete clicks
    tableBody.addEventListener('click', async (event) => {
        const deleteBtn = event.target.closest('.delete-btn');
        if (!deleteBtn) return;

        const row = deleteBtn.closest('tr');
        const resultId = row.dataset.resultId;

        // Implement a two-click delete confirmation to avoid using confirm()
        if (!deleteBtn.classList.contains('confirm-delete')) {
            deleteBtn.classList.add('confirm-delete', 'btn-danger');
            deleteBtn.classList.remove('btn-outline-danger');
            deleteBtn.innerHTML = '<i class="bi bi-check-lg"></i> Confirm';
            
            // Revert button if user clicks elsewhere or waits too long
            setTimeout(() => {
                if (deleteBtn.classList.contains('confirm-delete')) {
                    deleteBtn.classList.remove('confirm-delete', 'btn-danger');
                    deleteBtn.classList.add('btn-outline-danger');
                    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                }
            }, 3000); // Revert after 3 seconds
        } else {
            try {
                await deleteOptimizationResult(resultId);
                row.remove(); // Animate removal would be a nice UX touch here
                showAlert('Result deleted.', 'success');
            } catch (error) {
                showAlert(`Failed to delete result: ${error.message}`, 'danger');
                // Revert button on failure
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

// --- MARINE ZONES & WEATHER FUNCTIONS ---

/**
 * Asynchronously loads all marine zone and weather data layers.
 */
function loadMarineZones() {
    try {
        console.log('Starting marine zones load');
        showAlert('Loading marine zones...', 'info');

        // These functions don't need to be async as L.tileLayer is synchronous
        loadEEZBoundaries();
        loadTerritorialSeas();
        loadWindData();
        loadWaveHeightData();
        
        console.log('All map data layers initiated for loading.');
        showAlert('All map data loaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error loading map data:', error);
        showAlert('Failed to load some map data', 'warning');
    }
}

/**
 * Loads EEZ (Exclusive Economic Zone) boundaries as a WMS layer.
 */
function loadEEZBoundaries() {
    try {
        const wmsUrl = "https://geo.vliz.be/geoserver/MarineRegions/wms";
        const eezWMS = L.tileLayer.wms(wmsUrl, {
            layers: 'MarineRegions:eez',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            attribution: 'MarineRegions EEZ'
        });
        eezWMS.addTo(map);
        eezLayer = eezWMS; // Store reference
        console.log('EEZ WMS layer added successfully');
    } catch (error) {
        console.error('Failed to load EEZ WMS:', error);
    }
}

/**
 * Loads Territorial Seas boundaries (12 NM) as a WMS layer.
 */
function loadTerritorialSeas() {
    try {
        const wmsUrl = "https://geo.vliz.be/geoserver/MarineRegions/wms";
        const territorialSeasWMS = L.tileLayer.wms(wmsUrl, {
            layers: 'MarineRegions:eez_12nm',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG4326,
            attribution: 'MarineRegions Territorial Seas'
        });
        territorialSeasWMS.addTo(map);
        territorialSeasLayer = territorialSeasWMS; // Store reference
        console.log('Territorial Seas WMS layer added successfully');
    } catch (error) {
        console.error('Failed to load Territorial Seas WMS:', error);
    }
}

/**
 * Loads wind data as a tile layer.
 */
function loadWindData() {
    try {
        const windUrl = 'https://www.openportguide.org/tiles/actual/wind_stream/5/{z}/{x}/{y}.png';
        const windTileLayer = L.tileLayer(windUrl, {
            attribution: 'OpenPortGuide',
            transparent: true,
            opacity: 0.8
        });
        windTileLayer.addTo(map);
        windLayer = windTileLayer; // Store reference
        console.log('Wind tile layer added successfully');
    } catch (error) {
        console.error('Failed to load wind data:', error);
    }
}

/**
 * Loads wave height data as a tile layer.
 */
function loadWaveHeightData() {
    try {
        const waveHeightUrl = 'https://www.openportguide.org/tiles/actual/significant_wave_height/5/{z}/{x}/{y}.png';
        const waveHeightTileLayer = L.tileLayer(waveHeightUrl, {
            attribution: 'OpenPortGuide',
            transparent: true,
            opacity: 0.7
        });
        waveHeightTileLayer.addTo(map);
        waveHeightLayer = waveHeightTileLayer; // Store reference
        console.log('Wave Height tile layer added successfully');
    } catch (error) {
        console.error('Failed to load Wave Height data:', error);
    }
}

/**
 * Adds a custom Leaflet control to the map that serves as a legend and layer toggle.
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
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #42B7B7; margin-right: 8px;"></span><span>200 NM</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #C2DADA; margin-right: 8px;"></span><span>Territorial Sea (12 NM)</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #FFFF00; margin-right: 8px;"></span><span>Joint Region</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #FF0000; margin-right: 8px;"></span><span>Overlapping Claims</span></div>
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

            // Add event listeners for the layer toggle checkboxes
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

async function populateVesselDropdown() {
    const selectElement = document.getElementById('vessel-name');
    try {
        const ships = await getCruiseShips();
        selectElement.innerHTML = '<option selected disabled>Select a cruise ship...</option>';
        ships.forEach(ship => {
            const option = document.createElement('option');
            option.value = ship.id; // Use the ship's ID as the value
            option.textContent = ship.name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        selectElement.innerHTML = '<option>Error loading ships</option>';
    }
}

