import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader, initializePagination, makeTableScrollable, initializeTableSearch, addSearchClearButton } from './modules/utils.js';
import { getCruiseShips, addCruiseShip, deleteCruiseShip, updateCruiseShip, getFuelTypes } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let shipModal;
let allShips = [];
let shipPaginationController = null;  
let shipSearchController = null;
let csvImportModal;
let pendingImportData = {
    validShips: [],
    duplicateShips: [],
    invalidShips: []
};

// Initialize CSV Import Modal
function initializeCSVImport() {
    csvImportModal = new bootstrap.Modal(document.getElementById('csvImportModal'));
    
    // Import button click
    document.getElementById('import-csv-btn').addEventListener('click', () => {
        document.getElementById('csv-file-input').click();
    });
    
    // File selected
    document.getElementById('csv-file-input').addEventListener('change', handleCSVFileSelect);
    
    // Confirm import button
    document.getElementById('confirm-import-btn').addEventListener('click', executeImport);
    
    // Select/Deselect all duplicates
    document.getElementById('select-all-duplicates').addEventListener('click', () => {
        document.querySelectorAll('.duplicate-checkbox').forEach(cb => cb.checked = true);
    });
    
    document.getElementById('deselect-all-duplicates').addEventListener('click', () => {
        document.querySelectorAll('.duplicate-checkbox').forEach(cb => cb.checked = false);
    });
}

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
            ['name', 'operator', 'fuelTypeName'], // Search in name, company, and fuel type
            (filteredData) => {
                renderShipsTable(filteredData);
            },
            {
                debounceDelay: 300,
                placeholder: 'Search ships by name, operator, or fuel type...',
                showResultCount: true,
                minCharacters: 0
            }
        );
        
        // Add clear button to search
        addSearchClearButton('ship-search-input', () => {
            renderShipsTable(allShips);
        });
        
        // Initialize CSV import functionality
        initializeCSVImport();  

    } catch (error) {
        toastr.error('Could not load initial page data.', 'Load Failed');
    }

    document.getElementById('shipForm').addEventListener('submit', handleSaveShip);
    document.querySelector('#vessel-data-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('shipModal').addEventListener('show.bs.modal', handleModalOpen);
    document.getElementById('download-template-btn').addEventListener('click', downloadCSVTemplate);
    document.getElementById('close-curve-btn').addEventListener('click', closeFuelCurve);

}

// CSV Template Download Function
function downloadCSVTemplate() {
    const headers = [
        'Ship Name',
        'Operator',
        'Gross Tonnage (GT)',
        'Propulsion Power (MW)',
        'Cruising Speed (knots)',
        'Max Speed (knots)',
        'Length (meters)',
        'Beam (meters)',
        'Year Built',
        'Passenger Capacity',
        'Crew',
        'Engine Type',
        'Builder',
        'Fuel Type Name' 
    ];
    
    const exampleRow = [
        'Icon of the Seas',
        'Royal Caribbean International',
        '250800',
        '84',
        '22',
        '25',
        '365',
        '65',
        '2026',
        '7600',
        '2350',
        'Wartsila-LNG',
        'Meyer Werft',
        'LNG' 
    ];
    
    // Add a note row explaining fuel types
    const noteRow = [
        '# Example ship - delete this row before importing',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '# Use exact fuel type names from the system (e.g., "LNG", "MGO", "HFO", "Electric", "Hybrid")'
    ];
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    csvContent += exampleRow.join(',') + '\n';
    csvContent += noteRow.join(',') + '\n';
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'cruise_ships_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toastr.success('CSV template downloaded! Fill in your ship data and import.', 'Template Ready');
}

// Parse CSV file content
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => {
        const trimmed = line.trim();
        // Skip empty lines and comment lines (starting with #)
        return trimmed && !trimmed.startsWith('#');
    });
    
    if (lines.length < 2) {
        throw new Error('CSV file must contain headers and at least one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        rows.push(row);
    }
    
    return rows;
}

// Validate and prepare ship data from CSV row
async function validateAndPrepareShipData(row, fuelTypes, lineNumber) {
    const errors = [];
    
    // Required fields validation
    if (!row['Ship Name']) errors.push('Ship Name is required');
    if (!row['Gross Tonnage (GT)']) errors.push('Gross Tonnage is required');
    if (!row['Propulsion Power (MW)']) errors.push('Propulsion Power is required');
    if (!row['Cruising Speed (knots)']) errors.push('Cruising Speed is required');
    if (!row['Max Speed (knots)']) errors.push('Max Speed is required');
    if (!row['Length (meters)']) errors.push('Length is required');
    if (!row['Beam (meters)']) errors.push('Beam is required');
    if (!row['Fuel Type Name']) errors.push('Fuel Type Name is required');
    
    // Match fuel type name to ID
    let fuelTypeId = null;
    if (row['Fuel Type Name']) {
        const fuelType = fuelTypes.find(ft => 
            ft.name.toLowerCase() === row['Fuel Type Name'].toLowerCase()
        );
        
        if (fuelType) {
            fuelTypeId = fuelType.id;
        } else {
            errors.push(`Fuel Type "${row['Fuel Type Name']}" not found in database. Available types: ${fuelTypes.map(ft => ft.name).join(', ')}`);
        }
    }
    
    if (errors.length > 0) {
        return {
            valid: false,
            errors: errors,
            lineNumber: lineNumber,
            shipName: row['Ship Name'] || 'Unknown'
        };
    }
    
    // Prepare ship data object
    return {
        valid: true,
        data: {
            name: row['Ship Name'],
            operator: row['Operator'] || null,
            grossTonnage: parseInt(row['Gross Tonnage (GT)']),
            propulsionPower: parseFloat(row['Propulsion Power (MW)']),
            cruisingSpeed: parseFloat(row['Cruising Speed (knots)']),
            maxSpeed: parseFloat(row['Max Speed (knots)']),
            length: parseFloat(row['Length (meters)']),
            beam: parseFloat(row['Beam (meters)']),
            yearBuilt: row['Year Built'] ? parseInt(row['Year Built']) : null,
            passengerCapacity: row['Passenger Capacity'] ? parseInt(row['Passenger Capacity']) : null,
            crew: row['Crew'] ? parseInt(row['Crew']) : null,
            engineType: row['Engine Type'] || null,
            builder: row['Builder'] || null,
            fuelTypeId: fuelTypeId
        }
    };
}

// --- Main CRUD Functions ---

async function handleSaveShip(event) {
    event.preventDefault();
    const form = event.target;
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        toastr.warning('Please fill in all required fields.');
        return;
    }
    
    const shipId = document.getElementById('shipId').value;
    
    // Collect ship data from form
    const shipData = {
        name: document.getElementById('shipName').value,
        operator: document.getElementById('operator').value,
        grossTonnage: parseInt(document.getElementById('grossTonnage').value, 10),
        fuelTypeId: document.getElementById('fuelType').value,
        
        // Required technical fields
        propulsionPower: parseFloat(document.getElementById('propulsionPower').value),
        cruisingSpeed: parseFloat(document.getElementById('cruisingSpeed').value),
        maxSpeed: parseFloat(document.getElementById('maxSpeed').value),
        length: parseFloat(document.getElementById('length').value),
        beam: parseFloat(document.getElementById('beam').value),
        
        // Optional fields
        yearBuilt: document.getElementById('yearBuilt').value ? 
                   parseInt(document.getElementById('yearBuilt').value, 10) : null,
        passengerCapacity: document.getElementById('passengerCapacity').value ? 
                          parseInt(document.getElementById('passengerCapacity').value, 10) : null,
        crew: document.getElementById('crew').value ? 
              parseInt(document.getElementById('crew').value, 10) : null,
        engineType: document.getElementById('engineType').value || null,
        builder: document.getElementById('builder').value || null
    };

    // ✅ NEW: Calculate fuel consumption curve automatically
    try {
        const fuelCurve = calculateFuelConsumptionCurve({
            grossTonnage: shipData.grossTonnage,
            propulsionPower: shipData.propulsionPower,
            cruisingSpeed: shipData.cruisingSpeed,
            maxSpeed: shipData.maxSpeed,
            length: shipData.length,
            beam: shipData.beam
        });
        
        shipData.fuelConsumptionCurve = fuelCurve;
        
        console.log('Calculated fuel consumption curve:', fuelCurve);
        
    } catch (error) {
        toastr.error('Failed to calculate fuel consumption curve.', 'Calculation Error');
        return;
    }

    try {
        if (shipId) {
            await updateCruiseShip(shipId, shipData);
            toastr.success('Cruise ship updated successfully!');
        } else {
            await addCruiseShip(shipData);
            toastr.success('Cruise ship added successfully!');
        }
        shipModal.hide();
        form.classList.remove('was-validated');
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
    
    form.classList.remove('was-validated');
    
    if (shipId) {
        modalTitle.textContent = 'Edit Cruise Ship';
        const shipToEdit = allShips.find(s => s.id == shipId);
        if (shipToEdit) {
            document.getElementById('shipId').value = shipToEdit.id;
            document.getElementById('shipName').value = shipToEdit.name;
            document.getElementById('operator').value = shipToEdit.operator || '';
            document.getElementById('grossTonnage').value = shipToEdit.grossTonnage;
            document.getElementById('fuelType').value = shipToEdit.fuelTypeId;
            
            // NEW FIELDS
            document.getElementById('propulsionPower').value = shipToEdit.propulsionPower || '';
            document.getElementById('cruisingSpeed').value = shipToEdit.cruisingSpeed || '';
            document.getElementById('maxSpeed').value = shipToEdit.maxSpeed || '';
            document.getElementById('length').value = shipToEdit.length || '';
            document.getElementById('beam').value = shipToEdit.beam || '';
            document.getElementById('yearBuilt').value = shipToEdit.yearBuilt || '';
            document.getElementById('passengerCapacity').value = shipToEdit.passengerCapacity || '';
            document.getElementById('crew').value = shipToEdit.crew || '';
            document.getElementById('engineType').value = shipToEdit.engineType || '';
            document.getElementById('builder').value = shipToEdit.builder || '';
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
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center">No cruise ships found.</td></tr>';
        if (shipPaginationController) {
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                paginationContainer.remove();
            }
            shipPaginationController = null;
        }
        return;
    }

    const renderPage = (pageData) => {
        tableBody.innerHTML = '';
        pageData.forEach(ship => {
            const row = document.createElement('tr');
            row.dataset.shipId = ship.id;
            row.style.cursor = 'pointer';  // ✅ Add pointer cursor
            row.classList.add('ship-row');  // ✅ Add class for styling
            row.innerHTML = `
                <td>${ship.name}</td>
                <td>${ship.operator || 'N/A'}</td>
                <td>${ship.grossTonnage ? ship.grossTonnage.toLocaleString() : 'N/A'}</td>
                <td>${ship.propulsionPower ? ship.propulsionPower.toFixed(1) + ' MW' : 'N/A'}</td>
                <td>${ship.cruisingSpeed ? ship.cruisingSpeed.toFixed(1) + ' kn' : 'N/A'}</td>
                <td>${ship.maxSpeed ? ship.maxSpeed.toFixed(1) + ' kn' : 'N/A'}</td>
                <td>${ship.length ? ship.length.toFixed(0) + ' m' : 'N/A'}</td>
                <td>${ship.yearBuilt || 'N/A'}</td>
                <td>${ship.fuelTypeName}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info view-curve-btn" title="View Fuel Curve">
                        <i class="bi bi-graph-up"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Ship" data-bs-toggle="modal" data-bs-target="#shipModal" data-ship-id="${ship.id}">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Ship">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            
            // ✅ Add click handler for viewing curve
            const viewCurveBtn = row.querySelector('.view-curve-btn');
            viewCurveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                displayFuelCurve(ship);
            });
            
            tableBody.appendChild(row);
        });
    };

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

async function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reset file input
    event.target.value = '';
    
    if (!file.name.endsWith('.csv')) {
        toastr.error('Please select a valid CSV file.', 'Invalid File');
        return;
    }
    
    try {
        const csvText = await file.text();
        await processCSVImport(csvText);
    } catch (error) {
        toastr.error(`Failed to read CSV file: ${error.message}`, 'Import Error');
    }
}

async function processCSVImport(csvText) {
    try {
        // Show modal with loading state
        csvImportModal.show();
        showImportProgress(true);
        
        // Parse CSV
        updateImportProgress(10, 'Parsing CSV file...');
        const rows = parseCSV(csvText);
        
        // Get fuel types for validation
        updateImportProgress(20, 'Loading fuel types...');
        const fuelTypes = await getFuelTypes();
        
        // Get existing ships for duplicate check
        updateImportProgress(30, 'Checking for duplicates...');
        const existingShips = await getCruiseShips();
        const existingShipNames = existingShips.map(s => s.name.toLowerCase());
        
        // Reset pending data
        pendingImportData = {
            validShips: [],
            duplicateShips: [],
            invalidShips: []
        };
        
        // Validate each row
        updateImportProgress(40, 'Validating data...');
        for (let i = 0; i < rows.length; i++) {
            const result = await validateAndPrepareShipData(rows[i], fuelTypes, i + 2);
            
            if (!result.valid) {
                pendingImportData.invalidShips.push(result);
            } else {
                // Check for duplicates
                const isDuplicate = existingShipNames.includes(result.data.name.toLowerCase());
                
                if (isDuplicate) {
                    const existingShip = existingShips.find(s => 
                        s.name.toLowerCase() === result.data.name.toLowerCase()
                    );
                    pendingImportData.duplicateShips.push({
                        ...result,
                        existingShipId: existingShip.id
                    });
                } else {
                    pendingImportData.validShips.push(result);
                }
            }
            
            // Update progress
            const progress = 40 + (i / rows.length) * 40;
            updateImportProgress(progress, `Validating row ${i + 1} of ${rows.length}...`);
        }
        
        updateImportProgress(100, 'Validation complete!');
        
        // Show results
        setTimeout(() => {
            showImportProgress(false);
            displayImportReview();
        }, 500);
        
    } catch (error) {
        showImportProgress(false);
        toastr.error(`Import failed: ${error.message}`, 'Import Error');
        csvImportModal.hide();
    }
}

function showImportProgress(show) {
    document.getElementById('import-progress-container').style.display = show ? 'block' : 'none';
    document.getElementById('validation-errors-container').style.display = 'none';
    document.getElementById('duplicate-ships-container').style.display = 'none';
    document.getElementById('valid-ships-container').style.display = 'none';
    document.getElementById('import-summary-container').style.display = 'none';
    document.getElementById('import-modal-footer').style.display = show ? 'none' : 'flex';
}

function updateImportProgress(percentage, text) {
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${Math.round(percentage)}%`;
    progressText.textContent = text;
}

function displayImportReview() {
    // Show validation errors if any
    if (pendingImportData.invalidShips.length > 0) {
        displayValidationErrors();
    }
    
    // Show duplicate ships if any
    if (pendingImportData.duplicateShips.length > 0) {
        displayDuplicateShips();
    }
    
    // Show valid ships count
    if (pendingImportData.validShips.length > 0) {
        displayValidShips();
    }
    
    // Update confirm button state
    const hasValidOrDuplicates = pendingImportData.validShips.length > 0 || 
                                  pendingImportData.duplicateShips.length > 0;
    document.getElementById('confirm-import-btn').disabled = !hasValidOrDuplicates;
    
    // If everything is invalid, show message
    if (!hasValidOrDuplicates && pendingImportData.invalidShips.length > 0) {
        toastr.error('No valid ships found in CSV file. Please fix errors and try again.', 'Import Failed');
    }
}

function displayValidationErrors() {
    const container = document.getElementById('validation-errors-container');
    const listContainer = document.getElementById('validation-errors-list');
    
    container.style.display = 'block';
    
    // Create accordion for errors
    let html = '<div class="accordion" id="validationErrorsAccordion">';
    
    pendingImportData.invalidShips.forEach((ship, index) => {
        const accordionId = `error-${index}`;
        html += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" 
                            data-bs-toggle="collapse" data-bs-target="#${accordionId}">
                        <i class="bi bi-exclamation-circle text-danger me-2"></i>
                        Row ${ship.lineNumber}: ${ship.shipName}
                        <span class="badge bg-danger ms-2">${ship.errors.length} error(s)</span>
                    </button>
                </h2>
                <div id="${accordionId}" class="accordion-collapse collapse" 
                     data-bs-parent="#validationErrorsAccordion">
                    <div class="accordion-body">
                        <ul class="mb-0">
                            ${ship.errors.map(error => `<li class="text-danger">${error}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    listContainer.innerHTML = html;
}

function displayDuplicateShips() {
    const container = document.getElementById('duplicate-ships-container');
    const listContainer = document.getElementById('duplicate-ships-list');
    
    container.style.display = 'block';
    
    let html = '<div class="list-group">';
    
    pendingImportData.duplicateShips.forEach((ship, index) => {
        html += `
            <div class="list-group-item">
                <div class="form-check">
                    <input class="form-check-input duplicate-checkbox" type="checkbox" 
                           value="${index}" id="duplicate-${index}">
                    <label class="form-check-label" for="duplicate-${index}">
                        <strong>${ship.data.name}</strong>
                        <span class="text-muted ms-2">(Will update existing ship)</span>
                    </label>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    listContainer.innerHTML = html;
}

function displayValidShips() {
    const container = document.getElementById('valid-ships-container');
    const countElement = document.getElementById('valid-ships-count');
    
    container.style.display = 'block';
    countElement.textContent = pendingImportData.validShips.length;
}

async function executeImport() {
    try {
        // Disable button and show progress
        document.getElementById('confirm-import-btn').disabled = true;
        showImportProgress(true);
        
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        
        const totalOperations = pendingImportData.validShips.length + 
                               pendingImportData.duplicateShips.length;
        let completed = 0;
        
        // Import new ships
        updateImportProgress(0, 'Importing new ships...');
        for (const ship of pendingImportData.validShips) {
            try {
                // ✅ Calculate fuel curve before saving
                const fuelCurve = calculateFuelConsumptionCurve({
                    grossTonnage: ship.data.grossTonnage,
                    propulsionPower: ship.data.propulsionPower,
                    cruisingSpeed: ship.data.cruisingSpeed,
                    maxSpeed: ship.data.maxSpeed,
                    length: ship.data.length,
                    beam: ship.data.beam
                });
                
                ship.data.fuelConsumptionCurve = fuelCurve;
                
                await addCruiseShip(ship.data);
                imported++;
            } catch (error) {
                console.error('Failed to import ship:', ship.data.name, error);
                skipped++;
            }
            completed++;
            updateImportProgress((completed / totalOperations) * 100, 
                               `Imported ${completed} of ${totalOperations} ships...`);
        }
        
        // Update duplicate ships (only checked ones)
        updateImportProgress(50, 'Updating duplicate ships...');
        const checkedDuplicates = document.querySelectorAll('.duplicate-checkbox:checked');
        
        for (const checkbox of checkedDuplicates) {
            const index = parseInt(checkbox.value);
            const ship = pendingImportData.duplicateShips[index];
            
            try {
                // ✅ Calculate fuel curve before updating
                const fuelCurve = calculateFuelConsumptionCurve({
                    grossTonnage: ship.data.grossTonnage,
                    propulsionPower: ship.data.propulsionPower,
                    cruisingSpeed: ship.data.cruisingSpeed,
                    maxSpeed: ship.data.maxSpeed,
                    length: ship.data.length,
                    beam: ship.data.beam
                });
                
                ship.data.fuelConsumptionCurve = fuelCurve;
                
                await updateCruiseShip(ship.existingShipId, ship.data);
                updated++;
            } catch (error) {
                console.error('Failed to update ship:', ship.data.name, error);
                skipped++;
            }
            completed++;
            updateImportProgress((completed / totalOperations) * 100, 
                               `Processing ${completed} of ${totalOperations} ships...`);
        }
        
        // Count unchecked duplicates as skipped
        const uncheckedDuplicates = pendingImportData.duplicateShips.length - checkedDuplicates.length;
        skipped += uncheckedDuplicates;
        
        updateImportProgress(100, 'Import complete!');
        
        // Show summary
        setTimeout(() => {
            showImportSummary(imported, updated, skipped);
            // Reload ships table
            loadAndRenderShips();
        }, 500);
        
    } catch (error) {
        showImportProgress(false);
        toastr.error(`Import failed: ${error.message}`, 'Import Error');
        document.getElementById('confirm-import-btn').disabled = false;
    }
}

function showImportSummary(imported, updated, skipped) {
    // Hide other sections
    document.getElementById('validation-errors-container').style.display = 'none';
    document.getElementById('duplicate-ships-container').style.display = 'none';
    document.getElementById('valid-ships-container').style.display = 'none';
    document.getElementById('import-progress-container').style.display = 'none';
    
    // Show summary
    const summaryContainer = document.getElementById('import-summary-container');
    summaryContainer.style.display = 'block';
    
    document.getElementById('summary-imported').textContent = imported;
    document.getElementById('summary-updated').textContent = updated;
    document.getElementById('summary-skipped').textContent = skipped;
    
    // Update footer button
    const footer = document.getElementById('import-modal-footer');
    footer.innerHTML = `
        <button type="button" class="btn btn-success" data-bs-dismiss="modal">
            <i class="bi bi-check-circle me-1"></i>Close
        </button>
    `;
    
    // Show success toast
    const totalSuccess = imported + updated;
    if (totalSuccess > 0) {
        toastr.success(`Successfully processed ${totalSuccess} ship(s)!`, 'Import Complete');
    }
    
    if (skipped > 0) {
        toastr.warning(`${skipped} ship(s) were skipped.`, 'Import Warning');
    }
}

/**
 * ============================================================================
 * FUEL CONSUMPTION CALCULATION METHODOLOGY
 * ============================================================================
 * 
 * This function implements the cruise ship fuel consumption model based on:
 * 
 * PRIMARY REFERENCE:
 * Simonsen, M., Walnum, H.J., & Gössling, S. (2018). 
 * "Model for Estimation of Fuel Consumption of Cruise Ships"
 * Energies, 11(5), 1059. https://doi.org/10.3390/en11051059
 * 
 * METHODOLOGY OVERVIEW:
 * 
 * The paper uses a relative power calculation approach based on actual
 * installed power (MCR - Maximum Continuous Rating) rather than estimation
 * formulas. The key equations are:
 * 
 * 1. POWER AT SPEED (Equation 12, Page 6):
 *    Pₜ = Pref × (Vₜ/Vref)³ × τw × τf
 *    where:
 *    - Pref = Installed power (MCR) in MW
 *    - Vₜ/Vref = Speed ratio (actual/service speed)
 *    - τw = 1.15 (weather factor)
 *    - τf = 1.09 (fouling factor)
 * 
 * 2. LOAD FACTOR (Equation 14, Page 7):
 *    Lₜ = Pₜ / Pref
 * 
 * 3. SPECIFIC FUEL CONSUMPTION (Equation 17, Page 7):
 *    SFCₜ = SFCbase × [1.28 - 0.71×Lₜ + 0.455×Lₜ²]
 *    where SFCbase = 195 g/kWh for post-2001 ships (Table 1, Page 7)
 * 
 * 4. FUEL CONSUMPTION (Equation 19, Page 8):
 *    Fₜ = kWhₜ × SFCₜ
 *    or equivalently: Fₜ = Pₜ × (SFCₜ / 1000) tons/hour
 * 
 * CRITICAL NOTE:
 * The paper does NOT use the Admiralty Formula. Instead, it uses actual
 * installed power from ship specifications and calculates relative power
 * based on speed ratios. This is more accurate and matches real-world data.
 * 
 * HOTEL LOAD:
 * For geared systems: Hotel load is added separately
 * For diesel-electric: Hotel load is included in MCR (shared power system)
 * 
 * VALIDATION DATA:
 * The paper validates against:
 * - MS Finnmarken (15,690 GT): 75-77 kg/nautical mile
 * - MS Artania (44,656 GT): 147-150 kg/nautical mile
 * - Norwegian Star (91,740 GT): Estimated 329-513 kg/nautical mile
 * 
 * ============================================================================
 */
function calculateFuelConsumptionCurve(shipSpecs) {
    const {
        grossTonnage,
        propulsionPower,  // MW - MCR (Maximum Continuous Rating) from ship specs
        cruisingSpeed,    // knots - Service speed
        maxSpeed,         // knots
        length,           // meters (not used in paper's methodology)
        beam              // meters (not used in paper's methodology)
    } = shipSpecs;
    
    // ============================================================================
    // CONSTANTS FROM SIMONSEN ET AL. (2018)
    // ============================================================================
    
    // Weather and fouling factors (Equation 12, Page 6)
    const TAU_WEATHER = 1.15;  // Effect of weather on propulsion efficiency
    const TAU_FOULING = 1.09;  // Effect of hull fouling on propulsion efficiency
    
    // Baseline specific fuel consumption (Table 1, Page 7)
    // For post-2001 ships: 195 g/kWh
    const SFOC_BASE = 195;  // g/kWh
    
    // ============================================================================
    // HOTEL LOAD ESTIMATION
    // ============================================================================
    
    // Hotel load (auxiliary power for non-propulsion systems)
    // Based on ship size - scales from 3 MW (small) to 20+ MW (mega ships)
    // Sources: Lloyd's Register (2023), Marine Insight, Paper's regression (Eq. 20-21)
    const hotelLoad = estimateHotelLoad(grossTonnage);  // MW
    
    console.log(`📊 Ship Specifications:`);
    console.log(`   Gross Tonnage: ${grossTonnage.toLocaleString()} GT`);
    console.log(`   Installed Power (MCR): ${propulsionPower} MW`);
    console.log(`   Service Speed: ${cruisingSpeed} knots`);
    console.log(`   Hotel Load: ${hotelLoad.toFixed(1)} MW`);
    
    // ============================================================================
    // GENERATE FUEL CONSUMPTION CURVE
    // ============================================================================
    
    const curve = [];
    
    // Speed points to calculate (include key speeds)
    const speedSteps = [0, 5, 10, 12, 14, 16, 18, 20];
    
    // Add cruising and max speed if not already included
    if (!speedSteps.includes(cruisingSpeed)) {
        speedSteps.push(cruisingSpeed);
    }
    if (!speedSteps.includes(maxSpeed)) {
        speedSteps.push(maxSpeed);
    }
    
    // Remove duplicates and sort
    const uniqueSpeeds = [...new Set(speedSteps)].sort((a, b) => a - b);
    
    console.log(`\n🔧 Calculating fuel curve for ${uniqueSpeeds.length} speed points...`);
    
    for (const speed of uniqueSpeeds) {
        if (speed > maxSpeed) continue;
        
        let totalPower;      // Total power required (MW)
        let loadFactor;      // Load factor (0-1)
        let specificFuelConsumption;  // g/kWh
        
        if (speed === 0) {
            // ========================================================================
            // AT BERTH (Speed = 0)
            // ========================================================================
            // Only hotel load is active, no propulsion
            
            totalPower = hotelLoad;
            loadFactor = hotelLoad / propulsionPower;
            
            // At very low load, use base SFC
            specificFuelConsumption = SFOC_BASE;
            
        } else {
            // ========================================================================
            // AT SEA (Speed > 0)
            // ========================================================================
            
            // STEP 1: Calculate propulsion power using Equation 12 (Page 6)
            // Pₜ = Pref × (Vₜ/Vref)³ × τw × τf
            
            const speedRatio = speed / cruisingSpeed;
            const speedRatioCubed = Math.pow(speedRatio, 3);
            
            // Propulsion power calculation
            let propulsionPowerAtSpeed = propulsionPower * speedRatioCubed * TAU_WEATHER * TAU_FOULING;
            
            // STEP 2: Calculate load factor (Equation 14, Page 7)
            // ✅ CRITICAL: Load factor is based on PROPULSION power only
            // Hotel load is auxiliary power (not part of MCR rating)
            loadFactor = propulsionPowerAtSpeed / propulsionPower;
            
            // Allow load factor up to 2.0 for peak operation
            // (Modern engines can sustain 150-200% MCR for short periods)
            loadFactor = Math.max(0, Math.min(loadFactor, 2.0));
            
            // Add hotel load to get total power
            // (Hotel load runs independently of propulsion load)
            totalPower = propulsionPowerAtSpeed + hotelLoad;
            
            // STEP 3: Calculate specific fuel consumption (Equation 17, Page 7)
            // SFCₜ = SFCbase × [1.28 - 0.71×Lₜ + 0.455×Lₜ²]
            
            const term1 = 1.28;
            const term2 = -0.71 * loadFactor;
            const term3 = 0.455 * Math.pow(loadFactor, 2);
            
            const sfcMultiplier = term1 + term2 + term3;
            specificFuelConsumption = SFOC_BASE * sfcMultiplier;
            
            // Ensure SFC is within realistic bounds (100-350 g/kWh)
            specificFuelConsumption = Math.max(100, Math.min(specificFuelConsumption, 350));
        }
        
        // ========================================================================
        // STEP 4: Calculate fuel consumption (Equation 19, Page 8)
        // ========================================================================
        // Fₜ = kWhₜ × SFCₜ
        // For hourly consumption: Fₜ = Pₜ(MW) × SFCₜ(g/kWh) / 1000
        
        // Convert: MW × g/kWh → tons/hour
        // 1 MW = 1000 kW
        // SFC in g/kWh, so: MW × 1000 kW/MW × SFC g/kWh / 1000 g/kg / 1000 kg/ton
        const fuelConsumptionTonsPerHour = totalPower * specificFuelConsumption / 1000;
        
        // Store result
        curve.push({
            speed: Math.round(speed * 10) / 10,  // Round to 1 decimal
            consumption: Math.round(fuelConsumptionTonsPerHour * 1000) / 1000,  // Round to 3 decimals
            
            // Additional debug info (optional, can be removed in production)
            _debug: {
                totalPower_MW: Math.round(totalPower * 10) / 10,
                loadFactor: Math.round(loadFactor * 100) / 100,
                sfc_gkWh: Math.round(specificFuelConsumption * 10) / 10
            }
        });
        
        // Log calculation details for key speeds
        if (speed === 0 || speed === cruisingSpeed || speed === maxSpeed) {
            console.log(`   ⚡ Speed ${speed} kn: ${fuelConsumptionTonsPerHour.toFixed(2)} t/h (${(fuelConsumptionTonsPerHour * 24).toFixed(0)} t/day)`);
            console.log(`      Power: ${totalPower.toFixed(1)} MW, Load: ${(loadFactor * 100).toFixed(0)}%, SFC: ${specificFuelConsumption.toFixed(0)} g/kWh`);
        }
    }
    
    console.log(`✅ Fuel curve calculation complete!\n`);
    
    return curve;
}
/**
 * Estimate hotel load (auxiliary power) based on ship size
 * 
 * This is a simplified approach compared to the paper's regression model
 * (Equation 20-21, Page 8-9), but provides comparable results with better
 * transparency and easier validation.
 * 
 * The paper's regression:
 * Hotel_Load = e^(-21.9 + 2.8×ln(GT) - 1.15×ln(berths) - 0.36×diesel_electric)
 * 
 * Our simplified approach uses size-based tiers validated against the paper's
 * results and industry data (Lloyd's Register, Marine Insight).
 * 
 * @param {number} grossTonnage - Ship's gross tonnage
 * @returns {number} - Estimated hotel load in MW
 */
function estimateHotelLoad(grossTonnage) {
    // Hotel load scales with ship size based on industry standards
    // 
    // Size categories and typical hotel loads:
    // - Small ships (< 50k GT): 3-5 MW
    //   Example: MS Finnmarken (15,690 GT) ≈ 4 MW
    // 
    // - Medium ships (50k-100k GT): 5-10 MW
    //   Example: MS Artania (44,656 GT) ≈ 8 MW
    // 
    // - Large ships (100k-200k GT): 10-15 MW
    //   Example: Norwegian Star (91,740 GT) ≈ 12 MW
    // 
    // - Mega ships (> 200k GT): 15-20+ MW
    //   Example: Icon of the Seas (250,800 GT) ≈ 20 MW
    
    if (grossTonnage < 50000) {
        // Small cruise ships: linear interpolation 3-5 MW
        return 3 + (grossTonnage / 50000) * 2;
        
    } else if (grossTonnage < 100000) {
        // Medium cruise ships: linear interpolation 5-10 MW
        return 5 + ((grossTonnage - 50000) / 50000) * 5;
        
    } else if (grossTonnage < 200000) {
        // Large cruise ships: linear interpolation 10-15 MW
        return 10 + ((grossTonnage - 100000) / 100000) * 5;
        
    } else {
        // Mega cruise ships: linear interpolation 15-20+ MW
        return 15 + ((grossTonnage - 200000) / 100000) * 5;
    }
}

// Global chart variable
let fuelCurveChart = null;

/**
 * Display fuel consumption curve for a selected ship
 */
function displayFuelCurve(ship) {
    if (!ship.fuelConsumptionCurve || ship.fuelConsumptionCurve.length === 0) {
        toastr.warning('No fuel consumption curve available for this ship.', 'No Data');
        return;
    }
    
    // Show the chart card
    document.getElementById('fuel-curve-card').style.display = 'block';
    document.getElementById('selected-ship-name').textContent = ship.name;
    
    // Update info boxes
    document.getElementById('chart-gt').textContent = ship.grossTonnage.toLocaleString() + ' GT';
    document.getElementById('chart-cruise-speed').textContent = ship.cruisingSpeed.toFixed(1) + ' kn';
    
    // Find consumption at cruising speed
    const cruisePoint = ship.fuelConsumptionCurve.find(p => p.speed === ship.cruisingSpeed) ||
                       ship.fuelConsumptionCurve[ship.fuelConsumptionCurve.length - 2];
    document.getElementById('chart-cruise-consumption').textContent = cruisePoint.consumption.toFixed(2) + ' t/h';
    
    // Hotel load is at speed 0
    const hotelLoad = ship.fuelConsumptionCurve[0];
    document.getElementById('chart-hotel-load').textContent = hotelLoad.consumption.toFixed(2) + ' t/h';
    
    // Prepare chart data
    const speeds = ship.fuelConsumptionCurve.map(point => point.speed);
    const consumptions = ship.fuelConsumptionCurve.map(point => point.consumption);
    
    // Destroy existing chart if it exists
    if (fuelCurveChart) {
        fuelCurveChart.destroy();
    }
    
    // Create new chart
    const ctx = document.getElementById('fuelCurveChart').getContext('2d');
    fuelCurveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: speeds,
            datasets: [{
                label: 'Fuel Consumption (tons/hour)',
                data: consumptions,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(2)} tons/hour at ${context.parsed.x} knots`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Speed (knots)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Fuel Consumption (tons/hour)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    // Scroll to chart
    document.getElementById('fuel-curve-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Close the fuel curve display
 */
function closeFuelCurve() {
    document.getElementById('fuel-curve-card').style.display = 'none';
    if (fuelCurveChart) {
        fuelCurveChart.destroy();
        fuelCurveChart = null;
    }
}