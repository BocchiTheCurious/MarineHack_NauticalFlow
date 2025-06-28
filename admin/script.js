// NauticalFlow Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    if (localStorage.getItem('nauticalflow-logged-in') !== 'true') {
        window.location.href = '../index.html';
        return;
    }
    
    // Initialize the dashboard
    initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    loadInitialData();
    
    // Load default content (dashboard)
    loadContent('dashboard');
});

// Initialize dashboard components
function initializeDashboard() {
    // Set default theme
    const savedTheme = localStorage.getItem('nauticalflow-theme') || 'light';
    setTheme(savedTheme);
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            sidebarLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show corresponding content
            const target = this.getAttribute('href').substring(1);
            loadContent(target);
        });
    });
    
    // Mobile sidebar toggle (if needed)
    const sidebarToggle = document.querySelector('.navbar-toggler');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('show');
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('nauticalflow-logged-in');
    localStorage.removeItem('nauticalflow-username');
    window.location.href = '../index.html';
}

// Load content from separate files
async function loadContent(contentId) {
    const mainContent = document.getElementById('main-content');
    const dashboardContent = document.getElementById('dashboard-content');
    
    // Handle dashboard content differently since it's embedded in homepage
    if (contentId === 'dashboard') {
        // Show dashboard content and hide any other content
        if (dashboardContent) {
            dashboardContent.style.display = 'block';
        }
        // Clear any other content that might be loaded
        const otherContent = mainContent.querySelector('.loaded-content');
        if (otherContent) {
            otherContent.remove();
        }
        // Initialize dashboard components
        initializeContentComponents(contentId);
        return;
    }
    
    // Hide dashboard content when loading other content
    if (dashboardContent) {
        dashboardContent.style.display = 'none';
    }
    
    // Show loading spinner
    const loadingSpinner = `
        <div class="loaded-content">
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading ${contentId.replace('-', ' ')}...</p>
            </div>
        </div>
    `;
    
    // Remove any existing loaded content
    const existingContent = mainContent.querySelector('.loaded-content');
    if (existingContent) {
        existingContent.remove();
    }
    
    mainContent.insertAdjacentHTML('beforeend', loadingSpinner);
    
    try {
        // Map content IDs to file names in admin folder
        const contentFiles = {
            'route-planner': 'route-planner.html',
            'route-analytics': 'route-analytics.html',
            'live-feed': 'live-data-feed.html',
            'marine-zones': 'marine-zones.html',
            'route-history': 'route-history.html',
            'vessel-data': 'vessel-data.html',
            'settings': 'system-settings.html',
            'environmental-impact': 'environmental-impact.html'
        };
        
        const fileName = contentFiles[contentId];
        if (!fileName) {
            throw new Error(`Unknown content ID: ${contentId}`);
        }
        
        // Fetch content from file
        const response = await fetch(fileName);
        if (!response.ok) {
            throw new Error(`Failed to load ${fileName}: ${response.status}`);
        }
        
        const content = await response.text();
        
        // Update loaded content
        const loadedContentDiv = mainContent.querySelector('.loaded-content');
        if (loadedContentDiv) {
            loadedContentDiv.innerHTML = content;
        }
        
        // Reinitialize components for the new content
        initializeContentComponents(contentId);
        
        // Add fade-in animation
        loadedContentDiv.classList.add('fade-in');
        setTimeout(() => {
            loadedContentDiv.classList.remove('fade-in');
        }, 500);
        
    } catch (error) {
        console.error('Error loading content:', error);
        const loadedContentDiv = mainContent.querySelector('.loaded-content');
        if (loadedContentDiv) {
            loadedContentDiv.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                    <h4 class="mt-3">Error Loading Content</h4>
                    <p class="text-muted">Failed to load ${contentId.replace('-', ' ')} content.</p>
                    <button class="btn btn-primary" onclick="loadContent('${contentId}')">Retry</button>
                </div>
            `;
        }
    }
}

// Initialize components for specific content
function initializeContentComponents(contentId) {
    // Reinitialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize tabs if present
    const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabElements.forEach(tab => {
        new bootstrap.Tab(tab);
    });
    
    // Content-specific initializations
    switch(contentId) {
        case 'dashboard':
            updateCurrentLocation();
            updateWeatherData();
            updateVesselStats();
            break;
        case 'live-feed':
            // Initialize live data updates
            startLiveDataUpdates();
            break;
        case 'route-planner':
            // Initialize route planner components
            initializeRoutePlanner();
            break;
        case 'route-analytics':
            // Initialize analytics components
            initializeAnalytics();
            break;
        case 'vessel-data':
            // Initialize file upload components
            initializeFileUpload();
            break;
        case 'settings':
            // Initialize settings components
            initializeSettings();
            break;
    }
}

// Theme management
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nauticalflow-theme', theme);
    
    // Update theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'bi bi-sun';
        } else {
            icon.className = 'bi bi-moon-stars';
        }
    }
}

// Load initial data
function loadInitialData() {
    // Simulate loading current location
    updateCurrentLocation();
    
    // Simulate loading weather data
    updateWeatherData();
    
    // Simulate loading vessel stats
    updateVesselStats();
}

// Update current location (Malaysia locations)
function updateCurrentLocation() {
    const locationElement = document.getElementById('current-location');
    if (locationElement) {
        // Malaysia maritime locations
        const malaysiaLocations = [
            { lat: 3.1390, lng: 101.6869, name: "Port Klang" },
            { lat: 1.3521, lng: 103.8198, name: "Johor Port" },
            { lat: 5.4164, lng: 100.3327, name: "Penang Port" },
            { lat: 2.1896, lng: 111.8233, name: "Kuching Port" },
            { lat: 5.9765, lng: 116.0728, name: "Kota Kinabalu Port" },
            { lat: 4.2105, lng: 108.9758, name: "Labuan Port" },
            { lat: 1.4927, lng: 110.3593, name: "Kuching Port" },
            { lat: 6.1133, lng: 102.2465, name: "Kuala Terengganu Port" }
        ];
        
        const randomLocation = malaysiaLocations[Math.floor(Math.random() * malaysiaLocations.length)];
        locationElement.textContent = randomLocation.name;
        
        // Add tooltip with coordinates
        locationElement.setAttribute('data-bs-toggle', 'tooltip');
        locationElement.setAttribute('data-bs-placement', 'bottom');
        locationElement.setAttribute('title', `${randomLocation.lat.toFixed(4)}, ${randomLocation.lng.toFixed(4)}`);
        
        // Reinitialize tooltip
        new bootstrap.Tooltip(locationElement);
    }
}

// Update weather data (Malaysia weather)
function updateWeatherData() {
    const weatherConditions = [
        { temp: 28, condition: 'Partly Cloudy', wind: 12, visibility: 15, icon: 'bi-cloud-sun' },
        { temp: 30, condition: 'Sunny', wind: 8, visibility: 20, icon: 'bi-sun' },
        { temp: 26, condition: 'Light Rain', wind: 15, visibility: 8, icon: 'bi-cloud-rain' },
        { temp: 29, condition: 'Clear', wind: 10, visibility: 18, icon: 'bi-sun' },
        { temp: 27, condition: 'Overcast', wind: 18, visibility: 12, icon: 'bi-cloud' }
    ];
    
    const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    
    // Update weather display
    const weatherIcon = document.querySelector('.weather-icon');
    const weatherTemp = document.querySelector('.card-body h4');
    const weatherCondition = document.querySelector('.card-body p');
    
    if (weatherIcon) weatherIcon.className = `bi ${randomWeather.icon} weather-icon`;
    if (weatherTemp) weatherTemp.textContent = `${randomWeather.temp}°C`;
    if (weatherCondition) weatherCondition.textContent = randomWeather.condition;
}

// Update vessel stats (simulated)
function updateVesselStats() {
    // Simulate real-time updates
    setInterval(() => {
        const speedElement = document.querySelector('.border-left-primary .h5');
        const distanceElement = document.querySelector('.border-left-success .h5');
        const etaElement = document.querySelector('.border-left-info .h5');
        const fuelElement = document.querySelector('.border-left-warning .h5');
        
        if (speedElement) {
            const currentSpeed = (10 + Math.random() * 8).toFixed(1);
            speedElement.textContent = `${currentSpeed} knots`;
        }
        
        if (distanceElement) {
            const distance = (20 + Math.random() * 30).toFixed(1);
            distanceElement.textContent = `${distance} nm`;
        }
        
        if (etaElement) {
            const hours = Math.floor(Math.random() * 8) + 8;
            const minutes = Math.floor(Math.random() * 60);
            etaElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        if (fuelElement) {
            const fuel = Math.floor(60 + Math.random() * 30);
            fuelElement.textContent = `${fuel}%`;
        }
    }, 5000); // Update every 5 seconds
}

// Content-specific initialization functions
function startLiveDataUpdates() {
    // Initialize live data feed updates
    console.log('Live data updates started');
}

function initializeRoutePlanner() {
    // Initialize route planner components
    console.log('Route planner initialized');
}

function initializeAnalytics() {
    // Initialize analytics components
    console.log('Analytics initialized');
}

function initializeFileUpload() {
    // Initialize file upload components
    console.log('File upload initialized');
}

function initializeSettings() {
    // Initialize settings components
    console.log('Settings initialized');
}

// Notification system
function showNotification(message, type = 'info') {
    const notificationContainer = document.createElement('div');
    notificationContainer.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notificationContainer.style.cssText = 'top: 80px; right: 20px; z-index: 1050; min-width: 300px;';
    notificationContainer.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notificationContainer);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notificationContainer.parentNode) {
            notificationContainer.remove();
        }
    }, 5000);
}

// Export functions for global access
window.NauticalFlow = {
    showNotification,
    setTheme,
    toggleTheme,
    loadContent,
    updateCurrentLocation,
    updateWeatherData,
    handleLogout
};

// Simulate periodic updates
setInterval(() => {
    // Random weather changes
    if (Math.random() < 0.1) { // 10% chance every interval
        updateWeatherData();
    }
    
    // Random location updates
    if (Math.random() < 0.05) { // 5% chance every interval
        updateCurrentLocation();
    }
}, 30000); // Check every 30 seconds

// Handle window resize for responsive design
window.addEventListener('resize', function() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    }
});

// Add loading states for better UX
function showLoading(element) {
    if (element) {
        element.innerHTML = '<div class="loading"></div>';
    }
}

function hideLoading(element, content) {
    if (element) {
        element.innerHTML = content;
    }
}

// Initialize any additional components
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + T for theme toggle
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            toggleTheme();
        }
        
        // Escape key to close mobile sidebar
        if (e.key === 'Escape') {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
            }
        }
    });
}); 