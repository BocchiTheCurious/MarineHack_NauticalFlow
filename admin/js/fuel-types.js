// js/fuel-types.js

import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getFuelTypes, addFuelType, deleteFuelType, updateFuelType } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let fuelTypeModal;
let allFuelTypes = []; // Cache the fuel types to get data for editing

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();
    
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeFuelTypesPage();
});

async function initializeFuelTypesPage() {
    fuelTypeModal = new bootstrap.Modal(document.getElementById('fuelTypeModal'));
    
    await loadAndRenderFuelTypes();

    document.getElementById('fuelTypeForm').addEventListener('submit', handleSaveFuelType);
    document.querySelector('#fuel-types-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('fuelTypeModal').addEventListener('show.bs.modal', handleModalOpen);
    
    document.getElementById('fuelCategory').addEventListener('change', (e) => {
        document.getElementById('co2Factor').value = e.target.value;
    });
}

async function loadAndRenderFuelTypes() {
    try {
        allFuelTypes = await getFuelTypes();
        renderFuelTypesTable(allFuelTypes);
    } catch (error) {
        showAlert('Could not load fuel types.', 'danger');
    }
}

/**
 * Renders the fuel types data into the main table.
 * @param {Array<Object>} fuelTypes - The array of fuel type objects to display.
 */
function renderFuelTypesTable(fuelTypes) {
    const tableBody = document.querySelector('#fuel-types-table tbody');
    tableBody.innerHTML = '';
    
    if (fuelTypes.length === 0) {
        // Corrected colspan to 6 to match the headers
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No fuel types found.</td></tr>';
        return;
    }
    
    fuelTypes.forEach(ft => {
        const row = document.createElement('tr');
        const originalCostDisplay = ft.originalCurrency === 'MYR' ? `(MYR ${ft.originalCost})` : '';
        
        // ======================================================
        // === THE FIX IS HERE ==================================
        // The order of <td> elements now matches the <thead>
        // and the missing Price Date has been added.
        // ======================================================
        row.innerHTML = `
            <td>${ft.name}</td>
            <td>${ft.bunkeringPort || 'N/A'}</td>
            <td>$${ft.costPerTon} <small class="text-muted">${originalCostDisplay}</small></td>
            <td>${ft.priceDate || 'N/A'}</td>
            <td>${ft.co2Factor}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Fuel Type" data-bs-toggle="modal" data-bs-target="#fuelTypeModal" data-fuel-type-id="${ft.id}">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Fuel Type" data-fuel-type-id="${ft.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


function handleModalOpen(event) {
    const button = event.relatedTarget;
    const fuelTypeId = button ? button.getAttribute('data-fuel-type-id') : null;
    const form = document.getElementById('fuelTypeForm');
    const modalTitle = document.getElementById('fuelTypeModalLabel');
    
    form.reset();
    document.getElementById('fuelTypeId').value = '';
    document.getElementById('priceDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('co2Factor').value = '';

    if (fuelTypeId) {
        modalTitle.textContent = 'Edit Fuel Type';
        const ft = allFuelTypes.find(f => f.id == fuelTypeId);
        if (ft) {
            document.getElementById('fuelTypeId').value = ft.id;
            document.getElementById('fuelName').value = ft.name;
            document.getElementById('cost').value = ft.originalCurrency === 'MYR' ? ft.originalCost : ft.costPerTon;
            document.getElementById('currency').value = ft.originalCurrency || 'USD';
            document.getElementById('priceDate').value = ft.priceDate;
            document.getElementById('bunkeringPort').value = ft.bunkeringPort;
            document.getElementById('fuelCategory').value = ft.co2Factor;
            document.getElementById('co2Factor').value = ft.co2Factor;
        }
    } else {
        modalTitle.textContent = 'Add New Fuel Type';
    }
}

async function handleSaveFuelType(event) {
    event.preventDefault();
    const fuelTypeId = document.getElementById('fuelTypeId').value;
    const fuelTypeData = {
        name: document.getElementById('fuelName').value,
        cost: document.getElementById('cost').value,
        currency: document.getElementById('currency').value,
        priceDate: document.getElementById('priceDate').value,
        bunkeringPort: document.getElementById('bunkeringPort').value,
        co2Factor: document.getElementById('co2Factor').value,
    };
    
    if (!fuelTypeData.co2Factor) {
        showAlert('Please select a Fuel Category for IMO reporting.', 'warning');
        return;
    }
    
    try {
        if (fuelTypeId) {
            await updateFuelType(fuelTypeId, fuelTypeData);
            showAlert('Fuel type updated successfully!', 'success');
        } else {
            await addFuelType(fuelTypeData);
            showAlert('Fuel type added successfully!', 'success');
        }
        fuelTypeModal.hide();
        loadAndRenderFuelTypes();
    } catch (error) {
        showAlert(`Failed to save fuel type. ${error.message}`, 'danger');
    }
}

async function handleTableActions(event) {
    const targetBtn = event.target.closest('button.delete-btn');
    if (!targetBtn) return;

    const fuelTypeId = targetBtn.dataset.fuelTypeId;
    const fuelTypeName = targetBtn.closest('tr').cells[0].textContent;

    if (confirm(`Are you sure you want to delete "${fuelTypeName}"?`)) {
        await deleteFuelType(fuelTypeId);
        showAlert(`Fuel type "${fuelTypeName}" deleted.`, 'success');
        loadAndRenderFuelTypes();
    }
}