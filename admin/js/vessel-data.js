import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getCruiseShips, addCruiseShip, deleteCruiseShip, updateCruiseShip, getFuelTypes } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

// --- State and Configuration Variables ---
let shipModal;
let allShips = [];
let currentCurveData = [];
let chartInstance;

const shipArchetypes = {
    "large-lng": { name: "Large LNG Cruise Ship (~180,000 GT)", hotelLoad: 2.8, curve: [{speed: 10, consumption: 1.5}, {speed: 15, consumption: 3.5}, {speed: 18, consumption: 6.0}, {speed: 20, consumption: 8.5}, {speed: 22, consumption: 12.0}] },
    "mid-diesel": { name: "Mid-Size Diesel-Electric Ship (~90,000 GT)", hotelLoad: 1.8, curve: [{speed: 10, consumption: 1.0}, {speed: 14, consumption: 2.5}, {speed: 17, consumption: 4.5}, {speed: 19, consumption: 6.5}, {speed: 21, consumption: 9.0}] },
    "legacy-mid": { name: "Legacy Mid-Size Ship (~70,000 GT)", hotelLoad: 1.2, curve: [{speed: 10, consumption: 1.2}, {speed: 14, consumption: 2.8}, {speed: 17, consumption: 5.0}, {speed: 19, consumption: 7.2}, {speed: 22, consumption: 10.5}] }
};

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();
    
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();
    
    initializeShipDataPage();
});

async function initializeShipDataPage() {
    shipModal = new bootstrap.Modal(document.getElementById('shipModal'));
    
    try {
        const [ships, fuelTypes] = await Promise.all([ getCruiseShips(), getFuelTypes() ]);
        allShips = ships;
        renderShipsTable(allShips);
        populateFuelTypeDropdown(fuelTypes);
        populateArchetypeDropdown();
    } catch (error) {
        showAlert('Could not load initial page data.', 'danger');
    }

    setupEventListeners();
    initializeChart();
}

function setupEventListeners() {
    document.getElementById('shipForm').addEventListener('submit', handleSaveShip);
    document.querySelector('#vessel-data-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('shipModal').addEventListener('show.bs.modal', handleModalOpen);

    // Tier 1
    document.getElementById('shipArchetype').addEventListener('change', handleArchetypeSelect);
    // Tier 2
    document.getElementById('add-curve-point-btn').addEventListener('click', handleAddCurvePoint);
    document.getElementById('fuel-curve-tbody').addEventListener('click', handleDeleteCurvePoint);
    document.getElementById('hotelLoad').addEventListener('input', renderCurveTable);
    // Tier 3
    document.getElementById('generate-curve-btn').addEventListener('click', handleGenerateCurve);
}

// --- Tiered UI and Data Entry Logic ---

function handleArchetypeSelect(event) {
    const archetypeKey = event.target.value;
    if (!archetypeKey) return;

    const template = shipArchetypes[archetypeKey];
    document.getElementById('hotelLoad').value = template.hotelLoad;
    currentCurveData = template.curve;
    renderCurveTable();
    showAlert(`Template for "${template.name}" loaded. You can now fine-tune the data.`, 'info');
}

function handleAddCurvePoint() {
    const speedInput = document.getElementById('curveSpeed');
    const consumptionInput = document.getElementById('curveConsumption');
    const speed = parseFloat(speedInput.value);
    const propulsionConsumption = parseFloat(consumptionInput.value);

    if (isNaN(speed) || isNaN(propulsionConsumption) || speed <= 0 || propulsionConsumption < 0) {
        showAlert('Please enter valid, positive numbers for speed and propulsion consumption.', 'warning');
        return;
    }
    
    currentCurveData.push({ speed, consumption: propulsionConsumption });
    currentCurveData.sort((a, b) => a.speed - b.speed);

    renderCurveTable();
    speedInput.value = '';
    consumptionInput.value = '';
    speedInput.focus();
}

function handleGenerateCurve() {
    const gt = parseFloat(document.getElementById('genGrossTonnage').value);
    const power = parseFloat(document.getElementById('genTotalPower').value);
    const speed = parseFloat(document.getElementById('genDesignSpeed').value);

    if (isNaN(gt) || isNaN(power) || isNaN(speed)) {
        showAlert('Please enter all three technical parameters to generate a curve.', 'warning');
        return;
    }
    
    const hotelLoad = (gt / 75000).toFixed(2);
    document.getElementById('hotelLoad').value = hotelLoad;

    const refPower = power * 0.85; 
    
    currentCurveData = [];
    for (let i = 0.5; i <= 1.1; i += 0.1) {
        const currentSpeed = (speed * i).toFixed(1);
        const currentPower = refPower * Math.pow(currentSpeed / speed, 3);
        const consumption = (currentPower * 200 / 1000000).toFixed(2); 
        currentCurveData.push({ speed: parseFloat(currentSpeed), consumption: parseFloat(consumption) });
    }

    renderCurveTable();
    showAlert('Approximate curve generated based on your inputs.', 'info');
}

function handleDeleteCurvePoint(event) {
    const deleteBtn = event.target.closest('.delete-point-btn');
    if (deleteBtn) {
        currentCurveData.splice(parseInt(deleteBtn.dataset.index, 10), 1);
        renderCurveTable();
    }
}

// --- Modal and Form Handling ---

function handleModalOpen(event) {
    const button = event.relatedTarget;
    const shipId = button ? button.getAttribute('data-ship-id') : null;
    const form = document.getElementById('shipForm');
    const modalTitle = document.getElementById('shipModalLabel');
    
    form.reset();
    currentCurveData = [];
    document.getElementById('shipId').value = '';
    new bootstrap.Tab(document.getElementById('template-tab')).show();

    if (shipId) {
        modalTitle.textContent = 'Edit Cruise Ship';
        const shipToEdit = allShips.find(s => s.id == shipId);
        if (shipToEdit) {
            document.getElementById('shipId').value = shipToEdit.id;
            document.getElementById('shipName').value = shipToEdit.name;
            document.getElementById('fuelType').value = shipToEdit.fuelTypeId;
            
            const hotelLoad = shipToEdit.fuelConsumptionCurve.find(p => p.speed === 0)?.consumption || 0;
            document.getElementById('hotelLoad').value = hotelLoad;
            currentCurveData = shipToEdit.fuelConsumptionCurve.filter(p => p.speed > 0).map(p => ({
                speed: p.speed,
                consumption: p.consumption - hotelLoad
            }));
        }
    } else {
        modalTitle.textContent = 'Add New Cruise Ship';
    }
    renderCurveTable();
}

async function handleSaveShip(event) {
    event.preventDefault();
    const shipId = document.getElementById('shipId').value;
    const hotelLoad = parseFloat(document.getElementById('hotelLoad').value) || 0;

    const finalCurve = [
        { speed: 0, consumption: hotelLoad },
        ...currentCurveData.map(p => ({
            speed: p.speed,
            consumption: p.consumption + hotelLoad
        }))
    ];

    const shipData = {
        name: document.getElementById('shipName').value,
        fuelTypeId: document.getElementById('fuelType').value,
        fuelConsumptionCurve: finalCurve
    };
    
    // **COMPLETED LOGIC:** Added the try/catch/finally block for saving.
    const submitBtn = document.querySelector('#shipModal .modal-footer button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...`;

    try {
        if (shipId) {
            allShips = await updateCruiseShip(shipId, shipData);
            showAlert('Cruise ship updated successfully!', 'success');
        } else {
            allShips = await addCruiseShip(shipData);
            showAlert('Cruise ship added successfully!', 'success');
        }
        renderShipsTable(allShips);
        shipModal.hide();
    } catch (error) {
        showAlert(`Failed to save cruise ship. ${error.message}`, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// --- Charting and Table Rendering ---

function renderCurveTable() {
    const tbody = document.getElementById('fuel-curve-tbody');
    const hotelLoad = parseFloat(document.getElementById('hotelLoad').value) || 0;
    tbody.innerHTML = '';

    const displayData = [...currentCurveData];
    displayData.sort((a,b) => a.speed - b.speed);
    
    displayData.forEach((point, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${point.speed.toFixed(1)}</td>
            <td>${(point.consumption + hotelLoad).toFixed(2)}</td>
            <td><button type="button" class="btn btn-sm btn-outline-danger delete-point-btn" data-index="${index}"><i class="bi bi-x-circle"></i></button></td>
        `;
        tbody.appendChild(row);
    });
    updateChart();
}

function initializeChart() {
    const ctx = document.getElementById('curve-chart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Total Fuel Consumption (tons/hr)', data: [], borderColor: '#0d6efd', tension: 0.4, fill: false }] },
        options: { scales: { x: { title: { display: true, text: 'Speed (knots)' } }, y: { title: { display: true, text: 'Consumption (t/hr)' }, beginAtZero: true } } }
    });
}

function updateChart() {
    const hotelLoad = parseFloat(document.getElementById('hotelLoad').value) || 0;
    const displayData = [...currentCurveData];
    displayData.unshift({ speed: 0, consumption: 0 });
    displayData.sort((a,b) => a.speed - b.speed);

    chartInstance.data.labels = displayData.map(p => p.speed);
    chartInstance.data.datasets[0].data = displayData.map(p => p.consumption + hotelLoad);
    chartInstance.update();
}

// --- Main Table and Dropdown Population ---

function populateArchetypeDropdown() {
    const select = document.getElementById('shipArchetype');
    for (const key in shipArchetypes) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = shipArchetypes[key].name;
        select.appendChild(option);
    }
}

async function handleTableActions(event) {
    const targetBtn = event.target.closest('button');
    if (!targetBtn) return;
    
    const shipId = targetBtn.dataset.shipId;
    if (!shipId) return;
    
    const ship = allShips.find(s => s.id == shipId);

    if (targetBtn.classList.contains('delete-btn')) {
        if (confirm(`Are you sure you want to delete "${ship.name}"?`)) {
            await deleteCruiseShip(shipId);
            showAlert(`Ship "${ship.name}" deleted.`, 'success');
            allShips = await getCruiseShips();
            renderShipsTable(allShips);
        }
    } else if (targetBtn.classList.contains('view-curve-btn')) {
        const curveString = JSON.stringify(ship.fuelConsumptionCurve, null, 2);
        Swal.fire({
            title: `<strong>Curve for ${ship.name}</strong>`,
            html: `<pre class="text-start p-2 bg-light border rounded">${curveString}</pre>`,
            icon: 'info'
        });
    }
}

function renderShipsTable(ships) {
    const tableBody = document.querySelector('#vessel-data-table tbody');
    tableBody.innerHTML = '';
    if (ships.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center">No cruise ships found.</td></tr>';
        return;
    }
    ships.forEach(ship => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ship.name}</td>
            <td>${ship.fuelTypeName}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Ship" data-bs-toggle="modal" data-bs-target="#shipModal" data-ship-id="${ship.id}"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-info view-curve-btn" title="View Consumption Curve" data-ship-id="${ship.id}"><i class="bi bi-graph-up"></i></button>
                <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Ship" data-ship-id="${ship.id}"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}
function populateFuelTypeDropdown(fuelTypes) {
    const select = document.getElementById('fuelType');
    // **IMPROVEMENT:** Changed label to be more specific
    select.innerHTML = '<option value="" disabled selected>Select a Fuel Name</option>';
    fuelTypes.forEach(ft => {
        const option = document.createElement('option');
        option.value = ft.id;
        option.textContent = ft.name;
        select.appendChild(option);
    });
}