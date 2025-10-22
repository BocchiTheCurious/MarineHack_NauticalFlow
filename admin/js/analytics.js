import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader } from './modules/utils.js';
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
 * Loads and renders the Recent Optimizations table.
 */
async function loadRecentOptimizations() {
    try {
        const optimizations = await getRecentOptimizations(10);
        
        const tbody = document.getElementById('recentOptimizationsTable');
        if (!tbody) return;

        if (optimizations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No optimization data available yet</td></tr>';
            return;
        }

        tbody.innerHTML = optimizations.map(item => {
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
    } catch (error) {
        console.error('Error loading recent optimizations:', error);
        toastr.error('Failed to load recent optimizations');
    }
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