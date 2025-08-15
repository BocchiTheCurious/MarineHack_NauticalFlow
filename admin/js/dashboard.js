// js/dashboard.js
import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Initialize common UI components
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Initialize charts for the dashboard overview
    initializeDashboardCharts();
});

function initializeDashboardCharts() {
    // CO2 Optimization Chart
    const co2Chart = document.getElementById('co2OptimizationChart');
    if (co2Chart) {
        new Chart(co2Chart, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
                datasets: [{
                    label: 'Baseline CO2 (tons)',
                    data: [1200, 1180, 1160, 1140, 1120, 1100],
                    borderColor: 'rgb(220, 53, 69)',
                    borderDash: [5, 5],
                    tension: 0.1
                }, {
                    label: 'Optimized CO2 (tons)',
                    data: [1020, 1000, 980, 960, 940, 920],
                    borderColor: 'rgb(40, 167, 69)',
                    tension: 0.1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Fuel Consumption Chart
    const fuelChart = document.getElementById('fuelOptimizationChart');
    if (fuelChart) {
        new Chart(fuelChart, {
            type: 'bar',
            data: {
                labels: ['Route A', 'Route B', 'Route C', 'Route D'],
                datasets: [{
                    label: 'Baseline Fuel (liters)',
                    data: [9000, 8500, 9200, 8800],
                    backgroundColor: 'rgba(220, 53, 69, 0.7)'
                }, {
                    label: 'Optimized Fuel (liters)',
                    data: [7920, 7480, 8096, 7744],
                    backgroundColor: 'rgba(40, 167, 69, 0.7)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Safety Score Chart
    const safetyChart = document.getElementById('safetyOptimizationChart');
    if (safetyChart) {
        new Chart(safetyChart, {
            type: 'radar',
            data: {
                labels: ['Weather', 'Traffic', 'Depth', 'Speed', 'Route'],
                datasets: [{
                    label: 'Baseline Safety',
                    data: [85, 80, 90, 85, 88],
                    borderColor: 'rgb(220, 53, 69)',
                    backgroundColor: 'rgba(220, 53, 69, 0.2)'
                }, {
                    label: 'Optimized Safety',
                    data: [92, 88, 95, 90, 94],
                    borderColor: 'rgb(40, 167, 69)',
                    backgroundColor: 'rgba(40, 167, 69, 0.2)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Cost Optimization Chart
    const costChart = document.getElementById('costOptimizationChart');
    if (costChart) {
        new Chart(costChart, {
            type: 'doughnut',
            data: {
                labels: ['Fuel Costs', 'Port Fees', 'Maintenance', 'Other'],
                datasets: [{
                    data: [45000, 25000, 15000, 7500],
                    backgroundColor: ['#dc3545', '#ffc107', '#17a2b8', '#6c757d']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}