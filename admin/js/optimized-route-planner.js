import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, formatDate } from './modules/utils.js';
import { getSavedOptimizations, deleteOptimizationResult, getPorts } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

// Module-level variables
let map;
let optimizedRouteLayer = null; // To hold the map layer for the route
const route = {
    departure: null,
    arrivals: []
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    await loadLayout();

    setupPortSelectionListeners();
    
    document.getElementById('run-optimization').addEventListener('click', handleRunOptimization);

    // Standard initializations
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Page-specific initializations
    initializeMap();
    initializeSavedResults();
    populatePortDropdown('departure-port');
    populatePortDropdown('add-destination-port');
});


// --- PORT SELECTION LOGIC ---
function setupPortSelectionListeners() {
    const departureSelect = document.getElementById("departure-port");
    const destinationSelect = document.getElementById("add-destination-port");
    const addButton = document.getElementById("add-port-btn");

    departureSelect.addEventListener('change', () => {
        const selectedOption = departureSelect.options[departureSelect.selectedIndex];
        if (selectedOption && !selectedOption.disabled) {
            route.departure = {
                name: selectedOption.value,
                latitude: parseFloat(selectedOption.dataset.latitude),
                longitude: parseFloat(selectedOption.dataset.longitude)
            };
            console.log("Departure Port set:", route.departure);
            departureSelect.disabled = true;
            // NEW: Render the departure port as a badge
            renderRouteBadges(); 
        }
    });

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

            const isDuplicate = route.departure.name === newPort.name || route.arrivals.some(p => p.name === newPort.name);
            if (isDuplicate) {
                showAlert(`'${newPort.name}' is already in the route.`, "info");
                return;
            }
            route.arrivals.push(newPort);
            console.log("Arrival Ports:", route.arrivals);
            // NEW: Render all destination ports as badges
            renderRouteBadges();
        }
    });
}

/**
 * NEW: Renders the selected ports as badges in the UI.
 */
function renderRouteBadges() {
    const container = document.getElementById('destination-ports-container');
    container.innerHTML = ''; // Clear existing content

    // Create a badge for the departure port (if selected)
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

    // Add a placeholder if no destinations are added yet
    if (route.arrivals.length === 0) {
        if(route.departure) { // If departure is set but no arrivals
             const placeholder = document.createElement('span');
             placeholder.className = 'text-muted fst-italic ms-2';
             placeholder.textContent = 'Add a destination...';
             container.appendChild(placeholder);
        } else { // If nothing is set
            const placeholder = document.createElement('span');
            placeholder.className = 'text-muted fst-italic';
            placeholder.textContent = 'No destinations added yet.';
            container.appendChild(placeholder);
        }
    }

    // Add event listeners to the new remove buttons
    container.querySelectorAll('.btn-close').forEach(button => {
        button.addEventListener('click', (e) => {
            const portIndexToRemove = parseInt(e.target.dataset.index, 10);
            route.arrivals.splice(portIndexToRemove, 1); // Remove the port from the array
            renderRouteBadges(); // Re-render the badges
        });
    });
}


// --- OPTIMIZATION LOGIC ---
async function handleRunOptimization() {
    const runBtn = document.getElementById('run-optimization');
    const originalBtnText = runBtn.innerHTML;

    if (!route.departure || route.arrivals.length === 0) {
        showAlert("Please select a departure port and at least one arrival port.", "warning");
        return;
    }

    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Optimizing...';

    const standardRoutePorts = [route.departure, ...route.arrivals];
    const standardMetrics = calculateRouteMetrics(standardRoutePorts);
    const coordinates = standardRoutePorts.map(port => [port.latitude, port.longitude]);

    console.log("Sending coordinates to Python:", coordinates);

    try {
        const response = await fetch('http://127.0.0.1:5000/api/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('nauticalflow-token')}`
            },
            body: JSON.stringify({ route: coordinates })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Server responded with status: ${response.status}` }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log("Received result from Python:", result);
        showAlert('Optimization complete!', 'success');

        const orderedPorts = [route.departure];
        result.best_route_indices.forEach(index => {
            orderedPorts.push(route.arrivals[index - 1]);
        });
        
        updateComparisonTable(standardMetrics, result, standardRoutePorts, orderedPorts);
        drawOptimizedRoute(orderedPorts);

    } catch (error) {
        console.error("Optimization failed:", error);
        showAlert(`Optimization failed: ${error.message}`, 'danger');
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = originalBtnText;
    }
}


// --- CALCULATION HELPERS ---
function getEuclideanDistance(port1, port2) {
    const dx = port1.latitude - port2.latitude;
    const dy = port1.longitude - port2.longitude;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateRouteMetrics(portOrder) {
    const fuel_rate_per_km = 0.25;
    const emission_factor = 3.206;

    let totalDistance = 0;
    if (portOrder.length < 2) return { distance: 0, fuel: 0, co2: 0 };

    // From depot to first port
    totalDistance += getEuclideanDistance(portOrder[0], portOrder[1]);
    // Between intermediate ports
    for (let i = 1; i < portOrder.length - 1; i++) {
        totalDistance += getEuclideanDistance(portOrder[i], portOrder[i + 1]);
    }
    // From last port back to depot
    totalDistance += getEuclideanDistance(portOrder[portOrder.length - 1], portOrder[0]);

    const totalFuel = totalDistance * fuel_rate_per_km;
    const totalCO2 = totalFuel * emission_factor;
    return { distance: totalDistance, fuel: totalFuel, co2: totalCO2 };
}


// --- UI and MAP UPDATE FUNCTIONS ---
function updateComparisonTable(standardMetrics, optimizedResult, standardRoutePorts, optimizedRoutePorts) {
    const formatImprovement = (standard, optimized) => {
        if (standard === 0) return 'N/A';
        const improvement = ((standard - optimized) / standard) * 100;
        const sign = improvement >= 0 ? '' : '+'; // Inverted logic for savings
        const color = improvement >= 0 ? 'success' : 'danger';
        return `<span class="badge bg-${color}">-${improvement.toFixed(1)}%</span>`;
    };

    document.getElementById('standard-route-sequence').textContent = standardRoutePorts.map(p => p.name).join(' → ');
    document.getElementById('optimized-route-sequence').textContent = optimizedRoutePorts.map(p => p.name).join(' → ');
    document.getElementById('standard-fuel').textContent = standardMetrics.fuel.toFixed(2);
    document.getElementById('optimized-fuel').textContent = optimizedResult.fuel_liters.toFixed(2);
    document.getElementById('fuel-improvement').innerHTML = formatImprovement(standardMetrics.fuel, optimizedResult.fuel_liters);
    document.getElementById('standard-co2').textContent = standardMetrics.co2.toFixed(2);
    document.getElementById('optimized-co2').textContent = optimizedResult.co2_kg.toFixed(2);
    document.getElementById('co2-improvement').innerHTML = formatImprovement(standardMetrics.co2, optimizedResult.co2_kg);
    document.getElementById('standard-distance').textContent = standardMetrics.distance.toFixed(2);
    document.getElementById('optimized-distance').textContent = optimizedResult.distance_km.toFixed(2);
    document.getElementById('distance-improvement').innerHTML = formatImprovement(standardMetrics.distance, optimizedResult.distance_km);
}

function drawOptimizedRoute(orderedPorts) {
    if (optimizedRouteLayer) {
        map.removeLayer(optimizedRouteLayer);
    }

    const routePoints = [];
    const routeMarkers = [];

    orderedPorts.forEach((port, index) => {
        const point = [port.latitude, port.longitude];
        routePoints.push(point);

        let marker;
        if (index === 0) {
            const greenIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });
            marker = L.marker(point, { icon: greenIcon }).bindPopup(`<b>Start/End:</b> ${port.name}`);
        } else {
            marker = L.marker(point).bindPopup(`<b>Stop ${index}:</b> ${port.name}`);
        }
        routeMarkers.push(marker);
    });
    
    routePoints.push([orderedPorts[0].latitude, orderedPorts[0].longitude]);

    const routePolyline = L.polyline(routePoints, { color: 'blue', weight: 4, opacity: 0.8 });
    optimizedRouteLayer = L.layerGroup([...routeMarkers, routePolyline]);
    optimizedRouteLayer.addTo(map);
    map.fitBounds(routePolyline.getBounds().pad(0.1));
}


// --- EXISTING UI AND DATA FUNCTIONS ---
function initializeMap() {
    map = L.map('nautical-map').setView([4.5, 108], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap'
    }).addTo(map);
}

async function initializeSavedResults() {
    const savedResults = await getSavedOptimizations();
    renderSavedResultsTable(savedResults);
}

function renderSavedResultsTable(results) {
    const tableBody = document.getElementById('saved-results-body');
    tableBody.innerHTML = '';
    if (results.length === 0) {
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
        if (deleteBtn) {
            const row = deleteBtn.closest('tr');
            const resultId = row.dataset.resultId;
            if (confirm('Are you sure you want to delete this result?')) {
                await deleteOptimizationResult(resultId);
                row.remove();
                showAlert('Result deleted.', 'success');
            }
        }
    });
}

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