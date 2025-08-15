import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getVessels, addVessel, deleteVessel } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

// Store the full list of vessels for fast client-side searching
let allVessels = [];

// Map vessel type values to human-readable names
const vesselTypeMap = {
    container: 'Container Ship',
    bulk: 'Bulk Carrier',
    tanker: 'Tanker',
    passenger: 'Passenger Ship',
    fishing: 'Fishing Vessel',
    cargo: 'General Cargo'
};

document.addEventListener('DOMContentLoaded', async () => { 
    if (!checkAuth()) return;
        
    await loadLayout();

    // Standard initializations
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Page-specific initializations
    initializeVesselDataPage();
});

/**
 * Main function to set up the vessel data page.
 */
async function initializeVesselDataPage() {
    try {
        allVessels = await getVessels();
        renderVesselsTable(allVessels);
    } catch (error) {
        showAlert('Could not load vessel data.', 'danger');
    }

    // Set up event listeners
    document.getElementById('vesselUploadForm').addEventListener('submit', handleAddVessel);
    document.querySelector('.form-control[placeholder="Search vessels..."]').addEventListener('input', handleSearch);
}

/**
 * Renders the vessel data into the main table.
 * @param {Array<Object>} vessels - The array of vessel objects to display.
 */
function renderVesselsTable(vessels) {
    const tableBody = document.querySelector('#vessel-data-table tbody');
    tableBody.innerHTML = ''; // Clear previous content

    if (vessels.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No vessels found.</td></tr>';
        return;
    }

    vessels.forEach(vessel => {
        const row = document.createElement('tr');
        row.dataset.vesselId = vessel.id;
        row.innerHTML = `
            <td>${vessel.id}</td>
            <td>${vessel.name}</td>
            <td>${vesselTypeMap[vessel.type] || 'Unknown'}</td>
            <td>${vessel.maxSpeed}</td>
            <td>${vessel.fuelConsumption}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-btn" title="Delete Vessel">
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
 * Handles form submission for adding a new vessel.
 */
async function handleAddVessel(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const newVessel = {
        name: document.getElementById('vesselName').value,
        type: document.getElementById('vesselType').value,
        maxSpeed: parseFloat(document.getElementById('maxSpeed').value),
        fuelConsumption: parseFloat(document.getElementById('fuelConsumption').value)
    };

    // Validation
    if (!newVessel.name || !newVessel.type || isNaN(newVessel.maxSpeed) || isNaN(newVessel.fuelConsumption)) {
        showAlert('Please fill in all fields with valid data.', 'warning');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    try {
        allVessels = await addVessel(newVessel);
        renderVesselsTable(allVessels);
        showAlert('Vessel added successfully!', 'success');
        form.reset();
    } catch (error) {
        showAlert('Failed to add vessel.', 'danger');
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
        const vesselId = row.dataset.vesselId;
        const vesselName = row.cells[1].textContent;

        if (confirm(`Are you sure you want to delete "${vesselName}"?`)) {
            try {
                allVessels = await deleteVessel(vesselId);
                renderVesselsTable(allVessels);
                showAlert(`Vessel "${vesselName}" deleted successfully.`, 'success');
            } catch (error) {
                showAlert('Failed to delete vessel.', 'danger');
            }
        }
    }
}

/**
 * Filters the displayed vessels based on the search input.
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    
    const filteredVessels = allVessels.filter(vessel => 
        vessel.name.toLowerCase().includes(searchTerm) ||
        (vesselTypeMap[vessel.type] || '').toLowerCase().includes(searchTerm)
    );

    renderVesselsTable(filteredVessels);
}