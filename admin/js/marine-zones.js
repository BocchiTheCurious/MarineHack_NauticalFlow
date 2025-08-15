import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getMarineZones } from './modules/api.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Initialize common UI components
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Run the specific logic for the marine zones page
    initializeMarineZonesPage();
});

/**
 * Main function to orchestrate the fetching and rendering of marine zone data.
 */
async function initializeMarineZonesPage() {
    try {
        const zones = await getMarineZones();
        populateZoneStatistics(zones);
        populateZoneCategories(zones);
        populateZonesTable(zones);
    } catch (error) {
        showAlert('Failed to load marine zone data.', 'danger');
        console.error('Error fetching marine zones:', error);
    }

    // Add event listeners for page actions
    setupActionButtons();
}

/**
 * Calculates and displays the summary statistics in the top cards.
 * @param {Array<Object>} zones - The array of marine zone data.
 */
function populateZoneStatistics(zones) {
    const totalZones = zones.length;
    const activeZones = zones.filter(zone => zone.status === 'Active').length;
    const restrictedZones = zones.filter(zone => zone.type === 'Restricted Area').length;
    const protectedZones = zones.filter(zone => zone.type === 'Protected Area').length;

    document.querySelector('.card.border-left-primary .h5').textContent = totalZones;
    document.querySelector('.card.border-left-success .h5').textContent = activeZones;
    document.querySelector('.card.border-left-info .h5').textContent = restrictedZones;
    document.querySelector('.card.border-left-warning .h5').textContent = protectedZones;
}

/**
 * Populates the 'Zone Categories' list with counts for each type.
 * @param {Array<Object>} zones - The array of marine zone data.
 */
function populateZoneCategories(zones) {
    const categoryCounts = zones.reduce((acc, zone) => {
        acc[zone.type] = (acc[zone.type] || 0) + 1;
        return acc;
    }, {});

    document.querySelectorAll('.list-group-item').forEach(item => {
        const categoryName = item.querySelector('strong').textContent.trim();
        const badge = item.querySelector('.badge');
        if (categoryCounts[categoryName]) {
            badge.textContent = categoryCounts[categoryName];
        } else {
            badge.textContent = 0;
        }
    });
}

/**
 * Renders the marine zone data into the main table.
 * @param {Array<Object>} zones - The array of marine zone data.
 */
function populateZonesTable(zones) {
    const tableBody = document.querySelector('#marine-zones-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Clear existing static rows

    if (zones.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No marine zones found.</td></tr>';
        return;
    }

    zones.forEach(zone => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${zone.id}</td>
            <td>${zone.name}</td>
            <td>${zone.type}</td>
            <td>${zone.coordinates}</td>
            <td>${zone.area}</td>
            <td>${getStatusBadge(zone.status)}</td>
            <td>${new Date(zone.lastUpdated).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" title="Edit Zone">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" title="View Details">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Creates a Bootstrap badge based on the zone's status.
 * @param {string} status - The status text.
 * @returns {string} - HTML string for the badge.
 */
function getStatusBadge(status) {
    const statusMap = {
        'Active': 'bg-success',
        'Protected': 'bg-info',
        'Restricted': 'bg-warning',
        'Excluded': 'bg-danger',
    };
    const badgeClass = statusMap[status] || 'bg-secondary';
    return `<span class="badge ${badgeClass}">${status}</span>`;
}

/**
 * Sets up event listeners for the main action buttons.
 */
function setupActionButtons() {
    const btnToolbar = document.querySelector('.btn-toolbar');
    if (btnToolbar) {
        btnToolbar.addEventListener('click', (event) => {
            const buttonText = event.target.textContent;
            if (buttonText.includes('Add Zone')) {
                showAlert('Add Zone functionality coming soon!', 'info');
            } else if (buttonText.includes('Export Data')) {
                showAlert('Export Data functionality coming soon!', 'info');
            } else if (buttonText.includes('Update Zones')) {
                showAlert('Update Zones functionality coming soon!', 'info');
            }
        });
    }
}