import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader, initializePagination, makeTableScrollable, initializeTableSearch, addSearchClearButton } from './modules/utils.js';
import { getFuelTypes, addFuelType, deleteFuelType, updateFuelType } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let fuelTypeModal;
let allFuelTypes = [];
let fuelTypePaginationController = null;  
let fuelTypeSearchController = null; 

toastr.options = toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-top-right",
    "preventDuplicates": true,
    "timeOut": "3000"
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();
    
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeFuelTypesPage();

    hideLoader();
});

async function initializeFuelTypesPage() {
    fuelTypeModal = new bootstrap.Modal(document.getElementById('fuelTypeModal'));
    await loadAndRenderFuelTypes();
    
    // Initialize search
    fuelTypeSearchController = initializeTableSearch(
        'fuel-type-search-input',
        allFuelTypes,
        ['name', 'co2Factor'], // Search in name and CO2 factor
        (filteredData) => {
            renderFuelTypesTable(filteredData);
        },
        {
            debounceDelay: 300,
            placeholder: 'Search fuel types...',
            showResultCount: true,
            minCharacters: 0
        }
    );
    
    // Add clear button to search
    addSearchClearButton('fuel-type-search-input', () => {
        renderFuelTypesTable(allFuelTypes);
    });
    
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
        
        // Make table scrollable (only once)
        makeTableScrollable('fuel-types-table', 400);
        
        // Update search controller with new data
        if (fuelTypeSearchController) {
            fuelTypeSearchController.setDataset(allFuelTypes);
        }
        
        renderFuelTypesTable(allFuelTypes);
    } catch (error) {
        toastr.error('Could not load fuel types.', 'Load Failed');
    }
}

function renderFuelTypesTable(fuelTypes) {
    const tableBody = document.querySelector('#fuel-types-table tbody');
    
    if (fuelTypes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center">No fuel types found.</td></tr>';
        // Destroy pagination if no data
        if (fuelTypePaginationController) {
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                paginationContainer.remove();
            }
            fuelTypePaginationController = null;
        }
        return;
    }

    // Render function for a page of data
    const renderPage = (pageData) => {
        tableBody.innerHTML = '';
        pageData.forEach(ft => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ft.name}</td>
                <td>${ft.co2Factor}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Fuel Type" data-bs-toggle="modal" data-bs-target="#fuelTypeModal" data-fuel-type-id="${ft.id}"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Fuel Type" data-fuel-type-id="${ft.id}"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Initialize or update pagination
    if (!fuelTypePaginationController) {
        fuelTypePaginationController = initializePagination(
            'fuel-types-table',
            fuelTypes,
            renderPage,
            {
                itemsPerPage: 10,
                showEntriesSelector: true,
                entriesOptions: [10, 25, 50, 100],
                showInfo: true,
                scrollToTop: true
            }
        );
    } else {
        fuelTypePaginationController.setData(fuelTypes);
    }

    // Initial render
    fuelTypePaginationController.render();
}

function handleModalOpen(event) {
    const button = event.relatedTarget;
    const fuelTypeId = button ? button.getAttribute('data-fuel-type-id') : null;
    const form = document.getElementById('fuelTypeForm');
    const modalTitle = document.getElementById('fuelTypeModalLabel');
    
    form.reset();
    document.getElementById('fuelTypeId').value = '';
    document.getElementById('co2Factor').value = '';

    if (fuelTypeId) {
        modalTitle.textContent = 'Edit Fuel Type';
        const ft = allFuelTypes.find(f => f.id == fuelTypeId);
        if (ft) {
            document.getElementById('fuelTypeId').value = ft.id;
            document.getElementById('fuelName').value = ft.name;
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
        co2Factor: document.getElementById('co2Factor').value,
    };
    
    if (!fuelTypeData.co2Factor) {
        toastr.warning('Please select a Fuel Category for IMO reporting.');
        return;
    }
    
    try {
        if (fuelTypeId) {
            await updateFuelType(fuelTypeId, fuelTypeData);
            toastr.success('Fuel type updated successfully!');
        } else {
            await addFuelType(fuelTypeData);
            toastr.success('Fuel type added successfully!');
        }
        fuelTypeModal.hide();
        loadAndRenderFuelTypes();
    } catch (error) {
        if (error.message && error.message.includes('already exists')) {
            toastr.error(error.message, 'Duplicate Entry');
        } else {
            toastr.error(`Failed to save fuel type. ${error.message}`, 'Save Failed');
        }
    }
}

async function handleTableActions(event) {
    const targetBtn = event.target.closest('button.delete-btn');
    if (!targetBtn) return;

    const fuelTypeId = targetBtn.dataset.fuelTypeId;
    const fuelTypeName = targetBtn.closest('tr').cells[0].textContent;

    Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete "${fuelTypeName}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteFuelType(fuelTypeId);
                toastr.success(`Fuel type "${fuelTypeName}" was deleted.`);
                loadAndRenderFuelTypes();
            } catch (error) {
                toastr.error('Failed to delete fuel type.', 'Delete Failed');
            }
        }
    });
}