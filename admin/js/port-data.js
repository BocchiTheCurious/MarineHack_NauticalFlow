import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getPorts, addPort, deletePort, updatePort } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

let allPorts = [];
let portModal;

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();

    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializePortDataPage();
});

async function initializePortDataPage() {
    portModal = new bootstrap.Modal(document.getElementById('portModal'));
    
    await loadAndRenderPorts();

    // --- SETUP EVENT LISTENERS ---
    document.getElementById('portForm').addEventListener('submit', handleSavePort);
    document.getElementById('port-search-input').addEventListener('input', handleSearch);
    document.querySelector('#port-data-table tbody').addEventListener('click', handleTableActions);
    document.getElementById('portModal').addEventListener('show.bs.modal', handleModalOpen);

    // **NEW**: Listen for input on the new coordinate and slider fields
    document.getElementById('locodePasteInput').addEventListener('input', handleCoordsPaste);
    document.getElementById('portCongestionIndex').addEventListener('input', handleSliderChange);
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
    const portData = {
        name: document.getElementById('portName').value,
        country: document.getElementById('country').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        portCongestionIndex: parseFloat(document.getElementById('portCongestionIndex').value)
    };
    
    // Validation
    if (!portData.name || !portData.country || isNaN(portData.latitude) || isNaN(portData.longitude)) {
        showAlert('Please ensure all fields, including latitude and longitude, are filled correctly.', 'warning');
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
    const congestionSlider = document.getElementById('portCongestionIndex');
    const congestionValue = document.getElementById('congestionValue');
    
    form.reset();
    document.getElementById('portId').value = '';

    if (portId) {
        modalTitle.textContent = 'Edit Port';
        const portToEdit = allPorts.find(p => p.id == portId);
        if (portToEdit) {
            document.getElementById('portId').value = portToEdit.id;
            document.getElementById('portName').value = portToEdit.name;
            document.getElementById('country').value = portToEdit.country;
            document.getElementById('latitude').value = portToEdit.latitude;
            document.getElementById('longitude').value = portToEdit.longitude;
            congestionSlider.value = portToEdit.portCongestionIndex;
        }
    } else {
        modalTitle.textContent = 'Add New Port';
        congestionSlider.value = 50; // Default for new entries
    }
    // Update the slider value display
    congestionValue.textContent = `${congestionSlider.value}%`;
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

    if (confirm(`Are you sure you want to delete "${portName}"?`)) {
        try {
            await deletePort(portId);
            showAlert(`Port "${portName}" deleted.`, 'success');
            loadAndRenderPorts();
        } catch (error) {
            showAlert('Failed to delete port.', 'danger');
        }
    }
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filteredPorts = allPorts.filter(port => 
        port.name.toLowerCase().includes(searchTerm) ||
        port.country.toLowerCase().includes(searchTerm)
    );
    renderPortsTable(filteredPorts);
}