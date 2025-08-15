import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, formatDate } from './modules/utils.js';
import { runOptimization, getSavedOptimizations, saveOptimizationResult, deleteOptimizationResult } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

// Module-level variables to hold map and layer instances
let map;
const routeLayers = {};

document.addEventListener('DOMContentLoaded', async () => { 
    if (!checkAuth()) return;

     await loadLayout();

    // Standard initializations
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Page-specific initializations
    initializeMap();
    initializeControls();
    initializeSavedResults();
});

/**
 * Initializes the Leaflet map and its layers.
 */
function initializeMap() {
    map = L.map('nautical-map').setView([4.5, 108], 5); // Centered on Malaysia/Singapore region

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap'
    }).addTo(map);

    // Define sample route paths
    const routes = {
        fuel: [[6.1, 100.3], [1.35, 103.8]], // Langkawi to Singapore
        emissions: [[6.1, 100.3], [3.0, 101.4], [1.35, 103.8]], // Via Port Klang
        time: [[6.1, 100.3], [1.3, 102.5], [1.35, 103.8]] // More direct
    };
    
    // Create and store layers
    routeLayers.fuel = L.polyline(routes.fuel, { className: 'route-segment route-fuel' }).addTo(map);
    routeLayers.emissions = L.polyline(routes.emissions, { className: 'route-segment route-emissions' }).addTo(map);
    routeLayers.time = L.polyline(routes.time, { className: 'route-segment route-time' }).addTo(map);

    map.fitBounds(routeLayers.fuel.getBounds().pad(0.1));
}


/**
 * Sets up all interactive controls like sliders and buttons.
 */
function initializeControls() {
    const sliders = ['fuel-priority', 'time-priority', 'emissions-priority'];
    
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        slider.addEventListener('input', () => updateSliderValues(sliderId));
    });

    document.getElementById('run-optimization').addEventListener('click', handleRunOptimization);
}

/**
 * Updates slider value displays and normalizes them to always sum to 100.
 * @param {string} changedSliderId - The ID of the slider that was just moved.
 */
function updateSliderValues(changedSliderId) {
    const sliders = {
        fuel: document.getElementById('fuel-priority'),
        time: document.getElementById('time-priority'),
        emissions: document.getElementById('emissions-priority')
    };
    const values = {
        fuel: document.getElementById('fuel-value'),
        time: document.getElementById('time-value'),
        emissions: document.getElementById('emissions-value')
    };

    let total = 0;
    for (const key in sliders) {
        total += parseInt(sliders[key].value);
    }

    if (total > 0) {
        let remaining = 100 - parseInt(sliders[changedSliderId.split('-')[0]].value);
        let otherTotal = total - parseInt(sliders[changedSliderId.split('-')[0]].value);

        for (const key in sliders) {
            if (key !== changedSliderId.split('-')[0]) {
                const percentage = otherTotal > 0 ? parseInt(sliders[key].value) / otherTotal : 0.5;
                sliders[key].value = Math.round(remaining * percentage);
            }
        }

        // Final check to ensure it sums to 100
        let finalTotal = parseInt(sliders.fuel.value) + parseInt(sliders.time.value) + parseInt(sliders.emissions.value);
        if (finalTotal !== 100) {
            sliders.emissions.value = parseInt(sliders.emissions.value) + (100 - finalTotal);
        }
    }

    for (const key in sliders) {
        values[key].textContent = `${sliders[key].value}%`;
    }
}


/**
 * Handles the "Run Optimization" button click.
 */
async function handleRunOptimization() {
    const runBtn = document.getElementById('run-optimization');
    const originalBtnText = runBtn.innerHTML;

    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Optimizing...';
    
    // Gather parameters
    const params = {
        departure: document.getElementById('departure-port').selectedOptions[0].text,
        arrival: document.getElementById('arrival-port').selectedOptions[0].text,
        vessel: document.getElementById('vessel-name').selectedOptions[0].text,
        priorities: {
            fuel: parseInt(document.getElementById('fuel-priority').value),
            time: parseInt(document.getElementById('time-priority').value),
            emissions: parseInt(document.getElementById('emissions-priority').value)
        }
    };

    try {
        const result = await runOptimization(params);
        showAlert('Optimization complete!', 'success');
        updateComparisonTable(result);
        await saveOptimizationResult(result);
        await initializeSavedResults(); // Refresh the saved results table
    } catch (error) {
        showAlert('An error occurred during optimization.', 'danger');
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = originalBtnText;
    }
}

/**
 * Updates the comparison table with new optimization data.
 * @param {Object} result - The result from the optimization process.
 */
function updateComparisonTable(result) {
    const tableBody = document.querySelector('.comparison-table tbody');
    // For this demo, we'll just update the first row for fuel.
    // A real implementation would update all rows based on the detailed result.
    const fuelRow = tableBody.rows[0].cells;
    fuelRow[2].textContent = `Saved ${result.fuelSaved}`;
    fuelRow[3].querySelector('.badge').textContent = result.fuelSaved;
}

/**
 * Fetches and displays the saved optimization results.
 */
async function initializeSavedResults() {
    const savedResults = await getSavedOptimizations();
    renderSavedResultsTable(savedResults);

    // Event listener for the refresh button
    document.getElementById('refresh-saved-results').addEventListener('click', initializeSavedResults);
}

/**
 * Renders the saved results data into its table.
 * @param {Array<Object>} results - An array of saved optimization results.
 */
function renderSavedResultsTable(results) {
    const tableBody = document.getElementById('saved-results-body');
    tableBody.innerHTML = ''; // Clear existing rows

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

    // Use event delegation for delete buttons
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