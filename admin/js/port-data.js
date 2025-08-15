import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getPorts, addPort, deletePort } from './modules/api.js';

// Store the full list of ports to enable fast client-side searching
let allPorts = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Standard initializations
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Page-specific initializations
    initializePortDataPage();
});

/**
 * Main function to set up the port data page.
 */
async function initializePortDataPage() {
    // Fetch initial data and render the table
    try {
        allPorts = await getPorts();
        renderPortsTable(allPorts);
    } catch (error) {
        showAlert('Could not load port data.', 'danger');
    }

    // Set up event listeners
    document.getElementById('portUploadForm').addEventListener('submit', handleAddPort);
    document.querySelector('.form-control[placeholder="Search ports..."]').addEventListener('input', handleSearch);
}

/**
 * Renders the port data into the main table.
 * @param {Array<Object>} ports - The array of port objects to display.
 */
function renderPortsTable(ports) {
    const tableBody = document.querySelector('#port-data-table tbody');
    tableBody.innerHTML = ''; // Clear previous content

    if (ports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No ports found.</td></tr>';
        return;
    }

    ports.forEach(port => {
        const row = document.createElement('tr');
        row.dataset.portId = port.id; // Store ID for easy access
        row.innerHTML = `
            <td>${port.id}</td>
            <td>${port.name}</td>
            <td>${port.country}</td>
            <td>${port.latitude}</td>
            <td>${port.longitude}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Port">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Use event delegation for delete buttons
    tableBody.addEventListener('click', handleDeleteClick);
}

/**
 * Handles form submission for adding a new port.
 */
async function handleAddPort(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const newPort = {
        name: document.getElementById('portName').value,
        country: document.getElementById('country').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value)
    };

    // Basic Validation
    if (!newPort.name || !newPort.country || isNaN(newPort.latitude) || isNaN(newPort.longitude)) {
        showAlert('Please fill in all fields with valid data.', 'warning');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    try {
        allPorts = await addPort(newPort);
        renderPortsTable(allPorts);
        showAlert('Port added successfully!', 'success');
        form.reset(); // Clear the form
    } catch (error) {
        showAlert('Failed to add port.', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Handles clicks within the table body to delegate delete actions.
 */
async function handleDeleteClick(event) {
    const deleteBtn = event.target.closest('.delete-btn');
    if (deleteBtn) {
        const row = deleteBtn.closest('tr');
        const portId = row.dataset.portId;
        const portName = row.cells[1].textContent;

        if (confirm(`Are you sure you want to delete "${portName}"?`)) {
            try {
                allPorts = await deletePort(portId);
                renderPortsTable(allPorts);
                showAlert(`Port "${portName}" deleted successfully.`, 'success');
            } catch (error) {
                showAlert('Failed to delete port.', 'danger');
            }
        }
    }
}

/**
 * Filters the displayed ports based on the search input.
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    
    const filteredPorts = allPorts.filter(port => 
        port.name.toLowerCase().includes(searchTerm) ||
        port.country.toLowerCase().includes(searchTerm)
    );

    renderPortsTable(filteredPorts);
}