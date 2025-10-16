import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader, initializePagination, makeTableScrollable, initializeTableSearch, addSearchClearButton } from './modules/utils.js';
import { getCruiseShips, addCruiseShip, deleteCruiseShip, updateCruiseShip, getFuelTypes } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let shipModal;
let allShips = [];
let shipPaginationController = null;  
let shipSearchController = null;   

// Simplified Archetype data, focused on GT ranges for auto-selection
const shipArchetypes = {
    "legacy-mid": { name: "Legacy Mid-Size (~70k-90k GT)", minGT: 70000, maxGT: 90000, hotelLoad: 1.2, curve: [{speed: 10, consumption: 1.2}, {speed: 14, consumption: 2.8}, {speed: 17, consumption: 5.0}, {speed: 19, consumption: 7.2}, {speed: 22, consumption: 10.5}] },
    "mid-diesel": { name: "Mid-Size Diesel-Electric (~90k-130k GT)", minGT: 90001, maxGT: 130000, hotelLoad: 1.8, curve: [{speed: 10, consumption: 1.0}, {speed: 14, consumption: 2.5}, {speed: 17, consumption: 4.5}, {speed: 19, consumption: 6.5}, {speed: 21, consumption: 9.0}] },
    "large-lng": { name: "Large Modern Ship (>130k GT)", minGT: 130001, maxGT: Infinity, hotelLoad: 2.8, curve: [{speed: 10, consumption: 1.5}, {speed: 15, consumption: 3.5}, {speed: 18, consumption: 6.0}, {speed: 20, consumption: 8.5}, {speed: 22, consumption: 12.0}] }
};

// Configure Toastr notifications for a consistent look and feel
toastr.options = {
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
    
    await initializeShipDataPage();
    hideLoader();
});

async function initializeShipDataPage() {
    shipModal = new bootstrap.Modal(document.getElementById('shipModal'));
    
    try {
        const [ships, fuelTypes] = await Promise.all([ getCruiseShips(), getFuelTypes() ]);
        allShips = ships;
        
        // Make table scrollable
        makeTableScrollable('vessel-data-table', 400);
        
        renderShipsTable(allShips);
        populateFuelTypeDropdown(fuelTypes);
        
        // Initialize search after data is loaded
        shipSearchController = initializeTableSearch(
            'ship-search-input',
            allShips,
            ['name', 'company', 'fuelTypeName'], // Search in name, company, and fuel type
            (filteredData) => {
                renderShipsTable(filteredData);
            },
            {
                debounceDelay: 300,
                placeholder: 'Search ships by name, company, or fuel type...',
                showResultCount: true,
                minCharacters: 0
            }
        );
        
        // Add clear button to search
        addSearchClearButton('ship-search-input', () => {
            renderShipsTable(allShips);
        });
        
    } catch (error) {
        toastr.error('Could not load initial page data.', 'Load Failed');
    }

    document.getElementById('shipForm').addEventListener('submit', handleSaveShip);
    document.querySelector('#vessel-data-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('shipModal').addEventListener('show.bs.modal', handleModalOpen);
}

// --- New "Smart Template" Logic ---

function getArchetypeForGT(gt) {
    for (const key in shipArchetypes) {
        const archetype = shipArchetypes[key];
        if (gt >= archetype.minGT && gt <= archetype.maxGT) {
            return archetype;
        }
    }
    return null;
}

function generateCurveFromArchetype(archetype) {
    if (!archetype) return [];
    const hotelLoad = archetype.hotelLoad;
    const finalCurve = [
        { speed: 0, consumption: hotelLoad },
        ...archetype.curve.map(p => ({
            speed: p.speed,
            consumption: p.consumption + hotelLoad
        }))
    ];
    return finalCurve;
}

// --- Main CRUD Functions ---

async function handleSaveShip(event) {
    event.preventDefault();
    const form = event.target;
    if (!form.checkValidity()) {
        toastr.warning('Please fill in all required fields.');
        return;
    }
    
    const shipId = document.getElementById('shipId').value;
    const grossTonnage = parseInt(document.getElementById('grossTonnage').value, 10);
    
    const selectedArchetype = getArchetypeForGT(grossTonnage);
    if (!selectedArchetype) {
        toastr.error(`No performance template available for a ship with ${grossTonnage} GT.`, 'Invalid Tonnage');
        return;
    }
    
    const shipData = {
        name: document.getElementById('shipName').value,
        company: document.getElementById('company').value,
        grossTonnage: grossTonnage,
        fuelTypeId: document.getElementById('fuelType').value,
        fuelConsumptionCurve: generateCurveFromArchetype(selectedArchetype)
    };

    try {
        if (shipId) {
            await updateCruiseShip(shipId, shipData);
            toastr.success('Cruise ship updated successfully!');
        } else {
            await addCruiseShip(shipData);
            toastr.success('Cruise ship added successfully!');
        }
        shipModal.hide();
        await loadAndRenderShips();
    } catch (error) {
        toastr.error(`Failed to save cruise ship. ${error.message}`, 'Save Failed');
    }
}

function handleModalOpen(event) {
    const button = event.relatedTarget;
    const shipId = button ? button.getAttribute('data-ship-id') : null;
    const form = document.getElementById('shipForm');
    const modalTitle = document.getElementById('shipModalLabel');
    
    if (shipId) {
        modalTitle.textContent = 'Edit Cruise Ship';
        const shipToEdit = allShips.find(s => s.id == shipId);
        if (shipToEdit) {
            document.getElementById('shipId').value = shipToEdit.id;
            document.getElementById('shipName').value = shipToEdit.name;
            document.getElementById('company').value = shipToEdit.company;
            document.getElementById('grossTonnage').value = shipToEdit.grossTonnage;
            document.getElementById('fuelType').value = shipToEdit.fuelTypeId;
        }
    } else {
        modalTitle.textContent = 'Add New Cruise Ship';
        form.reset();
        document.getElementById('shipId').value = '';
    }
}

async function loadAndRenderShips() {
    try {
        allShips = await getCruiseShips();
        
        // Make table scrollable (only once)
        makeTableScrollable('vessel-data-table', 400);
        
        // Update search controller with new data
        if (shipSearchController) {
            shipSearchController.setDataset(allShips);
        }
        
        renderShipsTable(allShips);
    } catch (error) {
        console.error('Error loading ships:', error);
        toastr.error('Could not load cruise ships.', 'Load Failed');
    }
}

function renderShipsTable(ships) {
    const tableBody = document.querySelector('#vessel-data-table tbody');
    
    if (ships.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No cruise ships found.</td></tr>';
        // Destroy pagination if no data
        if (shipPaginationController) {
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                paginationContainer.remove();
            }
            shipPaginationController = null;
        }
        return;
    }

    // Render function for a page of data
    const renderPage = (pageData) => {
        tableBody.innerHTML = '';
        pageData.forEach(ship => {
            const row = document.createElement('tr');
            row.dataset.shipId = ship.id;
            row.innerHTML = `
                <td>${ship.name}</td>
                <td>${ship.company || 'N/A'}</td>
                <td>${ship.grossTonnage.toLocaleString()}</td>
                <td>${ship.fuelTypeName}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Ship" data-bs-toggle="modal" data-bs-target="#shipModal" data-ship-id="${ship.id}"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Ship"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Initialize or update pagination
    if (!shipPaginationController) {
        shipPaginationController = initializePagination(
            'vessel-data-table',
            ships,
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
        shipPaginationController.setData(ships);
    }

    // Initial render
    shipPaginationController.render();
}

async function handleTableActions(event) {
    const targetBtn = event.target.closest('button');
    if (!targetBtn) return;
    
    const shipId = targetBtn.closest('tr').dataset.shipId;
    if (!shipId) return;
    
    if (targetBtn.classList.contains('delete-btn')) {
        const ship = allShips.find(s => s.id == shipId);
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete "${ship.name}". This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteCruiseShip(shipId);
                    toastr.success(`Ship "${ship.name}" was deleted.`);
                    await loadAndRenderShips();
                } catch (error) {
                    toastr.error('Failed to delete ship.', 'Delete Failed');
                }
            }
        });
    }
}

function populateFuelTypeDropdown(fuelTypes) {
    const select = document.getElementById('fuelType');
    select.innerHTML = '<option value="" disabled selected>Select a Fuel Type</option>';
    fuelTypes.forEach(ft => {
        const option = document.createElement('option');
        option.value = ft.id;
        option.textContent = ft.name;
        select.appendChild(option);
    });
}
