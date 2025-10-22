import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader, initializePagination, makeTableScrollable, initializeTableSearch, addSearchClearButton } from './modules/utils.js';
import { loadLayout } from './modules/layout.js';
import {
    getOptimizationTrends,
    getFuelTypeDistribution,
    getWeeklyActivity,
    getVesselUsageStats,
    getRecentOptimizations,
    getStatsSummary
} from './modules/api.js';

// Chart instances
let optimizationChart, fuelTypeChart, weeklyActivityChart, vesselUsageChart;

// Pagination and search state
let allOptimizations = [];
let optimizationPaginationController = null;
let optimizationSearchController = null;

/**
 * Helper function to format timestamp as Malaysia time (GMT+8)
 * @param {string} timestamp - The timestamp string from the database
 * @returns {string} Formatted date and time in Malaysia timezone
 */
function formatMalaysiaTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    // Parse the timestamp - assuming it's in UTC from the database
    // Format expected: "2025-10-22 15:58:34" or "2025-10-22T15:58:34"
    let date;
    
    // Replace space with 'T' if needed to make it ISO format
    const isoTimestamp = timestamp.replace(' ', 'T');
    
    // Add 'Z' to explicitly mark it as UTC if not already present
    if (!isoTimestamp.endsWith('Z') && !isoTimestamp.includes('+')) {
        date = new Date(isoTimestamp + 'Z');
    } else {
        date = new Date(isoTimestamp);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.error('Invalid timestamp:', timestamp);
        return timestamp; // Return original if invalid
    }

    // Format as Malaysia time (GMT+8)
    return date.toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// Configure toastr notifications
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

    initializeAnalyticsPage();

    hideLoader();
});

/**
 * Initializes the analytics page by setting up Chart.js defaults,
 * loading all charts and tables, and setting up event listeners.
 */
function initializeAnalyticsPage() {
    // Set Chart.js default configuration
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.color = '#495057';

    // Load all data on page initialization
    loadAllData();
}


/**
 * Loads all charts and tables on the dashboard.
 * This is the main function that orchestrates data loading.
 */
async function loadAllData() {
    try {
        showLoader(); // Show loading indicator

        // Load all data in parallel for better performance
        await Promise.all([
            loadStatsCards(),
            loadOptimizationTrends(),
            loadFuelTypeDistribution(),
            loadWeeklyActivity(),
            loadVesselUsage(),
            loadRecentOptimizations()
        ]);

        toastr.success('Dashboard data loaded successfully!');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        toastr.error('Failed to load some dashboard data');
    } finally {
        hideLoader(); // Hide loading indicator
    }
}

/**
 * Loads and renders the Monthly Optimization Trends line chart.
 */
async function loadOptimizationTrends() {
    try {
        const data = await getOptimizationTrends(300); // Last 10 months

        const ctx = document.getElementById('optimizationTrendsChart');
        if (!ctx) return;

        if (optimizationChart) optimizationChart.destroy();

        optimizationChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Routes Optimized',
                    data: data.counts,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading optimization trends:', error);
        toastr.error('Failed to load optimization trends');
    }
}

/**
 * Loads and renders the Fuel Type Distribution doughnut chart.
 */
async function loadFuelTypeDistribution() {
    try {
        const data = await getFuelTypeDistribution();

        const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#f093fb'];

        const ctx = document.getElementById('fuelTypeChart');
        if (!ctx) return;

        if (fuelTypeChart) fuelTypeChart.destroy();

        fuelTypeChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.counts,
                    backgroundColor: colors.slice(0, data.labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading fuel type distribution:', error);
        toastr.error('Failed to load fuel type distribution');
    }
}

/**
 * Loads and renders the Weekly Activity bar chart.
 */
async function loadWeeklyActivity() {
    try {
        const data = await getWeeklyActivity(8); // Last 8 weeks

        const ctx = document.getElementById('weeklyActivityChart');
        if (!ctx) return;

        if (weeklyActivityChart) weeklyActivityChart.destroy();

        weeklyActivityChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Optimizations',
                    data: data.counts,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: '#667eea',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading weekly activity:', error);
        toastr.error('Failed to load weekly activity');
    }
}

/**
 * Loads and renders the Most Used Vessels horizontal bar chart.
 */
async function loadVesselUsage() {
    try {
        const data = await getVesselUsageStats();

        const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#f093fb'];

        const ctx = document.getElementById('vesselUsageChart');
        if (!ctx) return;

        if (vesselUsageChart) vesselUsageChart.destroy();

        vesselUsageChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Times Used',
                    data: data.counts,
                    backgroundColor: colors.slice(0, data.labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading vessel usage:', error);
        toastr.error('Failed to load vessel usage statistics');
    }
}

/**
 * Loads and renders the Recent Optimizations table with pagination and search.
 * Uses the same utility functions as fuel-types page.
 */
async function loadRecentOptimizations() {
    try {
        // Load all optimizations (increase limit for better pagination)
        const optimizations = await getRecentOptimizations(1000);

        allOptimizations = optimizations;

        if (optimizations.length === 0) {
            const tbody = document.getElementById('recentOptimizationsTable');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No optimization data available yet</td></tr>';
            }
            return;
        }

        // Make table scrollable (only once)
        makeTableScrollable('recentOptimizationsTableWrapper', 500);

        // Initialize search with utility function
        optimizationSearchController = initializeTableSearch(
            'optimizationSearch',
            allOptimizations,
            ['route', 'vessel', 'timestamp', 'fuelSaved', 'co2Reduced', 'timeSaved'],
            (filteredData) => {
                renderOptimizationsTable(filteredData);
            },
            {
                debounceDelay: 300,
                placeholder: 'Search by route, vessel, date...',
                showResultCount: true,
                minCharacters: 0
            }
        );

        // Add clear button to search
        addSearchClearButton('optimizationSearch', () => {
            renderOptimizationsTable(allOptimizations);
        });

        // Initial render
        renderOptimizationsTable(allOptimizations);

    } catch (error) {
        console.error('Error loading recent optimizations:', error);
        toastr.error('Failed to load recent optimizations');
    }
}

/**
 * Renders the optimizations table with pagination
 * @param {Array} optimizations - Array of optimization data to display
 */
function renderOptimizationsTable(optimizations) {
    const tableBody = document.getElementById('recentOptimizationsTable');

    if (optimizations.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No results found</td></tr>';
        // Destroy pagination if no data
        if (optimizationPaginationController) {
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                paginationContainer.remove();
            }
            optimizationPaginationController = null;
        }
        return;
    }

    // Render function for a page of data
    const renderPage = (pageData) => {
        tableBody.innerHTML = '';
        pageData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatMalaysiaTime(item.timestamp)}</td>
                <td>${item.route}</td>
                <td>${item.vessel}</td>
                <td><span class="badge badge-fuel text-white">${item.fuelSaved}</span></td>
                <td><span class="badge badge-co2 text-white">${item.co2Reduced}</span></td>
                <td>${item.timeSaved}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Initialize or update pagination using utility function
    if (!optimizationPaginationController) {
        optimizationPaginationController = initializePagination(
            'recentOptimizationsTableWrapper',  // The table's parent container ID
            optimizations,
            renderPage,
            {
                itemsPerPage: 10,
                showEntriesSelector: true,
                entriesOptions: [10, 25, 50, 100],
                showInfo: true,
                scrollToTop: true,
                infoText: 'Showing {start} to {end} of {total} entries'
            }
        );
    } else {
        optimizationPaginationController.setData(optimizations);
    }

    // Initial render
    optimizationPaginationController.render();
}

/**
 * Loads and updates the stats cards with real data.
 */
async function loadStatsCards() {
    try {
        const stats = await getStatsSummary();

        // Update each stat card
        document.getElementById('totalRoutes').textContent = stats.totalRoutes.toLocaleString();
        document.getElementById('totalVessels').textContent = stats.totalVessels.toLocaleString();
        document.getElementById('totalPorts').textContent = stats.totalPorts.toLocaleString();
        document.getElementById('totalFuelTypes').textContent = stats.totalFuelTypes.toLocaleString();

    } catch (error) {
        console.error('Error loading stats cards:', error);
        // Keep the "-" placeholder if error occurs
    }
}

// Make loadAllData available globally for the HTML button onclick
window.loadAllData = loadAllData;