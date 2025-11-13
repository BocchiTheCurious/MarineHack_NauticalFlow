import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, formatDate, showLoader, hideLoader } from './modules/utils.js';
import { getPorts, getCruiseShips, runOptimization, saveOptimizationResult } from './modules/api.js';
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

// AIS Ship Movement Variables
let aisData = null;
let vesselLayers = [];
let vesselTrackLayers = [];

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
    initializeMapFullscreen();
    initializeOptimizationPriority();
    populatePortDropdown('departure-port');
    populatePortDropdown('add-destination-port');
    populateVesselDropdown();

    // Load AIS ship movement data
    loadAISShipData();

    hideLoader();
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
                id: parseInt(selectedOption.dataset.id),
                name: selectedOption.value,
                latitude: parseFloat(selectedOption.dataset.latitude),
                longitude: parseFloat(selectedOption.dataset.longitude),
                country: selectedOption.dataset.country || 'Unknown' // Add country
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
                id: parseInt(selectedOption.dataset.id),
                name: selectedOption.value,
                latitude: parseFloat(selectedOption.dataset.latitude),
                longitude: parseFloat(selectedOption.dataset.longitude),
                country: selectedOption.dataset.country || 'Unknown' // Add country
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
    const runBtn = document.getElementById('run-optimization');
    const originalBtnText = runBtn.innerHTML;
    const selectedShipId = document.getElementById('vessel-name').value;

    if (!route.departure || !selectedShipId || route.arrivals.length < 2) {
        let errorMessage = "Please ensure you have selected the following:<ul>";
        if (!route.departure) errorMessage += "<li>A departure port</li>";
        if (!selectedShipId) errorMessage += "<li>A vessel</li>";
        if (route.arrivals.length < 2) errorMessage += "<li>At least 2 destination ports</li>";
        errorMessage += "</ul>For best results, a route with 3 or more total ports is recommended.";
        toastr.warning(errorMessage, "Insufficient Data for Optimization", { timeOut: 8000 });
        return;
    }

    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Optimizing...';

    const originalRoutePorts = [route.departure, ...route.arrivals];
    const coordinates = originalRoutePorts.map(port => [port.latitude, port.longitude]);
    const portIds = originalRoutePorts.map(port => port.id);

    // Fetch port data to show congestion percentages
    let portsWithCongestion = [];
    try {
        const allPorts = await getPorts();
        portsWithCongestion = originalRoutePorts.map(routePort => {
            const fullPortData = allPorts.find(p => p.id === routePort.id);
            return {
                ...routePort,
                congestion: fullPortData ? parseFloat(fullPortData.portCongestionIndex) : 0
            };
        });
    } catch (error) {
        console.error("Failed to fetch port data:", error);
    }

    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║          ROUTE OPTIMIZATION - DETAILED DEBUG              ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("📍 ROUTE DETAILS WITH CONGESTION:");
    console.log("─────────────────────────────────────────────────────────────");
    
    portsWithCongestion.forEach((port, index) => {
        const congestionHours = calculateCongestionHours(port.congestion);
        const icon = index === 0 ? "🚢" : `${index}️⃣`;
        console.log(`${icon} ${port.name}`);
        console.log(`   ├─ ID: ${port.id}`);
        console.log(`   ├─ Country: ${port.country}`);
        console.log(`   ├─ Congestion: ${port.congestion}%`);
        console.log(`   └─ Wait Time: ~${congestionHours.toFixed(1)} hours`);
        console.log("");
    });
    
    const totalCongestionHours = portsWithCongestion.reduce((sum, port) => 
        sum + calculateCongestionHours(port.congestion), 0
    );
    console.log(`⏱️  TOTAL CONGESTION DELAY: ${totalCongestionHours.toFixed(1)} hours`);
    console.log("");
    console.log("🔢 DATA SENT TO BACKEND:");
    console.log("  Port IDs:", portIds);
    console.log("  Total Ports:", originalRoutePorts.length);
    console.log("  Ship ID:", selectedShipId);
    console.log("─────────────────────────────────────────────────────────────");

    try {
    const weights = getOptimizationWeights();
    
    // Enhanced console logging
    console.log("🎯 OPTIMIZATION PRIORITY:");
    console.log("─────────────────────────────────────────────────────────────");
  console.log(`  ⛽ Fuel:       ${weights.fuel}%`);
console.log(`  ⏱️  Time:       ${weights.time}%`);
console.log(`  🚦 Congestion: ${weights.congestion}%`);
    console.log("");
    
    // Send optimization request WITH WEIGHTS
    const result = await runOptimization(
        coordinates, 
        selectedShipId, 
        portIds,
        weights
    );
        
        console.log("");
        console.log("✅ OPTIMIZATION RESULTS RECEIVED");
        console.log("═════════════════════════════════════════════════════════════");
        console.log("");
        
        // Show original route order
        console.log("📌 ORIGINAL ROUTE (As Entered):");
        console.log("─────────────────────────────────────────────────────────────");
        originalRoutePorts.forEach((port, index) => {
            const portData = portsWithCongestion[index];
            console.log(`  ${index + 1}. ${port.name} (${portData.congestion}% congestion)`);
        });
        console.log("");
        console.log("  📊 Metrics:");
        console.log(`     Distance:    ${result.standard_metrics.distance_km} km`);
        console.log(`     Travel Time: ${result.standard_metrics.travel_time_hours.toFixed(2)} hours`);
        console.log(`     ├─ Sailing:     ${(result.standard_metrics.travel_time_hours - result.standard_metrics.congestion_hours).toFixed(2)} hours`);
        console.log(`     └─ Congestion: ${result.standard_metrics.congestion_hours.toFixed(2)} hours`);
        console.log(`     Fuel Used:   ${result.standard_metrics.fuel_liters.toFixed(0)} L`);
        console.log("");
        
        // Show optimized route order
        const orderedPorts = [route.departure, ...result.best_route_indices.map(index => route.arrivals[index - 1])];
        console.log("🎯 OPTIMIZED ROUTE (By Algorithm):");
        console.log("─────────────────────────────────────────────────────────────");
        orderedPorts.forEach((port, index) => {
            const portData = portsWithCongestion.find(p => p.id === port.id);
            const changeIndicator = originalRoutePorts[index].id === port.id ? "" : " ⚠️ CHANGED";
            console.log(`  ${index + 1}. ${port.name} (${portData.congestion}% congestion)${changeIndicator}`);
        });
        console.log("");
        console.log("  📊 Metrics:");
        console.log(`     Distance:    ${result.optimized_metrics.distance_km} km`);
        console.log(`     Travel Time: ${result.optimized_metrics.travel_time_hours.toFixed(2)} hours`);
        console.log(`     ├─ Sailing:     ${(result.optimized_metrics.travel_time_hours - result.optimized_metrics.congestion_hours).toFixed(2)} hours`);
        console.log(`     └─ Congestion: ${result.optimized_metrics.congestion_hours.toFixed(2)} hours`);
        console.log(`     Fuel Used:   ${result.optimized_metrics.fuel_liters.toFixed(0)} L`);
        console.log("");
        
        // Show improvements
        console.log("💰 IMPROVEMENTS:");
        console.log("─────────────────────────────────────────────────────────────");
        const distanceSaved = result.standard_metrics.distance_km - result.optimized_metrics.distance_km;
        const timeSaved = result.standard_metrics.travel_time_hours - result.optimized_metrics.travel_time_hours;
        const fuelSaved = result.standard_metrics.fuel_liters - result.optimized_metrics.fuel_liters;
        const congestionDiff = result.standard_metrics.congestion_hours - result.optimized_metrics.congestion_hours;
        
        console.log(`  Distance:    ${distanceSaved > 0 ? '-' : '+'}${Math.abs(distanceSaved).toFixed(2)} km (${((distanceSaved/result.standard_metrics.distance_km)*100).toFixed(1)}%)`);
        console.log(`  Time:        ${timeSaved > 0 ? '-' : '+'}${Math.abs(timeSaved).toFixed(2)} hours (${((timeSaved/result.standard_metrics.travel_time_hours)*100).toFixed(1)}%)`);
        console.log(`  Fuel:        ${fuelSaved > 0 ? '-' : '+'}${Math.abs(fuelSaved).toFixed(0)} L (${((fuelSaved/result.standard_metrics.fuel_liters)*100).toFixed(1)}%)`);
        console.log(`  Congestion:  ${congestionDiff > 0 ? '-' : '+'}${Math.abs(congestionDiff).toFixed(2)} hours (${congestionDiff === 0 ? 'No change' : (congestionDiff > 0 ? 'Reduced' : 'Increased')})`);
        console.log("");
        
        // Analysis
        console.log("🔍 ALGORITHM ANALYSIS:");
        console.log("─────────────────────────────────────────────────────────────");
        console.log(`  Optimization Goal: MINIMIZE FUEL CONSUMPTION`);
        console.log(`  Congestion Impact: ${result.standard_metrics.congestion_hours > 0 ? 'INCLUDED' : 'NOT INCLUDED'}`);
        console.log("");
        
        if (congestionDiff === 0) {
            console.log("  ⚠️ CONGESTION NOT REDUCED:");
            console.log("     The algorithm prioritized fuel/distance over");
            console.log("     congestion avoidance. Same ports = same congestion.");
        } else if (congestionDiff > 0) {
            console.log("  ✅ CONGESTION REDUCED:");
            console.log("     Route reordering resulted in lower congestion.");
        } else {
            console.log("  ⚠️ CONGESTION INCREASED:");
            console.log("     Algorithm chose shorter distance despite");
            console.log("     higher congestion at reordered ports.");
        }
        console.log("");
        
        console.log("  💡 WHY THIS HAPPENS:");
        console.log("     • Idle fuel (50 L/hour) << Travel fuel (1000+ L/hour)");
        console.log("     • Distance reduction saves MORE fuel than avoiding congestion");
        console.log("     • Current formula: Fuel = Travel Fuel + (Congestion × 50 L/h)");
        console.log("");
        console.log("═════════════════════════════════════════════════════════════");
        
        toastr.success('Optimization complete!', 'Success');

        const standardMetrics = result.standard_metrics;
        const optimizedMetrics = result.optimized_metrics;

        updateComparisonTable(
            standardMetrics,
            optimizedMetrics,
            originalRoutePorts,
            orderedPorts
        );

        drawOptimizedRoute(orderedPorts, result.route_geometry);
        displayEtaDetails(result.eta_details, orderedPorts);

        lastOptimizationResult = {
            standardMetrics,
            optimizedMetrics,
            standardRoutePorts: originalRoutePorts,
            optimizedRoutePorts: orderedPorts,
            etaDetails: result.eta_details
        };

        const vesselSelect = document.getElementById('vessel-name');
        const vesselName = vesselSelect.options[vesselSelect.selectedIndex].text;
        const resultToSave = {
            route: originalRoutePorts.map(p => p.name).join(' → '),
            vessel: vesselName,
            fuelSaved: `${(standardMetrics.fuel_liters - optimizedMetrics.fuel_liters).toFixed(1)} L`,
            co2Reduced: `${(standardMetrics.co2_kg - optimizedMetrics.co2_kg).toFixed(1)} kg`,
            timeSaved: `${(standardMetrics.travel_time_hours - optimizedMetrics.travel_time_hours).toFixed(1)} hrs`
        };

        await saveOptimizationResult(resultToSave);
        toastr.info('Optimization result has been saved.', 'Result Saved');

    } catch (error) {
        console.error("❌ OPTIMIZATION FAILED:", error);
        toastr.error(`Optimization failed: ${error.message}`, 'API Error');
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = originalBtnText;
    }
}

// Helper function to calculate congestion hours from percentage
function calculateCongestionHours(percentage) {
    const percent = parseFloat(percentage);
    if (percent <= 25) {
        return percent * 0.04;
    } else if (percent <= 50) {
        return 1 + (percent - 25) * 0.08;
    } else if (percent <= 75) {
        return 3 + (percent - 50) * 0.16;
    } else {
        return 7 + (percent - 75) * 0.32;
    }
}

// --- UI and MAP UPDATE FUNCTIONS ---
/**
 * Populates the comparison table with standard vs. optimized route metrics.
 */
function updateComparisonTable(standardMetrics, optimizedMetrics, standardRoutePorts, optimizedRoutePorts) {
    const formatImprovement = (standard, optimized) => {
        if (standard === 0) return 'N/A';
        const improvement = ((standard - optimized) / standard) * 100;
        const color = improvement >= 0 ? 'success' : 'danger';
        const sign = improvement >= 0 ? '' : '';
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
 * NEW FUNCTION: Renders the detailed ETA breakdown into a table.
 */
function displayEtaDetails(etaDetails, orderedPorts) {
    const container = document.getElementById('eta-details-container');
    container.innerHTML = '';

    if (!etaDetails || etaDetails.length === 0) {
        container.innerHTML = '<p class="text-muted">No ETA details were returned from the optimization.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';

    table.innerHTML = `
        <thead class="table-light">
            <tr>
                <th>Stop</th>
                <th>Port Name</th>
                <th>Leg Distance (km)</th>
                <th>Estimated Arrival Time (ETA)</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;

    const tbody = table.querySelector('tbody');

    etaDetails.forEach((stop, index) => {
        const row = document.createElement('tr');
        const portName = orderedPorts[index + 1]?.name || 'Unknown Port';
        const arrivalTime = new Date(stop.eta).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${portName}</strong></td>
            <td>${stop.leg_distance_km} km</td>
            <td>${arrivalTime}</td>
        `;
        tbody.appendChild(row);
    });

    container.appendChild(table);
}

/**
 * Draws the optimized route (markers and polyline) on the Leaflet map.
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
        const markerOptions = {};
        if (index === 0) {
            markerOptions.icon = greenIcon;
        }
        const labelText = `${index === 0 ? 'Start' : `Stop ${index}`}: ${port.name}`;

        const marker = L.marker([port.latitude, port.longitude], markerOptions)
            .bindTooltip(labelText, {
                permanent: true,
                direction: 'top',
                className: 'port-label-tooltip',
                offset: [0, -20]
            })
            .bindPopup(`<b>${labelText}</b>`);

        return marker;
    });

    portMarkersLayer = L.layerGroup(markers).addTo(map);

    optimizedRouteLayer = L.polyline(routeGeometry, {
        color: '#0d6efd',
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
    // USA region bounds
    const usaBounds = L.latLngBounds(
        L.latLng(24, -125),   // Southwest corner
        L.latLng(50, -65)     // Northeast corner
    );

    // Initialize map with USA view
    map = L.map('nautical-map', {
        center: [37, -95],    // Center of USA
        zoom: 2,              // USA view zoom level
        minZoom: 2,           // Prevent zooming out too far
        maxZoom: 18,          // Allow detailed zoom
        maxBounds: usaBounds,
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
 * Initialize fullscreen toggle for the map using native Fullscreen API
 */
function initializeMapFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreen-toggle');
    const mapContainer = document.getElementById('nautical-map').closest('.card');
    const icon = fullscreenBtn.querySelector('i');

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            mapContainer.requestFullscreen().then(() => {
                icon.classList.remove('bi-arrows-fullscreen');
                icon.classList.add('bi-fullscreen-exit');
                fullscreenBtn.title = 'Exit Fullscreen';
                
                // Resize map
                setTimeout(() => {
                    if (map) map.invalidateSize();
                }, 100);
                
                toastr.info('Press ESC or F11 to exit', 'Fullscreen Mode', {timeOut: 2000});
            }).catch(err => {
                console.error('Fullscreen failed:', err);
                toastr.error('Fullscreen not supported', 'Error');
            });
        } else {
            // Exit fullscreen
            document.exitFullscreen();
        }
    });

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // Exited fullscreen
            icon.classList.remove('bi-fullscreen-exit');
            icon.classList.add('bi-arrows-fullscreen');
            fullscreenBtn.title = 'Toggle Fullscreen';
            
            // Resize map
            setTimeout(() => {
                if (map) map.invalidateSize();
            }, 100);
        }
    });
}

// --- OPTIMIZATION PRIORITY MANAGEMENT ---
let fuelPriority = 50;
let timePriority = 50;
let congestionPriority = 50;

// Lock states
let fuelLocked = false;
let timeLocked = false;
let congestionLocked = false;

function initializeOptimizationPriority() {
    const fuelSlider = document.getElementById('fuelSlider');
    const timeSlider = document.getElementById('timeSlider');
    const congestionSlider = document.getElementById('congestionSlider');
    
    // Lock button handlers
    document.getElementById('fuelLockBtn').addEventListener('click', () => toggleLock('fuel'));
    document.getElementById('timeLockBtn').addEventListener('click', () => toggleLock('time'));
    document.getElementById('congestionLockBtn').addEventListener('click', () => toggleLock('congestion'));
    
    // Function to redistribute percentages when one slider changes
    function redistributePercentages(changedSlider, newValue) {
        const oldValue = changedSlider === 'fuel' ? fuelPriority : 
                        changedSlider === 'time' ? timePriority : congestionPriority;
        
        const difference = newValue - oldValue;
        
        // Update the changed slider
        if (changedSlider === 'fuel') fuelPriority = newValue;
        else if (changedSlider === 'time') timePriority = newValue;
        else if (changedSlider === 'congestion') congestionPriority = newValue;
        
        // Get the two sliders that need adjustment (excluding locked ones)
        let adjustableSliders = [];
        if (changedSlider !== 'fuel' && !fuelLocked) adjustableSliders.push({name: 'fuel', value: fuelPriority});
        if (changedSlider !== 'time' && !timeLocked) adjustableSliders.push({name: 'time', value: timePriority});
        if (changedSlider !== 'congestion' && !congestionLocked) adjustableSliders.push({name: 'congestion', value: congestionPriority});
        
        // Check if we can redistribute
        if (adjustableSliders.length === 0) {
            // All other sliders are locked - can't adjust, revert change
            toastr.warning('Cannot adjust: other sliders are locked!', 'Adjustment Blocked');
            if (changedSlider === 'fuel') {
                fuelPriority = oldValue;
                document.getElementById('fuelSlider').value = oldValue;
            } else if (changedSlider === 'time') {
                timePriority = oldValue;
                document.getElementById('timeSlider').value = oldValue;
            } else {
                congestionPriority = oldValue;
                document.getElementById('congestionSlider').value = oldValue;
            }
            updatePriorityDisplay();
            return;
        }
        
        // Calculate remaining percentage to distribute
        const remaining = 100 - newValue - 
            (changedSlider === 'fuel' || fuelLocked ? fuelPriority : 0) -
            (changedSlider === 'time' || timeLocked ? timePriority : 0) -
            (changedSlider === 'congestion' || congestionLocked ? congestionPriority : 0);
        
        // Calculate total of adjustable sliders
        const adjustableTotal = adjustableSliders.reduce((sum, s) => sum + s.value, 0);
        
        if (adjustableTotal === 0) {
            // Split remaining equally among adjustable sliders
            const share = Math.floor(remaining / adjustableSliders.length);
            let remainder = remaining - (share * adjustableSliders.length);
            
            adjustableSliders.forEach((slider, index) => {
                const value = share + (index === 0 ? remainder : 0);
                if (slider.name === 'fuel') fuelPriority = value;
                else if (slider.name === 'time') timePriority = value;
                else congestionPriority = value;
            });
        } else {
            // Redistribute proportionally among adjustable sliders
            adjustableSliders.forEach(slider => {
                const ratio = slider.value / adjustableTotal;
                const newVal = Math.round(remaining * ratio);
                
                if (slider.name === 'fuel') fuelPriority = newVal;
                else if (slider.name === 'time') timePriority = newVal;
                else congestionPriority = newVal;
            });
        }
        
        // Ensure total is exactly 100 (handle rounding)
        const total = fuelPriority + timePriority + congestionPriority;
        if (total !== 100 && adjustableSliders.length > 0) {
            const correction = 100 - total;
            const firstAdjustable = adjustableSliders[0].name;
            
            if (firstAdjustable === 'fuel') fuelPriority += correction;
            else if (firstAdjustable === 'time') timePriority += correction;
            else congestionPriority += correction;
        }
        
        // Update all slider positions
        document.getElementById('fuelSlider').value = fuelPriority;
        document.getElementById('timeSlider').value = timePriority;
        document.getElementById('congestionSlider').value = congestionPriority;
        
        updatePriorityDisplay();
    }
    
    // Slider event listeners (keep existing)
    fuelSlider.addEventListener('input', (e) => {
        redistributePercentages('fuel', parseInt(e.target.value));
    });
    
    timeSlider.addEventListener('input', (e) => {
        redistributePercentages('time', parseInt(e.target.value));
    });
    
    congestionSlider.addEventListener('input', (e) => {
        redistributePercentages('congestion', parseInt(e.target.value));
    });
    
    // Preset buttons
    document.getElementById('presetMaxFuel').addEventListener('click', () => {
        unlockAll();
        setPriorities(100, 0, 0);
    });
    
    document.getElementById('presetMaxTime').addEventListener('click', () => {
        unlockAll();
        setPriorities(0, 100, 0);
    });
    
    document.getElementById('presetCongestion').addEventListener('click', () => {
        unlockAll();
        setPriorities(0, 0, 100);
    });
    
    document.getElementById('presetBalanced').addEventListener('click', () => {
        unlockAll();
        setPriorities(33, 33, 34);
    });
    
    // Initialize display
    updatePriorityDisplay();
}
function toggleLock(sliderName) {
    const lockedCount = [fuelLocked, timeLocked, congestionLocked].filter(Boolean).length;
    
    // Prevent locking if 2 sliders are already locked
    if (lockedCount >= 2 && 
        ((sliderName === 'fuel' && !fuelLocked) ||
         (sliderName === 'time' && !timeLocked) ||
         (sliderName === 'congestion' && !congestionLocked))) {
        toastr.warning('Cannot lock more than 2 sliders at once!', 'Lock Limit');
        return;
    }
    
    // Toggle the lock state
    if (sliderName === 'fuel') {
        fuelLocked = !fuelLocked;
        updateLockButton('fuelLockBtn', fuelLocked);
    } else if (sliderName === 'time') {
        timeLocked = !timeLocked;
        updateLockButton('timeLockBtn', timeLocked);
    } else if (sliderName === 'congestion') {
        congestionLocked = !congestionLocked;
        updateLockButton('congestionLockBtn', congestionLocked);
    }
}

function updateLockButton(buttonId, isLocked) {
    const btn = document.getElementById(buttonId);
    const icon = btn.querySelector('i');
    
    if (isLocked) {
        btn.classList.remove('btn-outline-secondary');
        btn.classList.add('btn-warning');
        icon.classList.remove('bi-unlock');
        icon.classList.add('bi-lock-fill');
        btn.title = 'Unlock this slider';
    } else {
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-outline-secondary');
        icon.classList.remove('bi-lock-fill');
        icon.classList.add('bi-unlock');
        btn.title = 'Lock this slider';
    }
}

function unlockAll() {
    fuelLocked = false;
    timeLocked = false;
    congestionLocked = false;
    updateLockButton('fuelLockBtn', false);
    updateLockButton('timeLockBtn', false);
    updateLockButton('congestionLockBtn', false);
}

function setPriorities(fuel, time, congestion) {
    // Ensure total is 100
    const total = fuel + time + congestion;
    if (total !== 100) {
        console.warn(`Preset total is ${total}, adjusting to 100`);
        // Normalize to 100
        fuel = Math.round((fuel / total) * 100);
        time = Math.round((time / total) * 100);
        congestion = 100 - fuel - time; // Ensure exact 100
    }
    
    fuelPriority = fuel;
    timePriority = time;
    congestionPriority = congestion;
    
    document.getElementById('fuelSlider').value = fuel;
    document.getElementById('timeSlider').value = time;
    document.getElementById('congestionSlider').value = congestion;
    
    updatePriorityDisplay();
    toastr.success('Priorities updated', 'Optimization');
}

function updatePriorityDisplay() {
    // Update percentage displays
    document.getElementById('fuelPercentDisplay').textContent = `${fuelPriority}%`;
    document.getElementById('timePercentDisplay').textContent = `${timePriority}%`;
    document.getElementById('congestionPercentDisplay').textContent = `${congestionPriority}%`;
    
    // Update total percentage
    const total = fuelPriority + timePriority + congestionPriority;
    const totalBadge = document.getElementById('totalPercentage');
    if (totalBadge) {
        totalBadge.textContent = `${total}%`;
        // Change color if not 100% (shouldn't happen, but safety check)
        totalBadge.className = total === 100 ? 'badge bg-success fs-6' : 'badge bg-danger fs-6';
    }
    
    // Update strategy description
    const strategyDesc = document.getElementById('strategyDescription');
    strategyDesc.innerHTML = `
        <strong>Fuel:</strong> ${fuelPriority}% | 
        <strong>Time:</strong> ${timePriority}% | 
        <strong>Congestion:</strong> ${congestionPriority}%
    `;
}

function getOptimizationWeights() {
    return {
        fuel: fuelPriority,
        time: timePriority,
        congestion: congestionPriority
    };
}
// --- AIS SHIP MOVEMENT VISUALIZATION ---
/**
 * Vessel type colors for AIS ship markers
 */
const vesselColors = {
    'cargo': '#FF6B6B',
    'tanker': '#4ECDC4',
    'passenger': '#45B7D1',
    'fishing': '#FFA07A',
    'tug': '#98D8C8',
    'default': '#00d4ff'
};

/**
 * Load AIS ship movement data from JSON file
 */
async function loadAISShipData() {
    try {
        const response = await fetch('../data/ais_processed.json');
        if (!response.ok) {
            console.warn('AIS data not available. Ship movements will not be displayed.');
            return;
        }
        aisData = await response.json();
        console.log('✓ Loaded AIS ship data:', aisData.metadata);

    } catch (error) {
        console.warn('Failed to load AIS ship data:', error);
    }
}

/**
 * Get color for vessel based on type
 */
function getVesselColor(vesselType) {
    const type = vesselType.toLowerCase();
    for (const [key, color] of Object.entries(vesselColors)) {
        if (type.includes(key)) {
            return color;
        }
    }
    return vesselColors.default;
}

/**
 * Display or hide ship movements on the map
 */
function toggleShipMovements(show) {
    if (show && aisData) {
        displayShipMovements();
    } else {
        clearShipMovements();
    }
}

/**
 * Display all ship movements on the map
 */
function displayShipMovements() {
    if (!aisData || !aisData.vessels) return;

    clearShipMovements();

    aisData.vessels.forEach(vessel => {
        if (vessel.positions.length === 0) return;

        const color = getVesselColor(vessel.type);

        // Draw track if vessel has multiple positions
        if (vessel.positions.length > 1) {
            const trackPoints = vessel.positions.map(pos => [pos.lat, pos.lon]);
            const track = L.polyline(trackPoints, {
                color: color,
                weight: 2,
                opacity: 0.4
            }).addTo(map);
            vesselTrackLayers.push(track);
        }

        // Add vessel marker at last position
        const lastPos = vessel.positions[vessel.positions.length - 1];
        const marker = L.circleMarker([lastPos.lat, lastPos.lon], {
            radius: 5,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        // Create popup with vessel information
        const popupContent = `
            <div style="font-size: 12px;">
                <h4 style="margin: 0 0 8px 0; color: #00d4ff;">${vessel.name}</h4>
                <p style="margin: 3px 0;"><strong>MMSI:</strong> ${vessel.mmsi}</p>
                <p style="margin: 3px 0;"><strong>Type:</strong> ${vessel.type}</p>
                <p style="margin: 3px 0;"><strong>Speed:</strong> ${lastPos.sog.toFixed(1)} knots</p>
                <p style="margin: 3px 0;"><strong>Course:</strong> ${lastPos.cog.toFixed(1)}°</p>
                <p style="margin: 3px 0;"><strong>Position:</strong> ${lastPos.lat.toFixed(4)}°, ${lastPos.lon.toFixed(4)}°</p>
                <p style="margin: 3px 0;"><strong>Time:</strong> ${lastPos.time}</p>
            </div>
        `;
        marker.bindPopup(popupContent);

        vesselLayers.push(marker);
    });

    console.log(`✓ Displayed ${vesselLayers.length} ships with ${vesselTrackLayers.length} tracks`);
}

/**
 * Clear all ship movements from the map
 */
function clearShipMovements() {
    vesselLayers.forEach(layer => map.removeLayer(layer));
    vesselTrackLayers.forEach(layer => map.removeLayer(layer));
    vesselLayers = [];
    vesselTrackLayers = [];
}

/**
 * Renders the saved optimization results into an HTML table.
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
            option.dataset.id = port.id; // ADD THIS LINE
            option.dataset.latitude = port.latitude;
            option.dataset.longitude = port.longitude;
            option.dataset.country = port.country;
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
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control legend');
            container.innerHTML = `
                <div style="background: rgba(255,255,255,0.9); padding: 10px; border-radius: 4px; font-size: 12px; min-width: 200px;">
                    <h6 style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Marine Zones & Weather</h6>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #42B7B7; margin-right: 8px;"></span><span>200 NM</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #C2DADA; margin-right: 8px;"></span><span>Territorial Sea (12 NM)</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #E57373; margin-right: 8px;"></span><span>Overlapping Claim</span></div>
                    <hr>
                    <h6 style="margin: 8px 0; font-weight: bold; color: #333;">Cyclone Alert Levels</h6>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #dc3545; border-radius: 50%; margin-right: 8px;"></span><span>Red - High Danger</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #fd7e14; border-radius: 50%; margin-right: 8px;"></span><span>Orange - Medium Danger</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #ffc107; border-radius: 50%; margin-right: 8px;"></span><span>Yellow - Low Danger</span></div>
                    <div style="margin-bottom: 5px;"><span style="display: inline-block; width: 12px; height: 12px; background: #198754; border-radius: 50%; margin-right: 8px;"></span><span>Green - Minimal Danger</span></div>
                    <hr>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;"><input type="checkbox" id="wind-layer-toggle" checked style="margin-right: 8px;"><label for="wind-layer-toggle">Wind</label></div>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;"><input type="checkbox" id="wave-height-layer-toggle" checked style="margin-right: 8px;"><label for="wave-height-layer-toggle">Wave Height</label></div>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;"><input type="checkbox" id="cyclone-layer-toggle" checked style="margin-right: 8px;"><label for="cyclone-layer-toggle">Cyclones</label></div>
                    <hr>
                    <div style="display: flex; align-items: center;"><input type="checkbox" id="ship-movement-toggle" style="margin-right: 8px;"><label for="ship-movement-toggle">🚢 Ships</label></div>
                </div>`;
            L.DomEvent.disableClickPropagation(container);
            container.querySelector('#wind-layer-toggle').addEventListener('change', e => map.hasLayer(windLayer) ? map.removeLayer(windLayer) : map.addLayer(windLayer));
            container.querySelector('#wave-height-layer-toggle').addEventListener('change', e => map.hasLayer(waveHeightLayer) ? map.removeLayer(waveHeightLayer) : map.addLayer(waveHeightLayer));
            container.querySelector('#cyclone-layer-toggle').addEventListener('change', e => map.hasLayer(cycloneLayer) ? map.removeLayer(cycloneLayer) : map.addLayer(cycloneLayer));
            container.querySelector('#ship-movement-toggle').addEventListener('change', e => toggleShipMovements(e.target.checked));
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
        ["Route Sequence", `"${standardRoutePorts.map(p => p.name).join(' -> ')}"`, `"${optimizedRoutePorts.map(p => p.name).join(' -> ')}"`, "text"],
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