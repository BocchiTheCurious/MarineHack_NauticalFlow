import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader } from './modules/utils.js';
import { loadLayout } from './modules/layout.js';

// Chart instances
let optimizationChart, fuelTypeChart, weeklyActivityChart, vesselUsageChart;

// Hardcoded Data
const hardcodedData = {
    optimizations: [
        { timestamp: '2024-10-10T08:30:00', route: 'Singapore → Hong Kong', vessel: 'Pacific Explorer', fuelSaved: '2,340 L', co2Reduced: '6.2 tons', timeSaved: '4.5 hrs' },
        { timestamp: '2024-10-09T14:15:00', route: 'Rotterdam → New York', vessel: 'Atlantic Queen', fuelSaved: '5,120 L', co2Reduced: '13.6 tons', timeSaved: '8.2 hrs' },
        { timestamp: '2024-10-08T09:45:00', route: 'Shanghai → Los Angeles', vessel: 'Pacific Explorer', fuelSaved: '7,890 L', co2Reduced: '21.0 tons', timeSaved: '12.3 hrs' },
        { timestamp: '2024-10-07T16:20:00', route: 'Dubai → Mumbai', vessel: 'Indian Ocean Star', fuelSaved: '1,560 L', co2Reduced: '4.1 tons', timeSaved: '3.2 hrs' },
        { timestamp: '2024-10-06T11:30:00', route: 'Hamburg → London', vessel: 'Northern Light', fuelSaved: '980 L', co2Reduced: '2.6 tons', timeSaved: '2.1 hrs' },
        { timestamp: '2024-10-05T13:40:00', route: 'Tokyo → San Francisco', vessel: 'Pacific Explorer', fuelSaved: '6,230 L', co2Reduced: '16.5 tons', timeSaved: '10.5 hrs' },
        { timestamp: '2024-10-04T10:10:00', route: 'Sydney → Auckland', vessel: 'Southern Cross', fuelSaved: '1,120 L', co2Reduced: '3.0 tons', timeSaved: '2.8 hrs' },
        { timestamp: '2024-10-03T15:55:00', route: 'Barcelona → Genoa', vessel: 'Mediterranean Pearl', fuelSaved: '760 L', co2Reduced: '2.0 tons', timeSaved: '1.5 hrs' },
        { timestamp: '2024-10-02T08:00:00', route: 'Cape Town → Lagos', vessel: 'African Star', fuelSaved: '3,450 L', co2Reduced: '9.2 tons', timeSaved: '6.7 hrs' },
        { timestamp: '2024-10-01T12:25:00', route: 'Miami → Havana', vessel: 'Caribbean Dream', fuelSaved: '890 L', co2Reduced: '2.4 tons', timeSaved: '1.8 hrs' }
    ],
    vessels: [
        { name: 'Pacific Explorer', fuelTypeName: 'LNG' },
        { name: 'Atlantic Queen', fuelTypeName: 'Heavy Fuel Oil' },
        { name: 'Indian Ocean Star', fuelTypeName: 'Marine Diesel' },
        { name: 'Northern Light', fuelTypeName: 'LNG' },
        { name: 'Southern Cross', fuelTypeName: 'Marine Diesel' },
        { name: 'Mediterranean Pearl', fuelTypeName: 'Marine Diesel' },
        { name: 'African Star', fuelTypeName: 'Heavy Fuel Oil' },
        { name: 'Caribbean Dream', fuelTypeName: 'Marine Diesel' },
        { name: 'Arctic Voyager', fuelTypeName: 'LNG' },
        { name: 'Baltic Runner', fuelTypeName: 'Heavy Fuel Oil' },
        { name: 'Coral Princess', fuelTypeName: 'Biofuel' },
        { name: 'Desert Wind', fuelTypeName: 'Marine Diesel' },
        { name: 'Emerald Tide', fuelTypeName: 'Biofuel' },
        { name: 'Fjord Explorer', fuelTypeName: 'LNG' },
        { name: 'Golden Horizon', fuelTypeName: 'Heavy Fuel Oil' },
        { name: 'Harmony Wave', fuelTypeName: 'Marine Diesel' },
        { name: 'Island Hopper', fuelTypeName: 'Marine Diesel' },
        { name: 'Jade Navigator', fuelTypeName: 'LNG' }
    ]
};

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

    // Set up event listener for time period filter
    const timePeriodFilter = document.getElementById('timePeriodFilter');
    if (timePeriodFilter) {
        timePeriodFilter.addEventListener('change', handleTimePeriodChange);
    }
}

/**
 * Handles changes to the time period filter.
 * In a real application, this would fetch filtered data from the API.
 */
function handleTimePeriodChange() {
    const selectedPeriod = document.getElementById('timePeriodFilter').value;
    toastr.info(`Filtering data for last ${selectedPeriod} days...`);
    // In a real app, you would fetch filtered data here
    loadAllData();
}

/**
 * Loads all charts and tables on the dashboard.
 * This is the main function that orchestrates data loading.
 */
function loadAllData() {
    loadOptimizationTrends();
    loadFuelTypeDistribution();
    loadWeeklyActivity();
    loadVesselUsage();
    loadRecentOptimizations();
    toastr.success('Dashboard data refreshed successfully!');
}

/**
 * Loads and renders the Monthly Optimization Trends line chart.
 */
function loadOptimizationTrends() {
    const labels = ['Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024', 'Jul 2024', 'Aug 2024', 'Sep 2024', 'Oct 2024'];
    const counts = [18, 22, 25, 31, 28, 35, 42, 38, 45, 52];

    const ctx = document.getElementById('optimizationTrendsChart');
    if (!ctx) return;

    if (optimizationChart) optimizationChart.destroy();

    optimizationChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Routes Optimized',
                data: counts,
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
}

/**
 * Loads and renders the Fuel Type Distribution doughnut chart.
 */
function loadFuelTypeDistribution() {
    const fuelTypeCount = {};
    hardcodedData.vessels.forEach(vessel => {
        const fuelType = vessel.fuelTypeName;
        fuelTypeCount[fuelType] = (fuelTypeCount[fuelType] || 0) + 1;
    });

    const labels = Object.keys(fuelTypeCount);
    const counts = Object.values(fuelTypeCount);
    const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#f093fb'];

    const ctx = document.getElementById('fuelTypeChart');
    if (!ctx) return;

    if (fuelTypeChart) fuelTypeChart.destroy();

    fuelTypeChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
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
}

/**
 * Loads and renders the Weekly Activity bar chart.
 */
function loadWeeklyActivity() {
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'];
    const counts = [8, 12, 15, 10, 18, 14, 20, 16];

    const ctx = document.getElementById('weeklyActivityChart');
    if (!ctx) return;

    if (weeklyActivityChart) weeklyActivityChart.destroy();

    weeklyActivityChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Optimizations',
                data: counts,
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
}

/**
 * Loads and renders the Most Used Vessels horizontal bar chart.
 */
function loadVesselUsage() {
    const labels = ['Pacific Explorer', 'Atlantic Queen', 'Northern Light', 'Indian Ocean Star', 'Southern Cross'];
    const counts = [35, 28, 24, 21, 18];
    const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#f093fb'];

    const ctx = document.getElementById('vesselUsageChart');
    if (!ctx) return;

    if (vesselUsageChart) vesselUsageChart.destroy();

    vesselUsageChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Times Used',
                data: counts,
                backgroundColor: colors,
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
}

/**
 * Loads and renders the Recent Optimizations table.
 */
function loadRecentOptimizations() {
    const tbody = document.getElementById('recentOptimizationsTable');
    if (!tbody) return;

    tbody.innerHTML = hardcodedData.optimizations.map(item => {
        const date = new Date(item.timestamp);
        return `
            <tr>
                <td>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
                <td>${item.route}</td>
                <td>${item.vessel}</td>
                <td><span class="badge badge-fuel text-white">${item.fuelSaved}</span></td>
                <td><span class="badge badge-co2 text-white">${item.co2Reduced}</span></td>
                <td>${item.timeSaved}</td>
            </tr>
        `;
    }).join('');
}

// Make loadAllData available globally for the HTML button onclick
window.loadAllData = loadAllData;