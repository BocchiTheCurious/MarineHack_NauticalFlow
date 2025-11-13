import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, showLoader, hideLoader,  initializePagination, makeTableScrollable, initializeTableSearch, addSearchClearButton } from './modules/utils.js';
import { getPorts, addPort, deletePort, updatePort } from './modules/api.js';
// Import review functions
import { getPortReviews, getPortReviewsSummary, getMyPortReview, addPortReview, deletePortReview } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let allPorts = [];
let portModal;
let portMap;
let mapMarkers = [];
let importModal;
let parsedImportData = [];
let reviewModal;
let allReviewsModal;
let portPaginationController = null;
let portSearchController = null; 

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();

    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializePortDataPage();

    hideLoader();
});

async function initializePortDataPage() {
    portModal = new bootstrap.Modal(document.getElementById('portModal'));
    importModal = new bootstrap.Modal(document.getElementById('importModal'));
    reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    allReviewsModal = new bootstrap.Modal(document.getElementById('allReviewsModal'));


    initializeMap();
    await loadAndRenderPorts();

    document.getElementById('portForm').addEventListener('submit', handleSavePort);
    document.querySelector('#port-data-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('portModal').addEventListener('show.bs.modal', handleModalOpen);
    document.getElementById('locodePasteInput').addEventListener('input', handleCoordsPaste);
    document.getElementById('portCongestionIndex').addEventListener('input', handleSliderChange);
    
    document.getElementById('congestionLastUpdated').addEventListener('change', function(e) {
    if (e.target.value) {
        updateCongestionAgeWarning(e.target.value);
    }
    });
    
    // Add button listeners (make sure IDs match your HTML)
    const openSeadexBtn = document.getElementById('openSeadexBtn');
    if (openSeadexBtn) {
        openSeadexBtn.addEventListener('click', openSeadexForPort);
    }
    
    const setTodayBtn = document.getElementById('setTodayBtn');
    if (setTodayBtn) {
        setTodayBtn.addEventListener('click', setTodayAsUpdateDate);
    }

    portSearchController = initializeTableSearch(
        'port-search-input',
        allPorts,
        ['name', 'country'], // Search in name and country fields
        (filteredData) => {
            renderPortsTable(filteredData);
            renderMapMarkers(filteredData);
        },
        {
            debounceDelay: 300,
            placeholder: 'Search ports by name or country...',
            showResultCount: true,
            minCharacters: 0
        }
    );
    
    // Add clear button to search
    addSearchClearButton('port-search-input', () => {
        renderPortsTable(allPorts);
        renderMapMarkers(allPorts);
    });

    // DEBUG: Check if elements exist
    console.log('CSV File Input:', document.getElementById('csvFileInput'));
    console.log('Confirm Button:', document.getElementById('confirmImportBtn'));
    console.log('Select All:', document.getElementById('selectAllPorts'));
    console.log('Deselect All:', document.getElementById('deselectAllPorts'));

    // Attach listeners
    document.getElementById('csvFileInput').addEventListener('change', handleCSVFileSelect);
    document.getElementById('selectAllPorts').addEventListener('click', selectAllImportPorts);
    document.getElementById('deselectAllPorts').addEventListener('click', deselectAllImportPorts);
    document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);

    console.log('CSV Import listeners attached!');

    document.getElementById('download-template-btn').addEventListener('click', downloadCSVTemplate);

    document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);

    // NEW: Review form listeners
    document.getElementById('reviewForm').addEventListener('submit', handleSubmitReview);
    document.getElementById('reviewComment').addEventListener('input', updateCharCount);
    document.getElementById('reviewSortOrder').addEventListener('change', handleReviewSortChange);

    // Initialize star rating input
    initializeStarRating();
}

function downloadCSVTemplate() {
    // Define the CSV headers matching the system's expected columns
    const headers = [
        'portName',
        'countryName',
        'latitude',
        'longitude',
        'harborSize',
        'harborType',
        'maxVesselLength',
        'maxVesselBeam',
        'maxVesselDraft',
        'firstPortOfEntry',
        'chDepth',
        'anDepth',
        'cpDepth',
        'shelter',
        'goodHoldingGround',
        'turningArea',
        'suWater',
        'suProvisions',
        'ptAvailable',
        'tugsAssist',
        'medFacilities',
        'garbageDisposal',
        'dirtyBallast',
        'repairCode',
        'erTide',
        'erSwell',
        'erIce',
        'qtPratique',
        'qtSanitation'
    ];

    // Create sample data rows with instructions
    const sampleData = [
        [
            'Port of Miami',
            'United States',
            '25.7743',
            '-80.1937',
            'L',
            'CB',
            '350',
            '50',
            '15',
            'Y',
            '12',
            '10',
            '11',
            'E',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'N',
            'N',
            'N',
            'Y',
            'Y'
        ],
        [
            'Port of Barcelona',
            'Spain',
            '41.3851',
            '2.1734',
            'L',
            'CB',
            '400',
            '60',
            '16',
            'Y',
            '14',
            '12',
            '13',
            'G',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'Y',
            'N',
            'Y',
            'N',
            'Y',
            'Y'
        ]
    ];

    // Create CSV content
    let csvContent = headers.join(',') + '\n';

    // Add sample rows
    sampleData.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    // Add instruction rows (commented out)
    csvContent += '\n# INSTRUCTIONS:\n';
    csvContent += '# portName: Full name of the port\n';
    csvContent += '# countryName: Country where port is located\n';
    csvContent += '# latitude: Decimal degrees (e.g., 25.7743)\n';
    csvContent += '# longitude: Decimal degrees (e.g., -80.1937)\n';
    csvContent += '# harborSize: L=Large, M=Medium, S=Small, V=Very Small\n';
    csvContent += '# harborType: CB=Coastal Breakwater, CN=Coastal Natural, OR=Open Roadstead, RB=River Basin, etc.\n';
    csvContent += '# maxVesselLength/Beam/Draft: In meters\n';
    csvContent += '# firstPortOfEntry: Y=Yes, N=No\n';
    csvContent += '# chDepth: Channel depth in meters\n';
    csvContent += '# anDepth: Anchorage depth in meters\n';
    csvContent += '# cpDepth: Cargo pier depth in meters\n';
    csvContent += '# shelter: E=Excellent, G=Good, F=Fair, P=Poor, N=None\n';
    csvContent += '# goodHoldingGround/turningArea: Y=Yes, N=No\n';
    csvContent += '# Facilities (suWater, suProvisions, ptAvailable, tugsAssist, medFacilities, garbageDisposal, dirtyBallast): Y=Yes, N=No\n';
    csvContent += '# repairCode: Y=Yes, N=No (repair facilities available)\n';
    csvContent += '# Entrance Restrictions (erTide, erSwell, erIce): Y=Yes, N=No\n';
    csvContent += '# Quarantine (qtPratique, qtSanitation): Y=Yes, N=No\n';
    csvContent += '# \n';
    csvContent += '# Delete these instruction rows and sample data before importing your own data\n';

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'port_import_template.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toastr.success('CSV template downloaded successfully!', 'Download Complete');
}

async function exportToExcel() {
    try {
        showLoader();

        // Fetch all ports from database
        const ports = await getPorts();

        if (ports.length === 0) {
            hideLoader();
            showAlert('No ports to export', 'warning');
            return;
        }

        // Helper function to convert boolean to Y/N
        const toYN = (val) => {
            if (val === true) return 'Y';
            if (val === false) return 'N';
            return '';
        };

        // Prepare data for export
        const exportData = ports.map(port => ({
            'Port ID': `P${String(port.id).padStart(3, '0')}`,
            'portName': port.name,
            'countryName': port.country,
            'latitude': port.latitude,
            'longitude': port.longitude,
            'Port Congestion Index': port.portCongestionIndex,
            'harborSize': port.harborSize || '',
            'harborType': port.harborType || '',
            'maxVesselLength': port.maxVesselLength || '',
            'maxVesselBeam': port.maxVesselBeam || '',
            'maxVesselDraft': port.maxVesselDraft || '',
            'firstPortOfEntry': toYN(port.firstPortOfEntry),
            'chDepth': port.channelDepth || '',
            'anDepth': port.anchorageDepth || '',
            'cpDepth': port.cargoPierDepth || '',
            'shelter': port.shelterAfforded || '',
            'goodHoldingGround': toYN(port.goodHoldingGround),
            'turningArea': toYN(port.turningArea),
            'suWater': toYN(port.facilities?.potableWater),
            'suProvisions': toYN(port.facilities?.provisions),
            'ptAvailable': toYN(port.facilities?.pilotService),
            'tugsAssist': toYN(port.facilities?.tugService),
            'medFacilities': toYN(port.facilities?.medicalFacilities),
            'garbageDisposal': toYN(port.facilities?.garbageDisposal),
            'dirtyBallast': toYN(port.facilities?.ballastDisposal),
            'repairCode': toYN(port.facilities?.repairFacilities),
            'erTide': toYN(port.entranceRestrictions?.tide),
            'erSwell': toYN(port.entranceRestrictions?.swell),
            'erIce': toYN(port.entranceRestrictions?.ice),
            'qtPratique': toYN(port.quarantine?.pratique),
            'qtSanitation': toYN(port.quarantine?.sanitation)
        }));

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Set column widths
        const columnWidths = [
            { wch: 10 },  // Port ID
            { wch: 30 },  // portName
            { wch: 20 },  // countryName
            { wch: 12 },  // latitude
            { wch: 12 },  // longitude
            { wch: 18 },  // Port Congestion Index
            { wch: 12 },  // harborSize
            { wch: 12 },  // harborType
            { wch: 18 },  // maxVesselLength
            { wch: 16 },  // maxVesselBeam
            { wch: 16 },  // maxVesselDraft
            { wch: 16 },  // firstPortOfEntry
            { wch: 12 },  // chDepth
            { wch: 12 },  // anDepth
            { wch: 12 },  // cpDepth
            { wch: 10 },  // shelter
            { wch: 18 },  // goodHoldingGround
            { wch: 14 },  // turningArea
            { wch: 12 },  // suWater
            { wch: 14 },  // suProvisions
            { wch: 14 },  // ptAvailable
            { wch: 12 },  // tugsAssist
            { wch: 14 },  // medFacilities
            { wch: 16 },  // garbageDisposal
            { wch: 14 },  // dirtyBallast
            { wch: 12 },  // repairCode
            { wch: 10 },  // erTide
            { wch: 10 },  // erSwell
            { wch: 10 },  // erIce
            { wch: 12 },  // qtPratique
            { wch: 14 }   // qtSanitation
        ];
        ws['!cols'] = columnWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Ports');

        // Create a second sheet with instructions
        const instructions = [
            ['NauticalFlow Port Data Export'],
            [''],
            ['COLUMN DESCRIPTIONS:'],
            ['Port ID', 'Unique identifier for each port in the system'],
            ['portName', 'Full name of the port'],
            ['countryName', 'Country where the port is located'],
            ['latitude', 'Latitude in decimal degrees'],
            ['longitude', 'Longitude in decimal degrees'],
            ['Port Congestion Index', 'Average wait time percentage (0-100)'],
            ['harborSize', 'L=Large, M=Medium, S=Small, V=Very Small'],
            ['harborType', 'CB=Coastal Breakwater, CN=Coastal Natural, OR=Open Roadstead, RB=River Basin, etc.'],
            ['maxVesselLength', 'Maximum vessel length in meters'],
            ['maxVesselBeam', 'Maximum vessel beam in meters'],
            ['maxVesselDraft', 'Maximum vessel draft in meters'],
            ['firstPortOfEntry', 'Y=Yes, N=No - Has customs and immigration'],
            ['chDepth', 'Channel depth in meters'],
            ['anDepth', 'Anchorage depth in meters'],
            ['cpDepth', 'Cargo pier depth in meters'],
            ['shelter', 'E=Excellent, G=Good, F=Fair, P=Poor, N=None'],
            ['goodHoldingGround', 'Y=Yes, N=No - Secure anchorage'],
            ['turningArea', 'Y=Yes, N=No - Space for vessel turning'],
            ['suWater', 'Y=Yes, N=No - Potable water available'],
            ['suProvisions', 'Y=Yes, N=No - Provisions available'],
            ['ptAvailable', 'Y=Yes, N=No - Pilot service available'],
            ['tugsAssist', 'Y=Yes, N=No - Tugboat service available'],
            ['medFacilities', 'Y=Yes, N=No - Medical facilities available'],
            ['garbageDisposal', 'Y=Yes, N=No - Garbage disposal available'],
            ['dirtyBallast', 'Y=Yes, N=No - Ballast disposal available'],
            ['repairCode', 'Y=Yes, N=No - Repair facilities available'],
            ['erTide', 'Y=Yes, N=No - Tide restrictions'],
            ['erSwell', 'Y=Yes, N=No - Swell restrictions'],
            ['erIce', 'Y=Yes, N=No - Ice restrictions'],
            ['qtPratique', 'Y=Yes, N=No - Pratique services'],
            ['qtSanitation', 'Y=Yes, N=No - Sanitation services'],
            [''],
            ['IMPORT INSTRUCTIONS:'],
            ['1. To import this data back, remove the "Port ID" and "Port Congestion Index" columns'],
            ['2. Save as CSV format'],
            ['3. Use the Import CSV function in NauticalFlow'],
            [''],
            ['Export Date:', new Date().toLocaleString()],
            ['Total Ports:', ports.length]
        ];

        const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
        wsInstructions['!cols'] = [{ wch: 25 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `NauticalFlow_Ports_${timestamp}.xlsx`;

        // Write file
        XLSX.writeFile(wb, filename);

        hideLoader();
        toastr.success(`Successfully exported ${ports.length} ports to Excel!`, 'Export Complete');

    } catch (error) {
        hideLoader();
        console.error('Export error:', error);
        showAlert('Failed to export data to Excel', 'danger');
    }
}

// --- NEW: User-Friendly Input Handlers ---

/**
 * Parses a UN/LOCODE coordinate string and populates the lat/lon fields.
 */
function handleCoordsPaste(event) {
    const inputString = event.target.value;
    const coords = parseLocodeCoordinates(inputString);
    if (coords) {
        document.getElementById('latitude').value = coords.latitude.toFixed(6);
        document.getElementById('longitude').value = coords.longitude.toFixed(6);
    }
}

/**
 * Updates the text display for the congestion slider.
 */
function handleSliderChange(event) {
    const percentage = event.target.value;
    document.getElementById('congestionValue').textContent = `${percentage}%`;
    
    // ADD: Update estimated hours dynamically
    const estimatedHours = convertCongestionToHours(percentage);
    document.getElementById('estimatedWaitTime').textContent = 
        `(~${estimatedHours.toFixed(1)} hours estimated wait)`;
    
    // ADD: Update color based on level
    const congestionValue = document.getElementById('congestionValue');
    if (percentage <= 25) {
        congestionValue.className = 'fw-bold congestion-low';
    } else if (percentage <= 50) {
        congestionValue.className = 'fw-bold congestion-moderate';
    } else if (percentage <= 75) {
        congestionValue.className = 'fw-bold congestion-high';
    } else {
        congestionValue.className = 'fw-bold congestion-severe';
    }
}

/**
 * Converts congestion percentage to estimated wait hours
 * Uses tiered brackets for realistic conversion
 */
function convertCongestionToHours(percentage) {
    const percent = parseFloat(percentage);
    
    if (percent <= 25) {
        return percent * 0.04;  // 0-1 hours
    } else if (percent <= 50) {
        return 1 + (percent - 25) * 0.08;  // 1-3 hours
    } else if (percent <= 75) {
        return 3 + (percent - 50) * 0.16;  // 3-7 hours
    } else {
        return 7 + (percent - 75) * 0.32;  // 7-15 hours
    }
}

/**
 * Updates the warning message based on data age
 */
function updateCongestionAgeWarning(lastUpdatedDate) {
    if (!lastUpdatedDate) {
        document.getElementById('congestionAgeWarning').innerHTML = 
            '<i class="bi bi-exclamation-triangle text-warning me-1"></i>No update date recorded';
        return;
    }
    
    const lastUpdated = new Date(lastUpdatedDate);
    const now = new Date();
    const daysDiff = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
    
    let message = '';
    let iconClass = '';
    
    if (daysDiff <= 14) {
        message = `<i class="bi bi-check-circle text-success me-1"></i>Data is fresh (${daysDiff} days old)`;
    } else if (daysDiff <= 45) {
        message = `<i class="bi bi-info-circle text-info me-1"></i>Data is ${daysDiff} days old`;
    } else if (daysDiff <= 90) {
        message = `<i class="bi bi-exclamation-triangle text-warning me-1"></i>Data is ${daysDiff} days old - consider updating`;
    } else {
        message = `<i class="bi bi-x-circle text-danger me-1"></i>Data is ${daysDiff} days old - update needed!`;
    }
    
    document.getElementById('congestionAgeWarning').innerHTML = message;
}

/**
 * Opens Seadex.ai with pre-filled port search
 */
function openSeadexForPort() {
    const portName = document.getElementById('portName').value;
    const url = portName 
        ? `https://seadex.ai/en/free-tools/port-congestion-tool?search=${encodeURIComponent(portName)}`
        : 'https://seadex.ai/en/free-tools/port-congestion-tool';
    window.open(url, '_blank');
}

/**
 * Sets congestion last updated to today
 */
function setTodayAsUpdateDate() {
    document.getElementById('congestionLastUpdated').valueAsDate = new Date();
    updateCongestionAgeWarning(new Date().toISOString());
    toastr.success('Update date set to today');
}


// --- Main Page Functions (Updated for new inputs) ---

async function handleSavePort(event) {
    event.preventDefault();
    const portId = document.getElementById('portId').value;

    // Collect facilities
    const facilities = {
        potableWater: document.getElementById('facilityPotableWater').checked,
        provisions: document.getElementById('facilityProvisions').checked,
        pilotService: document.getElementById('facilityPilotService').checked,
        tugService: document.getElementById('facilityTugService').checked,
        medicalFacilities: document.getElementById('facilityMedical').checked,
        garbageDisposal: document.getElementById('facilityGarbageDisposal').checked,
        ballastDisposal: document.getElementById('facilityBallastDisposal').checked,
        repairFacilities: document.getElementById('facilityRepairs').checked
    };

    // Collect entrance restrictions
    const entranceRestrictions = {
        tide: document.getElementById('restrictionTide').checked,
        swell: document.getElementById('restrictionSwell').checked,
        ice: document.getElementById('restrictionIce').checked
    };

    // Collect quarantine
    const quarantine = {
        pratique: document.getElementById('quarantinePratique').checked,
        sanitation: document.getElementById('quarantineSanitation').checked
    };

    // Helper to get number or null
    const getNumOrNull = (id) => {
        const val = document.getElementById(id).value;
        return val ? parseFloat(val) : null;
    };

    // Helper to get value or null
    const getValOrNull = (id) => {
        const val = document.getElementById(id).value;
        return val || null;
    };

    const portData = {
        // Basic info
        name: document.getElementById('portName').value,
        country: document.getElementById('country').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        portCongestionIndex: parseFloat(document.getElementById('portCongestionIndex').value),
        congestionLastUpdated: document.getElementById('congestionLastUpdated').value || null,


        // Port Profile
        harborSize: getValOrNull('harborSize'),
        harborType: getValOrNull('harborType'),
        maxVesselLength: getNumOrNull('maxVesselLength'),
        maxVesselBeam: getNumOrNull('maxVesselBeam'),
        maxVesselDraft: getNumOrNull('maxVesselDraft'),
        firstPortOfEntry: document.getElementById('firstPortOfEntry').checked,

        // Operational Data
        channelDepth: getNumOrNull('channelDepth'),
        anchorageDepth: getNumOrNull('anchorageDepth'),
        cargoPierDepth: getNumOrNull('cargoPierDepth'),
        shelterAfforded: getValOrNull('shelterAfforded'),
        goodHoldingGround: document.getElementById('goodHoldingGround').checked,
        turningArea: document.getElementById('turningArea').checked,

        // JSON fields
        facilities: facilities,
        entranceRestrictions: entranceRestrictions,
        quarantine: quarantine
    };

    // Validation
    if (!portData.name || !portData.country || isNaN(portData.latitude) || isNaN(portData.longitude)) {
        showAlert('Please fill in all required fields: Name, Country, Latitude, and Longitude', 'warning');
        return;
    }

    try {
        if (portId) {
            await updatePort(portId, portData);
            showAlert('Port updated successfully!', 'success');
        } else {
            await addPort(portData);
            showAlert('Port added successfully!', 'success');
        }
        portModal.hide();
        loadAndRenderPorts();
    } catch (error) {
        showAlert(`Failed to save port. ${error.message}`, 'danger');
    }
}

function handleModalOpen(event) {
    const button = event.relatedTarget;
    const portId = button ? button.getAttribute('data-port-id') : null;
    const form = document.getElementById('portForm');
    const modalTitle = document.getElementById('portModalLabel');

    form.reset();
    document.getElementById('portId').value = '';

    // Reset to first tab
    const firstTab = new bootstrap.Tab(document.getElementById('basic-tab'));
    firstTab.show();

    if (portId) {
        modalTitle.textContent = 'Edit Port';
        const port = allPorts.find(p => p.id == portId);
        if (port) {
            // Basic Info
            document.getElementById('portId').value = port.id;
            document.getElementById('portName').value = port.name;
            document.getElementById('country').value = port.country;
            document.getElementById('latitude').value = port.latitude;
            document.getElementById('longitude').value = port.longitude;
            document.getElementById('portCongestionIndex').value = port.portCongestionIndex;
            document.getElementById('congestionValue').textContent = `${port.portCongestionIndex}%`;
            document.getElementById('estimatedWaitTime').textContent = `(~${convertCongestionToHours(port.portCongestionIndex).toFixed(1)} hours estimated wait)`;
            
            if (port.congestionLastUpdated) {
            document.getElementById('congestionLastUpdated').value = port.congestionLastUpdated.split('T')[0]; // Convert datetime to date
            updateCongestionAgeWarning(port.congestionLastUpdated);
            }

            // Port Profile
            document.getElementById('harborSize').value = port.harborSize || '';
            document.getElementById('harborType').value = port.harborType || '';
            document.getElementById('maxVesselLength').value = port.maxVesselLength || '';
            document.getElementById('maxVesselBeam').value = port.maxVesselBeam || '';
            document.getElementById('maxVesselDraft').value = port.maxVesselDraft || '';
            document.getElementById('firstPortOfEntry').checked = port.firstPortOfEntry || false;

            // Operational Data
            document.getElementById('channelDepth').value = port.channelDepth || '';
            document.getElementById('anchorageDepth').value = port.anchorageDepth || '';
            document.getElementById('cargoPierDepth').value = port.cargoPierDepth || '';
            document.getElementById('shelterAfforded').value = port.shelterAfforded || '';
            document.getElementById('goodHoldingGround').checked = port.goodHoldingGround || false;
            document.getElementById('turningArea').checked = port.turningArea || false;

            // Entrance Restrictions
            const restrictions = port.entranceRestrictions || {};
            document.getElementById('restrictionTide').checked = restrictions.tide || false;
            document.getElementById('restrictionSwell').checked = restrictions.swell || false;
            document.getElementById('restrictionIce').checked = restrictions.ice || false;

            // Quarantine
            const quarantine = port.quarantine || {};
            document.getElementById('quarantinePratique').checked = quarantine.pratique || false;
            document.getElementById('quarantineSanitation').checked = quarantine.sanitation || false;

            // Facilities
            const facilities = port.facilities || {};
            document.getElementById('facilityPotableWater').checked = facilities.potableWater || false;
            document.getElementById('facilityProvisions').checked = facilities.provisions || false;
            document.getElementById('facilityPilotService').checked = facilities.pilotService || false;
            document.getElementById('facilityTugService').checked = facilities.tugService || false;
            document.getElementById('facilityMedical').checked = facilities.medicalFacilities || false;
            document.getElementById('facilityGarbageDisposal').checked = facilities.garbageDisposal || false;
            document.getElementById('facilityBallastDisposal').checked = facilities.ballastDisposal || false;
            document.getElementById('facilityRepairs').checked = facilities.repairFacilities || false;
        }
    } else {
        modalTitle.textContent = 'Add New Port';
        document.getElementById('portCongestionIndex').value = 50;
        document.getElementById('congestionValue').textContent = '50%';
    }
}

// --- Utility and Rendering Functions (Unchanged) ---

/**
 * Parses a UN/LOCODE string like "3252N 06603E" into decimal coordinates.
 * @param {string} locodeString The coordinate string from UN/LOCODE.
 * @returns {Object|null} An object with {latitude, longitude} or null if invalid.
 */
function parseLocodeCoordinates(locodeString) {
    const regex = /^(\d{4})([NS])\s(\d{5})([EW])$/;
    const match = locodeString.trim().toUpperCase().match(regex);

    if (!match) return null;

    const [, latStr, latDir, lonStr, lonDir] = match;

    let lat = parseInt(latStr.substring(0, 2)) + parseInt(latStr.substring(2, 4)) / 60;
    if (latDir === 'S') lat = -lat;

    let lon = parseInt(lonStr.substring(0, 3)) + parseInt(lonStr.substring(3, 5)) / 60;
    if (lonDir === 'W') lon = -lon;

    return { latitude: lat, longitude: lon };
}

async function loadAndRenderPorts() {
    try {
        allPorts = await getPorts();
        
        // Make table scrollable (only once)
        makeTableScrollable('port-data-table', 400);
        
        // Update search controller with new data
        if (portSearchController) {
            portSearchController.setDataset(allPorts);
        }
        
        renderPortsTable(allPorts);
        renderMapMarkers(allPorts);
    } catch (error) {
        showAlert('Could not load port data.', 'danger');
    }
}

function renderPortsTable(ports) {
    const tableBody = document.querySelector('#port-data-table tbody');
    
    if (ports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No ports found.</td></tr>';
        // Destroy pagination if no data
        if (portPaginationController) {
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                paginationContainer.remove();
            }
            portPaginationController = null;
        }
        return;
    }

    // Render function for a page of data
    const renderPage = (pageData) => {
        tableBody.innerHTML = '';
        pageData.forEach(port => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>P${String(port.id).padStart(3, '0')}</td>
                <td>${port.name}</td>
                <td>${port.country}</td>
                <td>${parseFloat(port.latitude).toFixed(4)}</td>
                <td>${parseFloat(port.longitude).toFixed(4)}</td>
                <td>
                    <span class="badge ${getCongestionBadgeClass(port.portCongestionIndex)}">
                        ${parseFloat(port.portCongestionIndex).toFixed(0)}%
                    </span>
                    <br>
                    ${port.congestionLastUpdated ? `
                        <small class="${getDataAgeClass(port.congestionLastUpdated)}">
                            <i class="bi bi-${getDataAgeIcon(port.congestionLastUpdated)} me-1"></i>
                            ${getDataAgeText(port.congestionLastUpdated)}
                        </small>
                    ` : '<small class="text-muted">No date</small>'}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Port" data-bs-toggle="modal" data-bs-target="#portModal" data-port-id="${port.id}"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Port" data-port-id="${port.id}"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Initialize or update pagination
    if (!portPaginationController) {
        portPaginationController = initializePagination(
            'port-data-table',
            ports,
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
        portPaginationController.setData(ports);
    }

    // Initial render
    portPaginationController.render();
}

function getCongestionBadgeClass(congestion) {
    const val = parseFloat(congestion);
    if (val <= 25) return 'bg-success';
    if (val <= 50) return 'bg-warning text-dark';
    if (val <= 75) return 'bg-orange text-white';
    return 'bg-danger';
}

function getDataAgeClass(lastUpdated) {
    if (!lastUpdated) return 'text-muted';
    const days = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
    if (days <= 14) return 'text-success';
    if (days <= 45) return 'text-info';
    if (days <= 90) return 'text-warning';
    return 'text-danger';
}

function getDataAgeIcon(lastUpdated) {
    if (!lastUpdated) return 'question-circle';
    const days = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
    if (days <= 14) return 'check-circle';
    if (days <= 45) return 'info-circle';
    if (days <= 90) return 'exclamation-triangle';
    return 'x-circle';
}

function getDataAgeText(lastUpdated) {
    if (!lastUpdated) return 'No date';
    const days = Math.floor((new Date() - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days}d ago`;
}

async function handleTableActions(event) {
    const targetBtn = event.target.closest('button.delete-btn');
    if (!targetBtn) return;

    const portId = targetBtn.dataset.portId;
    const portName = targetBtn.closest('tr').cells[1].textContent;

    // THE FIX: Replaced the old confirm() with SweetAlert
    Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete "${portName}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deletePort(portId);
                // Using toastr for the success message for consistency
                toastr.success(`Port "${portName}" was deleted.`);
                loadAndRenderPorts(); // Refresh the table
            } catch (error) {
                toastr.error('Failed to delete port.', 'Delete Failed');
            }
        }
    });
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filteredPorts = allPorts.filter(port =>
        port.name.toLowerCase().includes(searchTerm) ||
        port.country.toLowerCase().includes(searchTerm)
    );
    renderPortsTable(filteredPorts);
    renderMapMarkers(filteredPorts);
}

function initializeMap() {
    // Initialize Leaflet map
    portMap = L.map('portMap').setView([20, 0], 2);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(portMap);
}

function renderMapMarkers(ports) {
    // Clear existing markers
    mapMarkers.forEach(marker => portMap.removeLayer(marker));
    mapMarkers = [];

    if (ports.length === 0) return;

    // Add markers for each port
    ports.forEach(port => {
        const lat = parseFloat(port.latitude);
        const lon = parseFloat(port.longitude);

        if (isNaN(lat) || isNaN(lon)) return;

        // Create custom icon based on congestion
        const congestion = parseFloat(port.portCongestionIndex);
        let markerColor = '#28a745'; // green
        if (congestion > 70) markerColor = '#dc3545'; // red
        else if (congestion > 40) markerColor = '#ffc107'; // yellow

        const marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'custom-port-marker',
                html: `<div style="background-color: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                        <i class="bi bi-geo-alt-fill" style="color: white; font-size: 16px;"></i>
                       </div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(portMap);

        // Add tooltip with port name
        marker.bindTooltip(port.name, {
            permanent: false,
            direction: 'top',
            offset: [0, -15]
        });

        // Handle marker click
        marker.on('click', () => {
            updateBentoGrid(port);
            highlightTableRow(port.id);
        });

        mapMarkers.push(marker);
    });

    // Fit map to show all markers
    if (mapMarkers.length > 0) {
        const group = L.featureGroup(mapMarkers);
        portMap.fitBounds(group.getBounds().pad(0.1));
    }
}

function updateBentoGrid(port) {
    // Box 2: Port Header Info
    updatePortInfo(port);

    // Box 3: Facilities
    updateFacilities(port);

    // Box 4: Operational Data 
    updateOperationalData(port);

    // Box 5: Reviews & Ratings (NEW)
    updateReviews(port);

    setTimeout(() => {
        if (portMap) {
            portMap.invalidateSize();
        }
    }, 100);
}

function updatePortInfo(port) {
    const infoBox = document.getElementById('bentoPortInfo');

    // Helper function to display value or "N/A"
    const displayValue = (value, suffix = '') => {
        return value ? `${value}${suffix}` : '<span class="text-muted">N/A</span>';
    };

    // Harbor size badge
    const harborSizeBadge = port.harborSize ?
        `<span class="badge bg-info">${port.harborSize === 'L' ? 'Large' : port.harborSize === 'M' ? 'Medium' : port.harborSize === 'S' ? 'Small' : 'Very Small'}</span>` : '';

    // First port of entry badge
    const firstPortBadge = port.firstPortOfEntry ?
        '<span class="badge bg-success ms-2"><i class="bi bi-flag-fill me-1"></i>Entry Port</span>' : '';

    infoBox.innerHTML = `
        <div class="port-header">
            <h5><i class="bi bi-geo-alt-fill me-2"></i>${port.name}</h5>
            <div>
                <small class="text-muted">${port.country}</small>
                ${harborSizeBadge}
                ${firstPortBadge}
            </div>
        </div>
        
        <div class="port-detail-row">
            <span class="text-muted">Port ID:</span>
            <strong>P${String(port.id).padStart(3, '0')}</strong>
        </div>
        
       <div class="port-detail-row">
    <span class="text-muted">
        Harbor Type
        <i class="bi bi-info-circle info-icon" data-bs-toggle="tooltip" 
           title="Physical harbor classification"></i>:
    </span>
    <strong>${displayValue(port.harborType)}</strong>
</div>
        
        <div class="port-detail-row">
            <span class="text-muted">Coordinates:</span>
            <strong>${parseFloat(port.latitude).toFixed(4)}°, ${parseFloat(port.longitude).toFixed(4)}°</strong>
        </div>
        
        <hr class="my-2">
        <h6 class="mb-2 mt-3"><i class="bi bi-rulers me-2"></i>Vessel Limits</h6>
        
        <div class="port-detail-row">
            <span class="text-muted">Max Length:</span>
            <strong>${displayValue(port.maxVesselLength, 'm')}</strong>
        </div>
        
        <div class="port-detail-row">
            <span class="text-muted">Max Beam:</span>
            <strong>${displayValue(port.maxVesselBeam, 'm')}</strong>
        </div>
        
        <div class="port-detail-row">
            <span class="text-muted">Max Draft:</span>
            <strong>${displayValue(port.maxVesselDraft, 'm')}</strong>
        </div>
    `;
}

function updateFacilities(port) {
    const facilitiesBox = document.getElementById('bentoFacilities');
    const facilities = port.facilities || {};

    const facilityList = [
        {
            key: 'potableWater',
            label: 'Potable Water',
            icon: 'droplet',
            image: '../assets/img/potablewater.jpg',
            description: 'Fresh drinking water supply for your cruise ship. Essential for passenger consumption, galley operations, and onboard facilities. Meets international health and safety standards for maritime use.'
        },
        {
            key: 'provisions',
            label: 'Provisions',
            icon: 'basket',
            image: '../assets/img/provisions.jpeg',
            description: 'Complete food and supply services for cruise operations. Includes fresh produce, frozen goods, beverages, and specialty items for passenger dining. Suppliers coordinate with ship stores to ensure timely delivery before departure.'
        },
        {
            key: 'pilotService',
            label: 'Pilot Service',
            icon: 'compass',
            image: '../assets/img/pilotservice.webp',
            description: 'Expert local pilots guide your cruise ship safely through harbor channels and port approaches. Required for safe navigation in unfamiliar waters. Available 24/7 for arrivals and departures.'
        },
        {
            key: 'tugService',
            label: 'Tugboat Service',
            icon: 'life-preserver',
            image: '../assets/img/tugboatservice.jpeg',
            description: 'Powerful tugboats assist cruise ships with precise docking and undocking maneuvers. Critical for large vessels in tight berths and adverse weather conditions. Ensures passenger safety during port operations.'
        },
        {
            key: 'medicalFacilities',
            label: 'Medical Facilities',
            icon: 'heart-pulse',
            image: '../assets/img/medicalfacilities.webp',
            description: 'Shore-based medical services for cruise passengers and crew. Provides emergency care, medical evacuations, pharmacy supplies, and crew health certifications. Available for both routine and urgent medical situations during port calls.'
        },
        {
            key: 'garbageDisposal',
            label: 'Garbage Disposal',
            icon: 'trash',
            image: '../assets/img/garbagedisposal.jpeg',
            description: 'Proper waste management for cruise ship refuse in compliance with environmental regulations. Handles passenger and galley waste, recyclables, and hazardous materials. Provides required documentation for international compliance.'
        },
        {
            key: 'ballastDisposal',
            label: 'Ballast Disposal',
            icon: 'water',
            image: '../assets/img/ballastdisposal.jpeg',
            description: 'Safe discharge facility for cruise ship ballast water. Prevents spread of invasive marine species between regions. Meets international ballast water management standards and provides compliance certificates.'
        },
        {
            key: 'repairFacilities',
            label: 'Repair Facilities',
            icon: 'tools',
            image: '../assets/img/repairfacilities.jpeg',
            description: 'Emergency and scheduled maintenance services for cruise vessels. Includes engine repairs, hull work, electrical systems, and safety equipment servicing. Minimizes downtime to keep cruise schedules on track.'
        }
    ];

    let html = '<h6 class="mb-3"><i class="bi bi-buildings me-2"></i>Port Facilities</h6>';

    // Add scrollable container with single column
    html += '<div class="facilities-list" style="max-height: 450px; overflow-y: auto; padding-right: 10px;">';

    facilityList.forEach((facility, index) => {
        const available = facilities[facility.key] === true;
        const statusClass = available ? 'facility-available' : 'facility-unavailable';
        const statusIcon = available ? 'check-circle-fill' : 'x-circle';
        const expandedClass = available ? 'show' : ''; // Auto-expand available facilities
        const chevronClass = available ? 'bi-chevron-down' : 'bi-chevron-right';

        html += `
            <div class="facility-item-wrapper mb-2 ${statusClass}">
                <div class="facility-header" data-bs-toggle="collapse" data-bs-target="#facility-${facility.key}-${port.id}" style="cursor: pointer; padding: 0.75rem; background: white; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-${statusIcon} me-2" style="font-size: 1.2rem;"></i>
                        <span style="font-weight: 500;">${facility.label}</span>
                    </div>
                    <i class="bi ${chevronClass} chevron-icon" style="transition: transform 0.3s ease;"></i>
                </div>
                
                <div class="collapse ${expandedClass}" id="facility-${facility.key}-${port.id}">
                    <div class="facility-content p-3" style="background: #f8f9fa; border-radius: 0 0 8px 8px;">
                        <div class="row">
                            <div class="col-6">
                                <img src="${facility.image}" alt="${facility.label}" class="img-fluid rounded" style="width: 250px; height: 250px; object-fit: cover;">
                            </div>
                            <div class="col-6">
                                <p class="mb-0" style="font-size: 0.9rem; line-height: 1.6;">${facility.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    facilitiesBox.innerHTML = html;

    // Add event listeners for chevron rotation
    document.querySelectorAll('.facility-header').forEach(header => {
        header.addEventListener('click', function () {
            const chevron = this.querySelector('.chevron-icon');
            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            // Toggle chevron direction
            if (chevron.classList.contains('bi-chevron-right')) {
                chevron.classList.remove('bi-chevron-right');
                chevron.classList.add('bi-chevron-down');
            } else {
                chevron.classList.remove('bi-chevron-down');
                chevron.classList.add('bi-chevron-right');
            }
        });
    });
}

function updateOperationalData(port) {
    const operationalBox = document.getElementById('bentoCongestion');
    const congestion = parseFloat(port.portCongestionIndex);

    let congestionLevel = 'Low';
    let congestionClass = 'congestion-low';
    if (congestion > 70) {
        congestionLevel = 'High';
        congestionClass = 'congestion-high';
    } else if (congestion > 40) {
        congestionLevel = 'Medium';
        congestionClass = 'congestion-medium';
    }

    // Helper function
    const displayValue = (value, suffix = '') => {
        return value ? `${value}${suffix}` : '<span class="text-muted fst-italic">Unknown</span>';
    };

    // Shelter afforded display
    const shelterMap = {
        'E': '<span class="badge bg-success">Excellent</span>',
        'G': '<span class="badge bg-primary">Good</span>',
        'F': '<span class="badge bg-warning">Fair</span>',
        'P': '<span class="badge bg-danger">Poor</span>',
        'N': '<span class="badge bg-secondary">None</span>'
    };
    const shelterDisplay = port.shelterAfforded ? shelterMap[port.shelterAfforded] : '<span class="text-muted fst-italic">Unknown</span>';

    // Entrance restrictions
    const restrictions = port.entranceRestrictions || {};
    const restrictionBadges = [];
    if (restrictions.tide) restrictionBadges.push('<span class="badge bg-warning"><i class="bi bi-water me-1"></i>Tide</span>');
    if (restrictions.swell) restrictionBadges.push('<span class="badge bg-warning"><i class="bi bi-tsunami me-1"></i>Swell</span>');
    if (restrictions.ice) restrictionBadges.push('<span class="badge bg-info"><i class="bi bi-snow me-1"></i>Ice</span>');
    const restrictionsHTML = restrictionBadges.length > 0 ? restrictionBadges.join(' ') : '<span class="text-muted fst-italic">None reported</span>';

    // Quarantine
    const quarantine = port.quarantine || {};
    const quarantineBadges = [];
    if (quarantine.pratique) quarantineBadges.push('<span class="badge bg-success">Pratique</span>');
    if (quarantine.sanitation) quarantineBadges.push('<span class="badge bg-success">Sanitation</span>');
    const quarantineHTML = quarantineBadges.length > 0 ? quarantineBadges.join(' ') : '<span class="text-muted fst-italic">Unknown</span>';

    operationalBox.innerHTML = `
        <h6 class="mb-3"><i class="bi bi-speedometer2 me-2"></i>Operational Data</h6>
        
            <!-- Congestion Section -->
        <div class="mb-3 pb-3 border-bottom">
            <small class="text-muted d-block mb-2">PORT CONGESTION</small>
            <div class="congestion-indicator">
                <div class="congestion-bar">
                    <div class="congestion-fill ${congestionClass}" style="width: ${congestion}%"></div>
                </div>
                <div class="congestion-value text-${congestionLevel === 'High' ? 'danger' : congestionLevel === 'Medium' ? 'warning' : 'success'}">
                    ${congestion.toFixed(0)}%
                </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2">
                <small class="text-muted">
                    Level: <strong>${congestionLevel}</strong>
                    (~${convertCongestionToHours(congestion).toFixed(1)} hours wait)
                </small>
                ${port.congestionLastUpdated ? `
                    <small class="${getDataAgeClass(port.congestionLastUpdated)}">
                        Updated ${getDataAgeText(port.congestionLastUpdated)}
                    </small>
                ` : '<small class="text-muted">No update date</small>'}
            </div>
        </div>
                
        <!-- Depths Section -->
        <div class="mb-3 pb-3 border-bottom">
            <small class="text-muted d-block mb-2">HARBOR DEPTHS</small>
            <div class="row g-2">
                <div class="col-4">
                    <div class="text-center p-2 bg-light rounded">
                        <div class="fw-bold">${displayValue(port.channelDepth, 'm')}</div>
                        <small class="text-muted">Channel</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="text-center p-2 bg-light rounded">
                        <div class="fw-bold">${displayValue(port.anchorageDepth, 'm')}</div>
                        <small class="text-muted">Anchorage</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="text-center p-2 bg-light rounded">
                        <div class="fw-bold">${displayValue(port.cargoPierDepth, 'm')}</div>
                        <small class="text-muted">Pier</small>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Conditions Section -->
        <div class="mb-3 pb-3 border-bottom">
            <small class="text-muted d-block mb-2">CONDITIONS</small>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted">Shelter:</span>
                ${shelterDisplay}
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-muted">Holding Ground:</span>
                <strong>${port.goodHoldingGround ? '<span class="text-success">Good</span>' : '<span class="text-muted fst-italic">Unknown</span>'}</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-muted">Turning Area:</span>
                <strong>${port.turningArea ? '<span class="text-success">Available</span>' : '<span class="text-muted fst-italic">Unknown</span>'}</strong>
            </div>
        </div>
        
        <!-- Restrictions Section -->
        <div class="mb-3 pb-3 border-bottom">
            <small class="text-muted d-block mb-2">ENTRANCE RESTRICTIONS</small>
            <div>${restrictionsHTML}</div>
        </div>
        
        <!-- Quarantine Section -->
        <div>
            <small class="text-muted d-block mb-2">QUARANTINE SERVICES</small>
            <div>${quarantineHTML}</div>
        </div>
    `;
}

function highlightTableRow(portId) {
    // Remove previous highlights
    document.querySelectorAll('#port-data-table tbody tr').forEach(row => {
        row.classList.remove('table-active');
    });

    // Highlight the selected row
    const rows = document.querySelectorAll('#port-data-table tbody tr');
    rows.forEach(row => {
        const editBtn = row.querySelector('.edit-btn');
        if (editBtn && editBtn.dataset.portId == portId) {
            row.classList.add('table-active');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

function openEditModal(portId) {
    const editButton = document.querySelector(`.edit-btn[data-port-id="${portId}"]`);
    if (editButton) {
        editButton.click();
    }
}

// ===== CSV IMPORT FUNCTIONS =====

function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name);
    showLoader();

    // Reset error display
    document.getElementById('importErrors').classList.add('d-none');
    document.getElementById('errorList').innerHTML = '';

    // Check file type
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Handle Excel file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                console.log('Excel parsed, total rows:', jsonData.length);
                console.log('First row sample:', jsonData[0]);
                
                processImportData(jsonData);
                
            } catch (error) {
                hideLoader();
                console.error('Excel parsing error:', error);
                showAlert(`Excel parsing error: ${error.message}`, 'danger');
            }
        };
        
        reader.onerror = function() {
            hideLoader();
            showAlert('Failed to read Excel file', 'danger');
        };
        
        reader.readAsArrayBuffer(file);
        
    } else {
        // Handle CSV file (existing Papa Parse logic)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                console.log('CSV parsed, total rows:', results.data.length);
                console.log('First row sample:', results.data[0]);
                
                processImportData(results.data);
            },
            error: function (error) {
                hideLoader();
                console.error('CSV parsing error:', error);
                showAlert(`CSV parsing error: ${error.message}`, 'danger');
            }
        });
    }
}

function processImportData(data) {
    hideLoader();
    
    // Normalize column names (handle both export and template formats)
    const normalizedData = data.map(row => {
        const normalized = {};
        
        // Map common variations
        Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase().trim();
            
            // Handle different column name formats
            if (lowerKey === 'port id') {
                // Skip Port ID from exports - it's auto-generated
                return;
            } else if (lowerKey === 'port congestion index') {
                // Skip congestion index - we set default value
                return;
            } else if (lowerKey === 'portname' || lowerKey === 'port name') {
                normalized['portName'] = row[key];
            } else if (lowerKey === 'countryname' || lowerKey === 'country name') {
                normalized['countryName'] = row[key];
            } else {
                // Keep original key
                normalized[key] = row[key];
            }
        });
        
        return normalized;
    });
    
    // Validate all rows and collect errors
    const allErrors = [];
    normalizedData.forEach((row, index) => {
        const rowErrors = validatePortRow(row, index);
        allErrors.push(...rowErrors);
    });

    // Display errors if any
    if (allErrors.length > 0) {
        const errorList = document.getElementById('errorList');
        errorList.innerHTML = '<ul class="mb-0">' + 
            allErrors.map(err => `<li>${err}</li>`).join('') + 
            '</ul>';
        document.getElementById('importErrors').classList.remove('d-none');
    }

    // Process data (will skip invalid rows)
    parsedImportData = processWPIData(normalizedData);
    console.log('Processed ports:', parsedImportData.length);
    
    if (parsedImportData.length === 0) {
        showAlert('No valid ports found in file. Please check the errors above and correct your data.', 'warning');
        return;
    }

    if (parsedImportData.length < normalizedData.length) {
        showAlert(
            `${parsedImportData.length} valid ports found out of ${normalizedData.length} rows. Invalid rows were skipped.`, 
            'warning'
        );
    }

    console.log('First processed port:', parsedImportData[0]);
    displayImportPreview(parsedImportData);
}

function validatePortRow(row, rowIndex) {
    const errors = [];
    const rowNum = rowIndex + 2; // +2 because: +1 for header, +1 for 0-based index

    // Helper to safely get string value
    const getStringValue = (val) => {
        if (val === null || val === undefined) return '';
        return String(val).trim();
    };

    // Required fields validation
    const portName = getStringValue(row.portName);
    if (!portName) {
        errors.push(`Row ${rowNum}: Port name is required`);
    }
    
    const countryName = getStringValue(row.countryName);
    if (!countryName) {
        errors.push(`Row ${rowNum}: Country name is required`);
    }

    // Coordinate validation
    const latStr = getStringValue(row.latitude);
    if (!latStr) {
        errors.push(`Row ${rowNum}: Latitude is required`);
    } else {
        const lat = parseFloat(row.latitude);
        if (isNaN(lat)) {
            errors.push(`Row ${rowNum}: Invalid latitude format "${row.latitude}" (use decimal degrees)`);
        } else if (lat < -90 || lat > 90) {
            errors.push(`Row ${rowNum}: Latitude must be between -90 and 90 (got ${lat})`);
        }
    }

    const lonStr = getStringValue(row.longitude);
    if (!lonStr) {
        errors.push(`Row ${rowNum}: Longitude is required`);
    } else {
        const lon = parseFloat(row.longitude);
        if (isNaN(lon)) {
            errors.push(`Row ${rowNum}: Invalid longitude format "${row.longitude}" (use decimal degrees)`);
        } else if (lon < -180 || lon > 180) {
            errors.push(`Row ${rowNum}: Longitude must be between -180 and 180 (got ${lon})`);
        }
    }

    // Harbor size validation
    const harborSize = getStringValue(row.harborSize);
    if (harborSize && !['L', 'M', 'S', 'V'].includes(harborSize.toUpperCase())) {
        errors.push(`Row ${rowNum}: Invalid harbor size "${harborSize}" (use L, M, S, or V)`);
    }

    // Harbor type validation
    const validHarborTypes = ['CB', 'CN', 'CT', 'LC', 'OR', 'RB', 'RN', 'RT', 'TH'];
    const harborType = getStringValue(row.harborType);
    if (harborType && !validHarborTypes.includes(harborType.toUpperCase())) {
        errors.push(`Row ${rowNum}: Invalid harbor type "${harborType}" (use CB, CN, CT, LC, OR, RB, RN, RT, or TH)`);
    }

    // Shelter validation
    const validShelter = ['E', 'G', 'F', 'P', 'N'];
    const shelter = getStringValue(row.shelter);
    if (shelter && !validShelter.includes(shelter.toUpperCase())) {
        errors.push(`Row ${rowNum}: Invalid shelter value "${shelter}" (use E, G, F, P, or N)`);
    }

    // Y/N field validation
    const ynFields = [
        { key: 'firstPortOfEntry', label: 'First Port of Entry' },
        { key: 'goodHoldingGround', label: 'Good Holding Ground' },
        { key: 'turningArea', label: 'Turning Area' },
        { key: 'suWater', label: 'Potable Water' },
        { key: 'suProvisions', label: 'Provisions' },
        { key: 'ptAvailable', label: 'Pilot Service' },
        { key: 'tugsAssist', label: 'Tug Service' },
        { key: 'medFacilities', label: 'Medical Facilities' },
        { key: 'garbageDisposal', label: 'Garbage Disposal' },
        { key: 'dirtyBallast', label: 'Ballast Disposal' },
        { key: 'repairCode', label: 'Repair Facilities' },
        { key: 'erTide', label: 'Tide Restriction' },
        { key: 'erSwell', label: 'Swell Restriction' },
        { key: 'erIce', label: 'Ice Restriction' },
        { key: 'qtPratique', label: 'Pratique' },
        { key: 'qtSanitation', label: 'Sanitation' }
    ];

    ynFields.forEach(field => {
        const fieldValue = getStringValue(row[field.key]);
        if (fieldValue) {
            const val = fieldValue.toUpperCase();
            if (!['Y', 'N'].includes(val)) {
                errors.push(`Row ${rowNum}: ${field.label} must be Y or N (got "${row[field.key]}")`);
            }
        }
    });

    // Numeric field validation
    const numericFields = [
        { key: 'maxVesselLength', label: 'Max Vessel Length', min: 0, max: 500 },
        { key: 'maxVesselBeam', label: 'Max Vessel Beam', min: 0, max: 100 },
        { key: 'maxVesselDraft', label: 'Max Vessel Draft', min: 0, max: 30 },
        { key: 'chDepth', label: 'Channel Depth', min: 0, max: 50 },
        { key: 'anDepth', label: 'Anchorage Depth', min: 0, max: 50 },
        { key: 'cpDepth', label: 'Cargo Pier Depth', min: 0, max: 50 }
    ];

    numericFields.forEach(field => {
        const fieldValue = row[field.key];
        if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
            const val = parseFloat(fieldValue);
            if (isNaN(val)) {
                errors.push(`Row ${rowNum}: ${field.label} must be a number (got "${fieldValue}")`);
            } else if (val < field.min || val > field.max) {
                errors.push(`Row ${rowNum}: ${field.label} must be between ${field.min} and ${field.max} (got ${val})`);
            }
        }
    });

    return errors;
}

function processWPIData(data) {
    const processed = [];

    data.forEach((row, index) => {
        // Skip rows with missing essential data - validation already handled
        if (!row.portName || !row.latitude || !row.longitude) return;

        // Parse coordinates - handle both DMS and decimal formats
        let lat, lon;

        if (typeof row.latitude === 'string' && row.latitude.includes('°')) {
            lat = parseCoordinate(row.latitude);
            lon = parseCoordinate(row.longitude);
        } else {
            lat = parseFloat(row.latitude);
            lon = parseFloat(row.longitude);
        }

        // Validate coordinates - skip if invalid
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;

        // Helper to convert WPI Y/N/U to boolean
        const toBool = (val) => {
            if (typeof val === 'string') {
                val = val.trim().toUpperCase();
            }
            return val === 'Y' ? true : val === 'N' ? false : null;
        };

        // Helper to parse numeric values with validation
        const toNum = (val, min = 0, max = 1000) => {
            if (!val) return null;
            const num = parseFloat(val);
            if (isNaN(num) || num < min || num > max) return null;
            return num;
        };

        const portData = {
            // Basic info
            name: row.portName.trim(),
            country: row.countryName ? row.countryName.trim() : 'Unknown',
            latitude: lat,
            longitude: lon,
            portCongestionIndex: 50,

            // Port Profile
            harborSize: row.harborSize && ['L', 'M', 'S', 'V'].includes(row.harborSize.toUpperCase()) ? row.harborSize.toUpperCase() : null,
            harborType: row.harborType || null,
            maxVesselLength: toNum(row.maxVesselLength, 0, 500),
            maxVesselBeam: toNum(row.maxVesselBeam, 0, 100),
            maxVesselDraft: toNum(row.maxVesselDraft, 0, 30),
            firstPortOfEntry: toBool(row.firstPortOfEntry),

            // Operational Data
            channelDepth: toNum(row.chDepth, 0, 50),
            anchorageDepth: toNum(row.anDepth, 0, 50),
            cargoPierDepth: toNum(row.cpDepth, 0, 50),
            shelterAfforded: row.shelter && ['E', 'G', 'F', 'P', 'N'].includes(row.shelter.toUpperCase()) ? row.shelter.toUpperCase() : null,
            goodHoldingGround: toBool(row.goodHoldingGround),
            turningArea: toBool(row.turningArea),

            // Facilities
            facilities: {
                potableWater: toBool(row.suWater),
                provisions: toBool(row.suProvisions),
                pilotService: toBool(row.ptAvailable),
                tugService: toBool(row.tugsAssist),
                medicalFacilities: toBool(row.medFacilities),
                garbageDisposal: toBool(row.garbageDisposal),
                ballastDisposal: toBool(row.dirtyBallast),
                repairFacilities: row.repairCode && toBool(row.repairCode)
            },

            // Entrance restrictions
            entranceRestrictions: {
                tide: toBool(row.erTide),
                swell: toBool(row.erSwell),
                ice: toBool(row.erIce)
            },

            // Quarantine
            quarantine: {
                pratique: toBool(row.qtPratique),
                sanitation: toBool(row.qtSanitation)
            },

            _originalIndex: index,
            _selected: false
        };

        processed.push(portData);
    });

    return processed;
}

// ADD this helper function to parse DMS coordinates like "21°02'00\"N"
function parseCoordinate(dmsString) {
    if (!dmsString) return null;

    // Match pattern like: 21°02'00"N or 107°22'00"E
    const regex = /(\d+)°(\d+)'(\d+)"([NSEW])/;
    const match = dmsString.match(regex);

    if (!match) return null;

    const [, degrees, minutes, seconds, direction] = match;
    let decimal = parseInt(degrees) + parseInt(minutes) / 60 + parseInt(seconds) / 3600;

    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }

    return decimal;
}

function displayImportPreview(ports) {
    if (ports.length === 0) {
        showAlert('No valid ports found in CSV file', 'warning');
        return;
    }

    const previewDiv = document.getElementById('importPreview');
    const tableDiv = document.getElementById('portPreviewTable');

    let html = `
        <table class="table table-sm table-hover">
            <thead class="table-light sticky-top">
                <tr>
                    <th style="width: 50px;">
                        <input type="checkbox" id="toggleAllCheckbox" class="form-check-input">
                    </th>
                    <th>Port Name</th>
                    <th>Country</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Harbor Size</th>
                </tr>
            </thead>
            <tbody>
    `;

    ports.forEach((port, index) => {
        html += `
            <tr>
                <td>
                    <input type="checkbox" class="form-check-input port-import-checkbox" data-index="${index}">
                </td>
                <td>${port.name}</td>
                <td>${port.country}</td>
                <td>${port.latitude.toFixed(4)}</td>
                <td>${port.longitude.toFixed(4)}</td>
                <td>${port.harborSize || 'N/A'}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;

    previewDiv.classList.remove('d-none');
    document.getElementById('confirmImportBtn').disabled = false;

    // Add checkbox listeners
    document.querySelectorAll('.port-import-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedCount);
    });

    document.getElementById('toggleAllCheckbox').addEventListener('change', function () {
        const checkboxes = document.querySelectorAll('.port-import-checkbox');
        checkboxes.forEach(cb => cb.checked = this.checked);
        updateSelectedCount();
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    const selected = document.querySelectorAll('.port-import-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = `${selected} selected`;
    document.getElementById('confirmImportBtn').disabled = selected === 0;
}

function selectAllImportPorts() {
    document.querySelectorAll('.port-import-checkbox').forEach(cb => cb.checked = true);
    document.getElementById('toggleAllCheckbox').checked = true;
    updateSelectedCount();
}

function deselectAllImportPorts() {
    document.querySelectorAll('.port-import-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('toggleAllCheckbox').checked = false;
    updateSelectedCount();
}

async function confirmImport() {

    console.log('confirmImport function called!');

    const selectedCheckboxes = document.querySelectorAll('.port-import-checkbox:checked');
    const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
    const portsToImport = selectedIndices.map(i => parsedImportData[i]);

    console.log('Selected ports:', portsToImport);

    if (portsToImport.length === 0) {
        showAlert('Please select at least one port to import', 'warning');
        return;
    }

    // Show progress
    document.getElementById('importPreview').classList.add('d-none');
    document.getElementById('importProgress').classList.remove('d-none');
    document.getElementById('confirmImportBtn').disabled = true;

    let imported = 0;
    let failed = 0;

    for (let i = 0; i < portsToImport.length; i++) {
        const port = portsToImport[i];
        const progress = ((i + 1) / portsToImport.length) * 100;

        document.getElementById('importProgressBar').style.width = `${progress}%`;
        document.getElementById('importStatusText').textContent =
            `Importing ${i + 1} of ${portsToImport.length}: ${port.name}`;

        try {
            await addPort(port);
            imported++;
        } catch (error) {
            console.error(`Failed to import ${port.name}:`, error);
            failed++;
        }

        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Hide progress and close modal
    document.getElementById('importProgress').classList.add('d-none');
    importModal.hide();

    // Show results
    showAlert(
        `Import complete! ${imported} ports imported successfully${failed > 0 ? `, ${failed} failed` : ''}.`,
        failed > 0 ? 'warning' : 'success'
    );

    // Refresh the page
    loadAndRenderPorts();

    // Reset the form
    document.getElementById('csvFileInput').value = '';
    document.getElementById('importPreview').classList.add('d-none');
    parsedImportData = [];
}

// NEW: Update Reviews Box
async function updateReviews(port) {
    const reviewsBox = document.getElementById('bentoReviews');

    try {
        const [summary, reviews, myReview] = await Promise.all([
            getPortReviewsSummary(port.id),
            getPortReviews(port.id),
            getMyPortReview(port.id)
        ]);

        const avgRating = summary.averageRating || 0;
        const totalReviews = summary.totalReviews || 0;
        const recentReviews = reviews.slice(0, 3);

        // Generate star display
        const starDisplay = generateStarDisplay(avgRating);

        reviewsBox.innerHTML = `
            <h6 class="mb-3">
                <i class="bi bi-star me-2"></i>Port Reviews & Ratings
            </h6>
            
            <div class="row mb-3">
                <div class="col-md-4 text-center">
                    <div style="font-size: 3rem; font-weight: bold; color: #0d6efd;">
                        ${avgRating.toFixed(1)}
                    </div>
                    <div class="star-rating justify-content-center mb-2">
                        ${starDisplay}
                    </div>
                    <small class="text-muted">Based on ${totalReviews} review${totalReviews !== 1 ? 's' : ''}</small>
                </div>
                
                <div class="col-md-8">
                    ${generateRatingDistribution(summary.distribution, totalReviews)}
                </div>
            </div>
            
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">Recent Reviews</h6>
                <button class="btn btn-sm btn-primary" onclick="openAddReviewModal(${port.id}, ${myReview.hasReview}, ${myReview.hasReview ? myReview.rating : 0}, '${myReview.hasReview && myReview.comment ? myReview.comment.replace(/'/g, "\\'") : ''}', ${myReview.hasReview ? myReview.id : 0})">
                    <i class="bi bi-${myReview.hasReview ? 'pencil' : 'plus-circle'} me-1"></i>
                    ${myReview.hasReview ? 'Edit My Review' : 'Add Review'}
                </button>
            </div>
            
            ${recentReviews.length > 0 ? recentReviews.map(review => generateReviewCard(review, port.id)).join('') : '<p class="text-muted text-center py-3">No reviews yet. Be the first to review this port!</p>'}
            
            ${totalReviews > 3 ? `
                <button class="btn btn-outline-primary w-100 mt-2" onclick="viewAllReviews(${port.id})">
                    View All ${totalReviews} Reviews
                </button>
            ` : ''}
        `;

    } catch (error) {
        console.error('Failed to load reviews:', error);
        reviewsBox.innerHTML = `
            <h6 class="mb-3"><i class="bi bi-star me-2"></i>Port Reviews & Ratings</h6>
            <p class="text-danger">Failed to load reviews</p>
        `;
    }
}

function generateStarDisplay(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="bi bi-star-fill"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="bi bi-star-half"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="bi bi-star"></i>';
    }
    return stars;
}

function generateRatingDistribution(distribution, total) {
    if (total === 0) return '<p class="text-muted">No ratings yet</p>';

    let html = '<div class="rating-distribution">';
    for (let i = 5; i >= 1; i--) {
        const count = distribution[i] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;

        html += `
            <div class="rating-bar-row">
                <span style="min-width: 60px;">${i} <i class="bi bi-star-fill" style="color: #ffc107;"></i></span>
                <div class="rating-bar">
                    <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <span style="min-width: 30px; text-align: right;">${count}</span>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

function generateReviewCard(review, portId) {
    const starDisplay = generateStarDisplay(review.rating);
    const reviewDate = new Date(review.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const isEdited = review.createdAt !== review.updatedAt;

    return `
        <div class="review-card">
            <div class="review-header">
                <div>
                    <strong>${review.username}</strong>
                    <div class="star-rating">
                        ${starDisplay}
                    </div>
                </div>
                <div class="review-meta">
                    ${reviewDate}${isEdited ? ' <span class="text-muted">(edited)</span>' : ''}
                    ${review.isOwner ? `
                        <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteReview(${portId}, ${review.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            ${review.comment ? `<p class="mb-0">${review.comment}</p>` : '<p class="text-muted mb-0 fst-italic">No comment provided</p>'}
        </div>
    `;
}

// Initialize star rating input
function initializeStarRating() {
    const stars = document.querySelectorAll('.star-rating-input i');

    stars.forEach(star => {
        star.addEventListener('click', function () {
            const rating = parseInt(this.dataset.rating);
            document.getElementById('reviewRating').value = rating;

            // Update visual state
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });

            // Clear error
            document.getElementById('ratingError').style.display = 'none';
        });

        star.addEventListener('mouseenter', function () {
            const rating = parseInt(this.dataset.rating);
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.classList.add('hover-active');
                }
            });
        });

        star.addEventListener('mouseleave', function () {
            stars.forEach(s => s.classList.remove('hover-active'));
        });
    });
}

// Update character count for review comment
function updateCharCount() {
    const comment = document.getElementById('reviewComment').value;
    const charCount = document.getElementById('commentCharCount');
    const length = comment.length;

    charCount.textContent = length;

    if (length > 500) {
        charCount.classList.add('text-danger');
        document.getElementById('reviewComment').value = comment.substring(0, 500);
        charCount.textContent = 500;
    } else {
        charCount.classList.remove('text-danger');
    }
}

// Open Add/Edit Review Modal
window.openAddReviewModal = function (portId, hasReview, rating, comment, reviewId) {
    const modalTitle = document.getElementById('reviewModalLabel');
    const form = document.getElementById('reviewForm');

    form.reset();
    document.getElementById('reviewPortId').value = portId;
    document.getElementById('reviewId').value = hasReview ? reviewId : '';

    modalTitle.textContent = hasReview ? 'Edit Your Review' : 'Add Your Review';

    // Reset stars
    const stars = document.querySelectorAll('.star-rating-input i');
    stars.forEach(s => s.classList.remove('active'));

    if (hasReview) {
        document.getElementById('reviewRating').value = rating;
        document.getElementById('reviewComment').value = comment || '';

        // Set stars
        stars.forEach((s, index) => {
            if (index < rating) {
                s.classList.add('active');
            }
        });

        updateCharCount();
    } else {
        document.getElementById('reviewRating').value = '';
        document.getElementById('commentCharCount').textContent = '0';
    }

    reviewModal.show();
    initializeTooltips();
};

// Handle review form submission
async function handleSubmitReview(event) {
    event.preventDefault();

    const portId = document.getElementById('reviewPortId').value;
    const rating = document.getElementById('reviewRating').value;
    const comment = document.getElementById('reviewComment').value.trim();

    // Validation
    if (!rating) {
        document.getElementById('ratingError').style.display = 'block';
        return;
    }

    const reviewData = {
        rating: parseInt(rating),
        comment: comment || null
    };

    try {
        await addPortReview(portId, reviewData);
        reviewModal.hide();
        toastr.success('Review submitted successfully!');

        // Refresh reviews for current port
        const currentPort = allPorts.find(p => p.id == portId);
        if (currentPort) {
            updateReviews(currentPort);
        }
    } catch (error) {
        toastr.error('Failed to submit review. Please try again.');
    }
}

// View All Reviews
let currentReviewPortId = null;
let allReviewsData = [];

window.viewAllReviews = async function (portId) {
    currentReviewPortId = portId;

    try {
        allReviewsData = await getPortReviews(portId);
        const port = allPorts.find(p => p.id === portId);

        document.getElementById('allReviewsModalLabel').innerHTML =
            `<i class="bi bi-star me-2"></i>All Reviews - ${port ? port.name : 'Port'}`;

        renderAllReviews(allReviewsData);
        allReviewsModal.show();
    } catch (error) {
        toastr.error('Failed to load reviews');
    }
};

// Handle review sort order change
function handleReviewSortChange() {
    const sortOrder = document.getElementById('reviewSortOrder').value;
    let sortedReviews = [...allReviewsData];

    switch (sortOrder) {
        case 'newest':
            sortedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            sortedReviews.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'highest':
            sortedReviews.sort((a, b) => b.rating - a.rating);
            break;
        case 'lowest':
            sortedReviews.sort((a, b) => a.rating - b.rating);
            break;
    }

    renderAllReviews(sortedReviews);
}

// Render all reviews in modal
function renderAllReviews(reviews) {
    const container = document.getElementById('allReviewsContent');

    if (reviews.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">No reviews yet for this port.</p>';
        return;
    }

    container.innerHTML = reviews.map(review => generateReviewCard(review, currentReviewPortId)).join('');
}

window.deleteReview = async function (portId, reviewId) {
    const result = await Swal.fire({
        title: 'Delete Review?',
        text: 'Are you sure you want to delete your review? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
        try {
            await deletePortReview(portId, reviewId);
            toastr.success('Review deleted successfully');
            // Refresh the current port's reviews
            const currentPort = allPorts.find(p => p.id === portId);
            if (currentPort) {
                updateReviews(currentPort);
            }
        } catch (error) {
            toastr.error('Failed to delete review');
        }
    }
};