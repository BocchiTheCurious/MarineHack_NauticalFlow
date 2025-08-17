// NauticalFlow Admin Dashboard JavaScript for Independent Pages

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    if (localStorage.getItem('nauticalflow-logged-in') !== 'true') {
        window.location.href = '../index.html';
        return;
    }
    
    // Initialize the page
    initializePage();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    loadInitialData();

    // Initialize route selector if on results page
    if (window.location.pathname.includes('results.html')) {
        initializeRouteSelector();
    }

    // Initialize route planner if on route planner page
    if (window.location.pathname.includes('route-planner.html')) {
        initializeRoutePlanner();
    }

    // Initialize profile if on profile page
    if (window.location.pathname.includes('profile.html')) {
        initializeProfile();
    }
});

// Initialize page components
function initializePage() {
    // Set default theme
    const savedTheme = localStorage.getItem('nauticalflow-theme') || 'light';
    setTheme(savedTheme);
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Update current location
    updateCurrentLocation();
    
    // Initialize charts if they exist
    initializeCharts();
}

// Set up event listeners
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
    }
    
    // Sidebar navigation - highlight current page
    highlightCurrentPage();
    
    // Live data feed controls
    const startFeedBtn = document.getElementById('start-feed');
    const stopFeedBtn = document.getElementById('stop-feed');
    
    if (startFeedBtn) {
        startFeedBtn.addEventListener('click', function() {
            startLiveFeed();
        });
    }
    
    if (stopFeedBtn) {
        stopFeedBtn.addEventListener('click', function() {
            stopLiveFeed();
        });
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('nauticalflow-logged-in');
    localStorage.removeItem('nauticalflow-username');
    window.location.href = '../index.html';
}

// Update current location
function updateCurrentLocation() {
    const locationElement = document.getElementById('current-location');
    if (locationElement) {
        // Simulate getting current location
        const locations = ['North Atlantic', 'Pacific Ocean', 'Mediterranean Sea', 'Indian Ocean'];
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        locationElement.textContent = randomLocation;
    }
}

// Highlight current page in sidebar
function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
    
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Initialize charts
function initializeCharts() {
    // CO2 Optimization Chart
    const co2OptimizationChart = document.getElementById('co2OptimizationChart');
    if (co2OptimizationChart) {
        new Chart(co2OptimizationChart, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
                datasets: [{
                    label: 'Baseline CO2 (tons)',
                    data: [1200, 1180, 1160, 1140, 1120, 1100],
                    borderColor: 'rgb(220, 53, 69)',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.1
                }, {
                    label: 'Optimized CO2 (tons)',
                    data: [1020, 1000, 980, 960, 940, 920],
                    borderColor: 'rgb(40, 167, 69)',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'CO2 Emissions Optimization Progress'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'CO2 Emissions (tons)'
                        }
                    }
                }
            }
        });
    }
    
    // Fuel Consumption Optimization Chart
    const fuelOptimizationChart = document.getElementById('fuelOptimizationChart');
    if (fuelOptimizationChart) {
        new Chart(fuelOptimizationChart, {
            type: 'bar',
            data: {
                labels: ['Route A', 'Route B', 'Route C', 'Route D', 'Route E'],
                datasets: [{
                    label: 'Baseline Fuel (liters)',
                    data: [9000, 8500, 9200, 8800, 9500],
                    backgroundColor: 'rgba(220, 53, 69, 0.7)',
                    borderColor: 'rgb(220, 53, 69)',
                    borderWidth: 1
                }, {
                    label: 'Optimized Fuel (liters)',
                    data: [7920, 7480, 8096, 7744, 8360],
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgb(40, 167, 69)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Fuel Consumption by Route'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Fuel Consumption (liters)'
                        }
                    }
                }
            }
        });
    }
    
    // Safety Score Optimization Chart
    const safetyOptimizationChart = document.getElementById('safetyOptimizationChart');
    if (safetyOptimizationChart) {
        new Chart(safetyOptimizationChart, {
            type: 'radar',
            data: {
                labels: ['Weather Safety', 'Traffic Safety', 'Depth Safety', 'Speed Safety', 'Route Safety', 'Emergency Response'],
                datasets: [{
                    label: 'Baseline Safety Score',
                    data: [85, 80, 90, 85, 88, 82],
                    borderColor: 'rgb(220, 53, 69)',
                    backgroundColor: 'rgba(220, 53, 69, 0.2)',
                    pointBackgroundColor: 'rgb(220, 53, 69)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(220, 53, 69)'
                }, {
                    label: 'Optimized Safety Score',
                    data: [92, 88, 95, 90, 94, 89],
                    borderColor: 'rgb(40, 167, 69)',
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    pointBackgroundColor: 'rgb(40, 167, 69)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(40, 167, 69)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Safety Score Comparison'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                }
            }
        });
    }
    
    // Cost Optimization Chart
    const costOptimizationChart = document.getElementById('costOptimizationChart');
    if (costOptimizationChart) {
        new Chart(costOptimizationChart, {
            type: 'doughnut',
            data: {
                labels: ['Fuel Costs', 'Port Fees', 'Maintenance', 'Insurance', 'Other'],
                datasets: [{
                    data: [45000, 25000, 15000, 10000, 7500],
                    backgroundColor: [
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(23, 162, 184, 0.8)',
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(108, 117, 125, 0.8)'
                    ],
                    borderColor: [
                        'rgb(220, 53, 69)',
                        'rgb(255, 193, 7)',
                        'rgb(23, 162, 184)',
                        'rgb(40, 167, 69)',
                        'rgb(108, 117, 125)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Cost Breakdown (Optimized)'
                    }
                }
            }
        });
    }
    
    // Vessel Activity Chart (Dashboard)
    const vesselActivityChart = document.getElementById('vesselActivityChart');
    if (vesselActivityChart) {
        new Chart(vesselActivityChart, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Active Vessels',
                    data: [35, 38, 42, 45, 40, 42],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Vessel Types Chart (Dashboard)
    const vesselTypesChart = document.getElementById('vesselTypesChart');
    if (vesselTypesChart) {
        new Chart(vesselTypesChart, {
            type: 'doughnut',
            data: {
                labels: ['Cargo', 'Tanker', 'Passenger'],
                datasets: [{
                    data: [45, 30, 25],
                    backgroundColor: ['#007bff', '#28a745', '#17a2b8']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Speed Chart (Route Analytics)
    const speedChart = document.getElementById('speedChart');
    if (speedChart) {
        new Chart(speedChart, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Speed (knots)',
                    data: [10.5, 11.2, 12.1, 11.8, 11.5, 10.9],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Fuel Chart (Route Analytics)
    const fuelChart = document.getElementById('fuelChart');
    if (fuelChart) {
        new Chart(fuelChart, {
            type: 'doughnut',
            data: {
                labels: ['Cargo', 'Tanker', 'Passenger'],
                datasets: [{
                    data: [50, 35, 15],
                    backgroundColor: ['#007bff', '#28a745', '#17a2b8']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Weather Chart (Route Analytics)
    const weatherChart = document.getElementById('weatherChart');
    if (weatherChart) {
        new Chart(weatherChart, {
            type: 'bar',
            data: {
                labels: ['Calm', 'Light', 'Moderate', 'Heavy'],
                datasets: [{
                    label: 'Weather Impact (%)',
                    data: [5, 12, -8, -15],
                    backgroundColor: ['#28a745', '#ffc107', '#fd7e14', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Route Performance Chart (Route History)
    const routePerformanceChart = document.getElementById('routePerformanceChart');
    if (routePerformanceChart) {
        new Chart(routePerformanceChart, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Route Efficiency (%)',
                    data: [85, 88, 92, 90],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Carbon Emissions Chart (Environmental Impact)
    const carbonEmissionsChart = document.getElementById('carbonEmissionsChart');
    if (carbonEmissionsChart) {
        new Chart(carbonEmissionsChart, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'CO2 Emissions (tons)',
                    data: [1200, 1150, 1100, 1050, 1000, 950],
                    borderColor: 'rgb(220, 53, 69)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Emission Sources Chart (Environmental Impact)
    const emissionSourcesChart = document.getElementById('emissionSourcesChart');
    if (emissionSourcesChart) {
        new Chart(emissionSourcesChart, {
            type: 'doughnut',
            data: {
                labels: ['Main Engine', 'Auxiliary', 'Boiler'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: ['#007bff', '#28a745', '#17a2b8']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// Live data feed functions
function startLiveFeed() {
    const startBtn = document.getElementById('start-feed');
    const stopBtn = document.getElementById('stop-feed');
    
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    
    // Simulate live data updates
    window.liveFeedInterval = setInterval(function() {
        updateLiveData();
    }, 5000);
}

function stopLiveFeed() {
    const startBtn = document.getElementById('start-feed');
    const stopBtn = document.getElementById('stop-feed');
    
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    
    if (window.liveFeedInterval) {
        clearInterval(window.liveFeedInterval);
    }
}

function updateLiveData() {
    // Update live statistics
    const activeVessels = document.getElementById('active-vessels');
    const dataPoints = document.getElementById('data-points');
    const alerts = document.getElementById('alerts');
    
    if (activeVessels) {
        const current = parseInt(activeVessels.textContent);
        activeVessels.textContent = current + Math.floor(Math.random() * 3) - 1;
    }
    
    if (dataPoints) {
        const current = parseInt(dataPoints.textContent.replace(',', ''));
        dataPoints.textContent = (current + Math.floor(Math.random() * 50)).toLocaleString();
    }
    
    if (alerts) {
        const current = parseInt(alerts.textContent);
        alerts.textContent = Math.max(0, current + Math.floor(Math.random() * 3) - 1);
    }
    
    // Add new update to live updates
    const liveUpdates = document.getElementById('live-updates');
    if (liveUpdates) {
        const update = document.createElement('div');
        update.className = 'alert alert-info alert-sm';
        update.innerHTML = `<small><i class="bi bi-clock me-1"></i>${new Date().toLocaleTimeString()} - Vessel data updated</small>`;
        liveUpdates.insertBefore(update, liveUpdates.firstChild);
        
        // Keep only last 10 updates
        while (liveUpdates.children.length > 10) {
            liveUpdates.removeChild(liveUpdates.lastChild);
        }
    }
}

// Load initial data
function loadInitialData() {
    // This function can be used to load any initial data needed for the page
    console.log('Page loaded successfully');
}

// Theme functions
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('nauticalflow-theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('nauticalflow-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
} 

// Route selection functionality
function initializeRouteSelector() {
    const routeSelector = document.getElementById('route-selector');
    const loadRouteBtn = document.getElementById('load-route-btn');
    const refreshRoutesBtn = document.getElementById('refresh-routes-btn');
    const dateFilter = document.getElementById('date-filter');
    const vesselFilter = document.getElementById('vessel-filter');
    
    if (routeSelector) {
        // Handle route selection change
        routeSelector.addEventListener('change', function() {
            const selectedRoute = this.value;
            if (selectedRoute) {
                updateRouteDetails(selectedRoute);
            }
        });
        
        // Handle load route button
        if (loadRouteBtn) {
            loadRouteBtn.addEventListener('click', function() {
                const selectedRoute = routeSelector.value;
                if (selectedRoute) {
                    updateRouteDetails(selectedRoute);
                } else {
                    showAlert('Please select a route first.', 'warning');
                }
            });
        }
        
        // Handle refresh button
        if (refreshRoutesBtn) {
            refreshRoutesBtn.addEventListener('click', function() {
                refreshRouteList();
            });
        }
        
        // Handle filters
        if (dateFilter) {
            dateFilter.addEventListener('change', function() {
                filterRoutes();
            });
        }
        
        if (vesselFilter) {
            vesselFilter.addEventListener('change', function() {
                filterRoutes();
            });
        }
    }
}

// Update route details based on selection
function updateRouteDetails(routeId) {
    // Show loading state
    const loadBtn = document.getElementById('load-route-btn');
    const originalText = loadBtn.innerHTML;
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Loading...';
    
    // Simulate API call delay
    setTimeout(() => {
        const routeData = getRouteData(routeId);
        if (routeData) {
            updateOptimizationSummary(routeData);
            updateKeyMetrics(routeData);
            updateRouteComparison(routeData);
            updateWaypoints(routeData);
            updateRouteMap(routeData);
            
            // Show success message
            showAlert(`Route "${routeData.name}" loaded successfully!`, 'success');
        } else {
            showAlert('Failed to load route details. Please try again.', 'danger');
        }
        
        // Reset button state
        loadBtn.disabled = false;
        loadBtn.innerHTML = originalText;
    }, 1000);
}

// Get route data based on route ID
function getRouteData(routeId) {
    const routeDatabase = {
        'route-1': {
            name: 'Port Klang → Singapore (Cargo Ship)',
            origin: 'Port Klang, Malaysia',
            destination: 'Singapore',
            vesselType: 'Cargo Ship (Medium)',
            optimizationDate: '2024-01-15 14:30:00',
            fuelPriority: 40,
            safetyPriority: 35,
            timePriority: 25,
            algorithm: 'Genetic Algorithm',
            fuelSavings: '15.2%',
            timeSavings: '8.5 hours',
            safetyRating: '94.7%',
            costSavings: '$12,450',
            originalDistance: '245 nautical miles',
            optimizedDistance: '238 nautical miles',
            originalDuration: '18.5 hours',
            optimizedDuration: '17.0 hours',
            originalFuel: '45.2 tons',
            optimizedFuel: '38.3 tons',
            originalSafety: '87.3%',
            optimizedSafety: '94.7%',
            originalCost: '$82,300',
            optimizedCost: '$69,850',
            waypoints: [
                { id: 1, name: 'Port Klang', coords: '3.0000°N, 101.4000°E', distance: '-', eta: '14:30', notes: 'Departure' },
                { id: 2, name: 'Malacca Strait', coords: '2.5000°N, 101.2000°E', distance: '28 nm', eta: '16:45', notes: 'Traffic separation' },
                { id: 3, name: 'Pulau Tioman', coords: '2.8167°N, 104.1667°E', distance: '45 nm', eta: '19:20', notes: 'Weather optimization' },
                { id: 4, name: 'Singapore Strait', coords: '1.2500°N, 103.7500°E', distance: '52 nm', eta: '22:15', notes: 'Traffic management' },
                { id: 5, name: 'Singapore Port', coords: '1.2900°N, 103.8500°E', distance: '15 nm', eta: '07:30', notes: 'Arrival' }
            ]
        },
        'route-2': {
            name: 'Rotterdam → Hamburg (Tanker)',
            origin: 'Rotterdam, Netherlands',
            destination: 'Hamburg, Germany',
            vesselType: 'Tanker (Large)',
            optimizationDate: '2024-01-14 09:15:00',
            fuelPriority: 50,
            safetyPriority: 30,
            timePriority: 20,
            algorithm: 'A* Algorithm',
            fuelSavings: '12.8%',
            timeSavings: '6.2 hours',
            safetyRating: '96.2%',
            costSavings: '$18,750',
            originalDistance: '320 nautical miles',
            optimizedDistance: '305 nautical miles',
            originalDuration: '24.0 hours',
            optimizedDuration: '22.3 hours',
            originalFuel: '68.5 tons',
            optimizedFuel: '59.7 tons',
            originalSafety: '89.1%',
            optimizedSafety: '96.2%',
            originalCost: '$125,000',
            optimizedCost: '$106,250',
            waypoints: [
                { id: 1, name: 'Rotterdam Port', coords: '51.9225°N, 4.4792°E', distance: '-', eta: '09:15', notes: 'Departure' },
                { id: 2, name: 'North Sea', coords: '52.5000°N, 4.2000°E', distance: '35 nm', eta: '12:30', notes: 'Weather routing' },
                { id: 3, name: 'Elbe River', coords: '53.5500°N, 9.9500°E', distance: '180 nm', eta: '06:45', notes: 'River navigation' },
                { id: 4, name: 'Hamburg Port', coords: '53.5511°N, 9.9937°E', distance: '15 nm', eta: '09:15', notes: 'Arrival' }
            ]
        },
        'route-3': {
            name: 'Shanghai → Los Angeles (Container)',
            origin: 'Shanghai, China',
            destination: 'Los Angeles, USA',
            vesselType: 'Container Ship (Ultra Large)',
            optimizationDate: '2024-01-13 16:45:00',
            fuelPriority: 35,
            safetyPriority: 40,
            timePriority: 25,
            algorithm: 'Dijkstra Algorithm',
            fuelSavings: '18.5%',
            timeSavings: '12.8 hours',
            safetyRating: '92.1%',
            costSavings: '$45,200',
            originalDistance: '5,680 nautical miles',
            optimizedDistance: '5,520 nautical miles',
            originalDuration: '18.5 days',
            optimizedDuration: '17.9 days',
            originalFuel: '1,250 tons',
            optimizedFuel: '1,018 tons',
            originalSafety: '85.7%',
            optimizedSafety: '92.1%',
            originalCost: '$450,000',
            optimizedCost: '$404,800',
            waypoints: [
                { id: 1, name: 'Shanghai Port', coords: '31.2304°N, 121.4737°E', distance: '-', eta: '16:45', notes: 'Departure' },
                { id: 2, name: 'East China Sea', coords: '30.0000°N, 125.0000°E', distance: '280 nm', eta: '08:30', notes: 'Weather optimization' },
                { id: 3, name: 'Pacific Ocean', coords: '25.0000°N, 170.0000°E', distance: '2,800 nm', eta: 'Day 8', notes: 'Ocean crossing' },
                { id: 4, name: 'San Pedro Bay', coords: '33.7490°N, 118.3884°W', distance: '2,400 nm', eta: 'Day 17', notes: 'Approach' },
                { id: 5, name: 'Los Angeles Port', coords: '33.7490°N, 118.3884°W', distance: '20 nm', eta: 'Day 18', notes: 'Arrival' }
            ]
        }
        // Add more routes as needed
    };
    
    return routeDatabase[routeId] || null;
}

// Update optimization summary section
function updateOptimizationSummary(routeData) {
    document.getElementById('optimization-date').textContent = routeData.optimizationDate;
    
    // Update route information
    const routeInfoSection = document.querySelector('#results-content .card-body .row .col-md-6:first-child');
    if (routeInfoSection) {
        routeInfoSection.innerHTML = `
            <h5>Route Information</h5>
            <p><strong>Origin:</strong> ${routeData.origin}</p>
            <p><strong>Destination:</strong> ${routeData.destination}</p>
            <p><strong>Vessel Type:</strong> ${routeData.vesselType}</p>
            <p><strong>Optimization Date:</strong> <span id="optimization-date">${routeData.optimizationDate}</span></p>
        `;
    }
    
    // Update optimization parameters
    const paramsSection = document.querySelector('#results-content .card-body .row .col-md-6:last-child');
    if (paramsSection) {
        paramsSection.innerHTML = `
            <h5>Optimization Parameters</h5>
            <p><strong>Fuel Priority:</strong> ${routeData.fuelPriority}%</p>
            <p><strong>Safety Priority:</strong> ${routeData.safetyPriority}%</p>
            <p><strong>Time Priority:</strong> ${routeData.timePriority}%</p>
            <p><strong>Algorithm:</strong> ${routeData.algorithm}</p>
        `;
    }
}

// Update key metrics cards
function updateKeyMetrics(routeData) {
    const metricsCards = document.querySelectorAll('#results-content .col-xl-3 .card-body .h5');
    if (metricsCards.length >= 4) {
        metricsCards[0].textContent = routeData.fuelSavings;
        metricsCards[1].textContent = routeData.timeSavings;
        metricsCards[2].textContent = routeData.safetyRating;
        metricsCards[3].textContent = routeData.costSavings;
    }
}

// Update route comparison table
function updateRouteComparison(routeData) {
    const comparisonTable = document.querySelector('#results-content .table-responsive tbody');
    if (comparisonTable) {
        comparisonTable.innerHTML = `
            <tr>
                <td><strong>Distance</strong></td>
                <td>${routeData.originalDistance}</td>
                <td>${routeData.optimizedDistance}</td>
                <td><span class="badge bg-success">-${calculateImprovement(routeData.originalDistance, routeData.optimizedDistance)}%</span></td>
            </tr>
            <tr>
                <td><strong>Duration</strong></td>
                <td>${routeData.originalDuration}</td>
                <td>${routeData.optimizedDuration}</td>
                <td><span class="badge bg-success">-${calculateImprovement(routeData.originalDuration, routeData.optimizedDuration)}%</span></td>
            </tr>
            <tr>
                <td><strong>Fuel Consumption</strong></td>
                <td>${routeData.originalFuel}</td>
                <td>${routeData.optimizedFuel}</td>
                <td><span class="badge bg-success">-${calculateImprovement(routeData.originalFuel, routeData.optimizedFuel)}%</span></td>
            </tr>
            <tr>
                <td><strong>Safety Score</strong></td>
                <td>${routeData.originalSafety}</td>
                <td>${routeData.optimizedSafety}</td>
                <td><span class="badge bg-success">+${calculateImprovement(routeData.originalSafety, routeData.optimizedSafety)}%</span></td>
            </tr>
            <tr>
                <td><strong>Cost</strong></td>
                <td>${routeData.originalCost}</td>
                <td>${routeData.optimizedCost}</td>
                <td><span class="badge bg-success">-${routeData.costSavings}</span></td>
            </tr>
        `;
    }
}

// Update waypoints table
function updateWaypoints(routeData) {
    const waypointsTable = document.querySelector('#results-content .table-striped tbody');
    if (waypointsTable) {
        waypointsTable.innerHTML = routeData.waypoints.map(waypoint => `
            <tr>
                <td>${waypoint.id}</td>
                <td>${waypoint.name}</td>
                <td>${waypoint.coords}</td>
                <td>${waypoint.distance}</td>
                <td>${waypoint.eta}</td>
                <td>${waypoint.notes}</td>
            </tr>
        `).join('');
    }
}

// Update route map (placeholder for future implementation)
function updateRouteMap(routeData) {
    const mapContainer = document.getElementById('optimized-route-map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="d-flex align-items-center justify-content-center h-100">
                <div class="text-center">
                    <i class="bi bi-map display-1 text-muted"></i>
                    <p class="text-muted mt-3">Optimized Route Visualization</p>
                    <p class="text-muted">${routeData.origin} → ${routeData.destination}</p>
                    <p class="text-muted"><small>Route: ${routeData.name}</small></p>
                    <p class="text-muted"><small>Future: Interactive map with route overlay</small></p>
                </div>
            </div>
        `;
    }
}

// Calculate improvement percentage
function calculateImprovement(original, optimized) {
    // Extract numeric values from strings like "245 nautical miles" or "18.5 hours"
    const originalNum = parseFloat(original.replace(/[^\d.]/g, ''));
    const optimizedNum = parseFloat(optimized.replace(/[^\d.]/g, ''));
    
    if (originalNum && optimizedNum) {
        return ((originalNum - optimizedNum) / originalNum * 100).toFixed(1);
    }
    return '0.0';
}

// Filter routes based on selected criteria
function filterRoutes() {
    const dateFilter = document.getElementById('date-filter');
    const vesselFilter = document.getElementById('vessel-filter');
    
    // This would typically make an API call to filter routes
    // For now, just show a message
    showAlert('Route filtering functionality will be implemented with backend integration.', 'info');
}

// Refresh route list
function refreshRouteList() {
    const refreshBtn = document.getElementById('refresh-routes-btn');
    const originalText = refreshBtn.innerHTML;
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Refreshing...';
    
    setTimeout(() => {
        // Simulate refresh
        showAlert('Route list refreshed successfully!', 'success');
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalText;
    }, 1000);
}

// Show alert message
function showAlert(message, type = 'info') {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at the top of the results content
    const resultsContent = document.getElementById('results-content');
    if (resultsContent) {
        resultsContent.insertBefore(alertDiv, resultsContent.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
} 

// Route planning functionality
function initializeRoutePlanner() {
    const saveRouteBtn = document.querySelector('.btn-outline-primary');
    const optimizeBtn = document.querySelector('.btn-outline-success');
    const calculateRouteBtn = document.querySelector('button[type="submit"]');
    const refreshSavedRoutesBtn = document.getElementById('refresh-saved-routes');
    const clearAllRoutesBtn = document.getElementById('clear-all-routes');
    
    // Handle save route button
    if (saveRouteBtn) {
        saveRouteBtn.addEventListener('click', function() {
            showSaveRouteModal();
        });
    }
    
    // Handle optimize button
    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', function() {
            redirectToOptimize();
        });
    }
    
    // Handle calculate route form submission
    if (calculateRouteBtn) {
        calculateRouteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            calculateRoute();
        });
    }
    
    // Handle refresh saved routes
    if (refreshSavedRoutesBtn) {
        refreshSavedRoutesBtn.addEventListener('click', function() {
            refreshSavedRoutes();
        });
    }
    
    // Handle clear all routes
    if (clearAllRoutesBtn) {
        clearAllRoutesBtn.addEventListener('click', function() {
            clearAllSavedRoutes();
        });
    }
    
    // Initialize saved routes table actions
    initializeSavedRoutesActions();
}

// Redirect to optimize page
function redirectToOptimize() {
    const departure = document.getElementById('departure').value;
    const destination = document.getElementById('destination').value;
    const vesselName = document.getElementById('vessel-name').value;
    
    if (!departure || !destination || !vesselName) {
        showAlert('Please fill in departure, destination, and vessel before optimizing.', 'warning');
        return;
    }
    
    // Store current route data for optimization page
    const routeData = getCurrentRouteData();
    localStorage.setItem('nauticalflow-route-for-optimization', JSON.stringify(routeData));
    
    // Redirect to optimize page
    window.location.href = 'optimize.html';
}

// Show save route modal
function showSaveRouteModal() {
    const departure = document.getElementById('departure').value;
    const destination = document.getElementById('destination').value;
    const vesselName = document.getElementById('vessel-name').value;
    
    if (!departure || !destination || !vesselName) {
        showAlert('Please fill in departure, destination, and vessel before saving.', 'warning');
        return;
    }
    
    // Pre-fill route name based on selected ports
    const routeNameInput = document.getElementById('route-name');
    const departureText = document.getElementById('departure').options[document.getElementById('departure').selectedIndex].text;
    const destinationText = document.getElementById('destination').options[document.getElementById('destination').selectedIndex].text;
    routeNameInput.value = `${departureText.split(',')[0]} → ${destinationText.split(',')[0]}`;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('saveRouteModal'));
    modal.show();
}

// Handle save route confirmation
function confirmSaveRoute() {
    const routeName = document.getElementById('route-name').value.trim();
    const routeDescription = document.getElementById('route-description').value.trim();
    const saveOptimization = document.getElementById('save-optimization-settings').checked;
    const saveWaypoints = document.getElementById('save-waypoints').checked;
    
    if (!routeName) {
        showAlert('Please enter a route name.', 'warning');
        return;
    }
    
    // Get current route data
    const routeData = getCurrentRouteData();
    
    // Save route
    saveRoute(routeName, routeDescription, routeData, saveOptimization, saveWaypoints);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('saveRouteModal'));
    modal.hide();
}

// Get current route data from form
function getCurrentRouteData() {
    return {
        departure: document.getElementById('departure').value,
        departureText: document.getElementById('departure').options[document.getElementById('departure').selectedIndex].text,
        destination: document.getElementById('destination').value,
        destinationText: document.getElementById('destination').options[document.getElementById('destination').selectedIndex].text,
        vesselName: document.getElementById('vessel-name').value,
        vesselText: document.getElementById('vessel-name').options[document.getElementById('vessel-name').selectedIndex].text,
        speed: document.getElementById('speed').value,
        departureDate: document.getElementById('departure-date').value,
        avoidStorms: document.getElementById('avoid-storms').checked,
        ecoRoute: document.getElementById('eco-route').checked,
        regulations: document.getElementById('regulations').checked,
        savedDate: new Date().toISOString()
    };
}

// Save route to storage
function saveRoute(name, description, routeData, saveOptimization, saveWaypoints) {
    // Get existing saved routes
    let savedRoutes = JSON.parse(localStorage.getItem('nauticalflow-saved-routes') || '[]');
    
    // Create new route object
    const newRoute = {
        id: Date.now().toString(),
        name: name,
        description: description,
        data: routeData,
        saveOptimization: saveOptimization,
        saveWaypoints: saveWaypoints,
        savedDate: new Date().toISOString()
    };
    
    // Add to saved routes
    savedRoutes.unshift(newRoute);
    
    // Save to localStorage
    localStorage.setItem('nauticalflow-saved-routes', JSON.stringify(savedRoutes));
    
    // Update table
    updateSavedRoutesTable();
    
    // Show success message
    showAlert(`Route "${name}" saved successfully!`, 'success');
}

// Update saved routes table
function updateSavedRoutesTable() {
    const savedRoutes = JSON.parse(localStorage.getItem('nauticalflow-saved-routes') || '[]');
    const tbody = document.getElementById('saved-routes-tbody');
    const noRoutesMessage = document.getElementById('no-routes-message');
    
    if (savedRoutes.length === 0) {
        tbody.style.display = 'none';
        noRoutesMessage.style.display = 'block';
        return;
    }
    
    tbody.style.display = 'table-row-group';
    noRoutesMessage.style.display = 'none';
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Add saved routes
    savedRoutes.forEach(route => {
        const row = createSavedRouteRow(route);
        tbody.appendChild(row);
    });
}

// Create saved route table row
function createSavedRouteRow(route) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <strong>${route.name}</strong>
            ${route.description ? `<br><small class="text-muted">${route.description}</small>` : ''}
        </td>
        <td>${route.data.departureText}</td>
        <td>${route.data.destinationText}</td>
        <td>${route.data.vesselText}</td>
        <td>${route.data.distance || 'Calculating...'}</td>
        <td>${route.data.duration || 'Calculating...'}</td>
        <td>${formatDate(route.savedDate)}</td>
        <td>
            <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-primary" title="Load Route" onclick="loadSavedRoute('${route.id}')">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
                <button type="button" class="btn btn-outline-success" title="Optimize" onclick="optimizeSavedRoute('${route.id}')">
                    <i class="bi bi-gear"></i>
                </button>
                <button type="button" class="btn btn-outline-info" title="Export" onclick="exportSavedRoute('${route.id}')">
                    <i class="bi bi-download"></i>
                </button>
                <button type="button" class="btn btn-outline-danger" title="Delete" onclick="deleteSavedRoute('${route.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    `;
    return row;
}

// Load saved route
function loadSavedRoute(routeId) {
    const savedRoutes = JSON.parse(localStorage.getItem('nauticalflow-saved-routes') || '[]');
    const route = savedRoutes.find(r => r.id === routeId);
    
    if (route) {
        // Populate form with saved route data
        document.getElementById('departure').value = route.data.departure;
        document.getElementById('destination').value = route.data.destination;
        document.getElementById('vessel-name').value = route.data.vesselName;
        document.getElementById('speed').value = route.data.speed;
        document.getElementById('departure-date').value = route.data.departureDate;
        document.getElementById('avoid-storms').checked = route.data.avoidStorms;
        document.getElementById('eco-route').checked = route.data.ecoRoute;
        document.getElementById('regulations').checked = route.data.regulations;
        
        // Trigger route calculation
        calculateRoute();
        
        showAlert(`Route "${route.name}" loaded successfully!`, 'success');
    }
}

// Optimize saved route
function optimizeSavedRoute(routeId) {
    const savedRoutes = JSON.parse(localStorage.getItem('nauticalflow-saved-routes') || '[]');
    const route = savedRoutes.find(r => r.id === routeId);
    
    if (route) {
        // Load route first
        loadSavedRoute(routeId);
        
        // Redirect to optimization page
        setTimeout(() => {
            window.location.href = 'optimize.html';
        }, 1000);
    }
}

// Export saved route
function exportSavedRoute(routeId) {
    const savedRoutes = JSON.parse(localStorage.getItem('nauticalflow-saved-routes') || '[]');
    const route = savedRoutes.find(r => r.id === routeId);
    
    if (route) {
        // Create export data
        const exportData = {
            routeName: route.name,
            description: route.description,
            routeData: route.data,
            exportDate: new Date().toISOString()
        };
        
        // Create and download file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${route.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_route.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        showAlert(`Route "${route.name}" exported successfully!`, 'success');
    }
}

// Delete saved route
function deleteSavedRoute(routeId) {
    if (confirm('Are you sure you want to delete this saved route?')) {
        let savedRoutes = JSON.parse(localStorage.getItem('nauticalflow-saved-routes') || '[]');
        const routeIndex = savedRoutes.findIndex(r => r.id === routeId);
        
        if (routeIndex !== -1) {
            const routeName = savedRoutes[routeIndex].name;
            savedRoutes.splice(routeIndex, 1);
            localStorage.setItem('nauticalflow-saved-routes', JSON.stringify(savedRoutes));
            updateSavedRoutesTable();
            showAlert(`Route "${routeName}" deleted successfully!`, 'success');
        }
    }
}

// Refresh saved routes
function refreshSavedRoutes() {
    const refreshBtn = document.getElementById('refresh-saved-routes');
    const originalText = refreshBtn.innerHTML;
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Refreshing...';
    
    setTimeout(() => {
        updateSavedRoutesTable();
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalText;
        showAlert('Saved routes refreshed successfully!', 'success');
    }, 1000);
}

// Clear all saved routes
function clearAllSavedRoutes() {
    if (confirm('Are you sure you want to delete all saved routes? This action cannot be undone.')) {
        localStorage.removeItem('nauticalflow-saved-routes');
        updateSavedRoutesTable();
        showAlert('All saved routes have been cleared.', 'success');
    }
}

// Calculate route (placeholder function)
function calculateRoute() {
    const calculateBtn = document.querySelector('button[type="submit"]');
    const originalText = calculateBtn.innerHTML;
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Calculating...';
    
    setTimeout(() => {
        // Simulate route calculation
        updateRouteSummary();
        updateRouteDetails();
        updateRouteMap();
        
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = originalText;
        showAlert('Route calculated successfully!', 'success');
    }, 2000);
}

// Update route summary (placeholder)
function updateRouteSummary() {
    // This would update the route summary card with calculated values
    console.log('Route summary updated');
}

// Update route details (placeholder)
function updateRouteDetails() {
    // This would update the route details table with calculated waypoints
    console.log('Route details updated');
}

// Update route map (placeholder)
function updateRouteMap() {
    // This would update the route map visualization
    console.log('Route map updated');
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Scroll to route form
function scrollToRouteForm() {
    document.querySelector('.card-header').scrollIntoView({ behavior: 'smooth' });
}

// Initialize saved routes actions
function initializeSavedRoutesActions() {
    // Add event listeners for modal
    const confirmSaveBtn = document.getElementById('confirm-save-route');
    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', confirmSaveRoute);
    }
    
    // Load saved routes on page load
    updateSavedRoutesTable();
} 

// Profile page functionality
function initializeProfile() {
    const personalInfoForm = document.getElementById('personal-info-form');
    const passwordForm = document.getElementById('password-form');
    const togglePasswordBtn = document.getElementById('toggle-new-password');
    const newPasswordInput = document.getElementById('new-password');
    
    // Load current user data
    loadUserProfile();
    
    // Handle personal information form submission
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updatePersonalInfo();
        });
    }
    
    // Handle password form submission
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            changePassword();
        });
    }
    
    // Handle password visibility toggle
    if (togglePasswordBtn && newPasswordInput) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = newPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            newPasswordInput.setAttribute('type', type);
            togglePasswordBtn.innerHTML = type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
        });
    }
    
    // Password strength checker
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = checkPasswordStrength(password);
            updatePasswordStrengthIndicator(strength);
        });
    }
}

// Load user profile data
function loadUserProfile() {
    // Get user data from localStorage or use defaults
    const userData = JSON.parse(localStorage.getItem('nauticalflow-user-data') || '{}');
    const currentUser = localStorage.getItem('nauticalflow-username') || 'admin';
    
    // Update display elements
    const displayName = userData.displayName || 'Administrator';
    const username = userData.username || 'admin';
    
    // Update profile header
    document.getElementById('profile-display-name').textContent = displayName;
    document.getElementById('profile-username').textContent = `@${username}`;
    document.getElementById('current-user-display').textContent = displayName;
    
    // Update form fields
    const displayNameInput = document.getElementById('display-name');
    const usernameInput = document.getElementById('username');
    
    if (displayNameInput) displayNameInput.value = displayName;
    if (usernameInput) usernameInput.value = username;
    
    // Update account information
    const memberSince = userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'January 1, 2024';
    const lastLogin = new Date().toLocaleString();
    
    document.getElementById('member-since').textContent = memberSince;
    document.getElementById('last-login').textContent = lastLogin;
}

// Update personal information
function updatePersonalInfo() {
    const displayName = document.getElementById('display-name').value.trim();
    const username = document.getElementById('username').value.trim();
    
    // Validate inputs
    if (!displayName || !username) {
        showAlert('Please fill in all required fields.', 'warning');
        return;
    }
    
    if (displayName.length < 2) {
        showAlert('Display name must be at least 2 characters long.', 'warning');
        return;
    }
    
    if (username.length < 3) {
        showAlert('Username must be at least 3 characters long.', 'warning');
        return;
    }
    
    if (!isValidUsername(username)) {
        showAlert('Username can only contain letters, numbers, and underscores.', 'warning');
        return;
    }
    
    // Check if username already exists (simulate backend check)
    if (username === 'user' && username !== 'admin') {
        showAlert('Username already exists. Please choose a different username.', 'warning');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#personal-info-form button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Updating...';
    
    // Simulate API call
    setTimeout(() => {
        // Update user data
        const userData = JSON.parse(localStorage.getItem('nauticalflow-user-data') || '{}');
        userData.displayName = displayName;
        userData.username = username;
        userData.updatedAt = new Date().toISOString();
        
        localStorage.setItem('nauticalflow-user-data', JSON.stringify(userData));
        localStorage.setItem('nauticalflow-username', username);
        
        // Update display
        document.getElementById('profile-display-name').textContent = displayName;
        document.getElementById('profile-username').textContent = `@${username}`;
        document.getElementById('current-user-display').textContent = displayName;
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        
        showAlert('Personal information updated successfully!', 'success');
    }, 1000);
}

// Change password
function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('Please fill in all password fields.', 'warning');
        return;
    }
    
    // Check current password (simulate backend validation)
    const storedPassword = localStorage.getItem('nauticalflow-password') || 'admin123';
    if (currentPassword !== storedPassword) {
        showAlert('Current password is incorrect.', 'warning');
        document.getElementById('current-password').value = '';
        document.getElementById('current-password').focus();
        return;
    }
    
    if (newPassword.length < 8) {
        showAlert('New password must be at least 8 characters long.', 'warning');
        return;
    }
    
    if (!isStrongPassword(newPassword)) {
        showAlert('New password must contain uppercase, lowercase, number, and special character.', 'warning');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match.', 'warning');
        document.getElementById('confirm-new-password').value = '';
        document.getElementById('confirm-new-password').focus();
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#password-form button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Changing Password...';
    
    // Simulate API call
    setTimeout(() => {
        // Update password in localStorage (in real app, this would be sent to backend)
        localStorage.setItem('nauticalflow-password', newPassword);
        
        // Clear form
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';
        document.getElementById('password-strength').className = 'password-strength';
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        
        showAlert('Password changed successfully!', 'success');
    }, 1000);
}

// Check username validity
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    return usernameRegex.test(username);
}

// Check password strength
function isStrongPassword(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
}

// Check password strength and return level
function checkPasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
}

// Update password strength indicator
function updatePasswordStrengthIndicator(strength) {
    const strengthBar = document.getElementById('password-strength');
    if (strengthBar) {
        strengthBar.className = 'password-strength';
        
        if (strength === 'weak') {
            strengthBar.classList.add('strength-weak');
        } else if (strength === 'medium') {
            strengthBar.classList.add('strength-medium');
        } else if (strength === 'strong') {
            strengthBar.classList.add('strength-strong');
        }
    }
}

// Show alert message
function showAlert(message, type = 'info') {
    // Hide any existing alerts
    document.getElementById('success-message').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
    
    if (type === 'success') {
        const successMessage = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        successText.textContent = message;
        successMessage.style.display = 'block';
    } else {
        const errorMessage = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        errorText.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        document.getElementById('success-message').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';
    }, 5000);
} 