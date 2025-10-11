import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert, showLoader, hideLoader } from './modules/utils.js';
import { getPorts, addPort, deletePort, updatePort } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let allPorts = [];
let portModal;
let portMap;
let mapMarkers = [];
let importModal;
let parsedImportData = [];

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

    initializeMap();
    await loadAndRenderPorts();

    document.getElementById('portForm').addEventListener('submit', handleSavePort);
    document.getElementById('port-search-input').addEventListener('input', handleSearch);
    document.querySelector('#port-data-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('portModal').addEventListener('show.bs.modal', handleModalOpen);
    document.getElementById('locodePasteInput').addEventListener('input', handleCoordsPaste);
    document.getElementById('portCongestionIndex').addEventListener('input', handleSliderChange);

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
    document.getElementById('congestionValue').textContent = `${event.target.value}%`;
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
        renderPortsTable(allPorts);
        renderMapMarkers(allPorts);
    } catch (error) {
        showAlert('Could not load port data.', 'danger');
    }
}

function renderPortsTable(ports) {
    const tableBody = document.querySelector('#port-data-table tbody');
    tableBody.innerHTML = '';

    if (ports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No ports found.</td></tr>';
        return;
    }

    ports.forEach(port => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>P${String(port.id).padStart(3, '0')}</td>
            <td>${port.name}</td>
            <td>${port.country}</td>
            <td>${parseFloat(port.latitude).toFixed(4)}</td>
            <td>${parseFloat(port.longitude).toFixed(4)}</td>
            <td>${parseFloat(port.portCongestionIndex).toFixed(2)}%</td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit Port" data-bs-toggle="modal" data-bs-target="#portModal" data-port-id="${port.id}"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Port" data-port-id="${port.id}"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
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
        { key: 'potableWater', label: 'Potable Water', icon: 'droplet' },
        { key: 'provisions', label: 'Provisions', icon: 'basket' },
        { key: 'pilotService', label: 'Pilot Service', icon: 'compass' },
        { key: 'tugService', label: 'Tugboat Service', icon: 'life-preserver' },
        { key: 'medicalFacilities', label: 'Medical Facilities', icon: 'heart-pulse' },
        { key: 'garbageDisposal', label: 'Garbage Disposal', icon: 'trash' },
        { key: 'ballastDisposal', label: 'Ballast Disposal', icon: 'water' },
        { key: 'repairFacilities', label: 'Repair Facilities', icon: 'tools' }
    ];

    let html = '<h6 class="mb-3"><i class="bi bi-buildings me-2"></i>Port Facilities</h6>';
    html += '<div class="facilities-grid">';

    facilityList.forEach(facility => {
        const available = facilities[facility.key] === true;
        const statusClass = available ? 'facility-available' : 'facility-unavailable';
        const icon = available ? 'check-circle-fill' : 'x-circle';

        html += `
            <div class="facility-item ${statusClass}">
                <i class="bi bi-${icon}"></i>
                <span>${facility.label}</span>
            </div>
        `;
    });

    html += '</div>';
    facilitiesBox.innerHTML = html;
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
            <small class="text-muted">Level: <strong>${congestionLevel}</strong></small>
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

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            hideLoader();
            console.log('CSV parsed, total rows:', results.data.length);
            console.log('First row sample:', results.data[0]);

            parsedImportData = processWPIData(results.data);
            console.log('Processed ports:', parsedImportData.length);
            console.log('First processed port:', parsedImportData[0]);

            displayImportPreview(parsedImportData);
        },
        error: function (error) {
            hideLoader();
            console.error('CSV parsing error:', error);
            showAlert(`CSV parsing error: ${error.message}`, 'danger');
        }
    });
}

function processWPIData(data) {
    const processed = [];

    data.forEach((row, index) => {
        // Skip rows with missing essential data - UPDATED COLUMN NAMES
        if (!row.portName || !row.latitude || !row.longitude) return;

        // Parse coordinates - they're in DMS format like "21°02'00\"N"
        const lat = parseCoordinate(row.latitude);
        const lon = parseCoordinate(row.longitude);
        if (lat === null || lon === null) return;

        // Helper to convert WPI Y/N/U to boolean
        const toBool = (val) => val === 'Y' ? true : val === 'N' ? false : null;

        // Helper to parse numeric values
        const toNum = (val) => val && !isNaN(parseFloat(val)) ? parseFloat(val) : null;

        const portData = {
            // Basic info - UPDATED COLUMN NAMES
            name: row.portName.trim(),
            country: row.countryName || 'Unknown',
            latitude: lat,
            longitude: lon,
            portCongestionIndex: 50,

            // Box 2: Port Profile - UPDATED COLUMN NAMES
            harborSize: row.harborSize || null,
            harborType: row.harborType || null,
            maxVesselLength: toNum(row.maxVesselLength),
            maxVesselBeam: toNum(row.maxVesselBeam),
            maxVesselDraft: toNum(row.maxVesselDraft),
            firstPortOfEntry: toBool(row.firstPortOfEntry),

            // Box 4: Operational Data - UPDATED COLUMN NAMES
            channelDepth: toNum(row.chDepth),
            anchorageDepth: toNum(row.anDepth),
            cargoPierDepth: toNum(row.cpDepth),
            shelterAfforded: row.shelter || null,
            goodHoldingGround: toBool(row.goodHoldingGround),
            turningArea: toBool(row.turningArea),

            // Box 3: Facilities - UPDATED COLUMN NAMES
            facilities: {
                potableWater: toBool(row.suWater),
                provisions: toBool(row.suProvisions),
                pilotService: toBool(row.ptAvailable),
                tugService: toBool(row.tugsAssist),
                medicalFacilities: toBool(row.medFacilities),
                garbageDisposal: toBool(row.garbageDisposal),
                ballastDisposal: toBool(row.dirtyBallast),
                repairFacilities: row.repairCode && row.repairCode !== 'N' ? true : false
            },

            // Entrance restrictions - UPDATED COLUMN NAMES
            entranceRestrictions: {
                tide: toBool(row.erTide),
                swell: toBool(row.erSwell),
                ice: toBool(row.erIce)
            },

            // Quarantine - UPDATED COLUMN NAMES
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