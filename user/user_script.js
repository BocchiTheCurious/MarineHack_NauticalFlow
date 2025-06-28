// NauticalFlow User Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    if (localStorage.getItem('nauticalflow-logged-in') !== 'true') {
        window.location.href = '../index.html';
        return;
    }
    
    // Initialize the user dashboard
    initializeUserDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    loadInitialData();
    
    // Load default content (my route)
    loadContent('my-route');
});

// Initialize user dashboard components
function initializeUserDashboard() {
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
    const myRouteContent = document.getElementById('my-route-content');
    
    // Handle my-route content differently since it's embedded
    if (contentId === 'my-route') {
        // Show my route content and hide any other content
        if (myRouteContent) {
            myRouteContent.style.display = 'block';
        }
        // Clear any other content that might be loaded
        const otherContent = mainContent.querySelector('.loaded-content');
        if (otherContent) {
            otherContent.remove();
        }
        // Initialize my route components
        initializeContentComponents(contentId);
        return;
    }
    
    // Hide my route content when loading other content
    if (myRouteContent) {
        myRouteContent.style.display = 'none';
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
        // Map content IDs to file names in user folder
        const contentFiles = {
            'live-updates': 'live-updates.html',
            'trip-stats': 'trip-stats.html',
            'reroute': 'reroute.html',
            'past-trips': 'past-trips.html',
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
        case 'my-route':
            updateCurrentRoute();
            updateRouteStats();
            break;
        case 'live-updates':
            // Initialize live updates
            startLiveUpdates();
            break;
        case 'trip-stats':
            // Initialize trip statistics
            updateTripStats();
            break;
        case 'reroute':
            // Initialize reroute components
            initializeReroute();
            break;
        case 'past-trips':
            // Initialize past trips
            loadPastTrips();
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
    // Simulate loading current route
    updateCurrentRoute();
    
    // Simulate loading route stats
    updateRouteStats();
}

// Update current route information
function updateCurrentRoute() {
    const routeElement = document.getElementById('current-route');
    if (routeElement) {
        // Malaysia maritime routes
        const malaysiaRoutes = [
            "Port Klang → Singapore",
            "Penang → Langkawi",
            "Johor → Batam",
            "Kuching → Miri",
            "Kota Kinabalu → Labuan"
        ];
        
        const randomRoute = malaysiaRoutes[Math.floor(Math.random() * malaysiaRoutes.length)];
        routeElement.textContent = randomRoute;
    }
}

// Update route statistics
function updateRouteStats() {
    // Simulate real-time updates
    setInterval(() => {
        const speedElement = document.querySelector('.border-left-primary .h5');
        const distanceElement = document.querySelector('.border-left-success .h5');
        const etaElement = document.querySelector('.border-left-info .h5');
        const fuelElement = document.querySelector('.border-left-warning .h5');
        
        if (speedElement) {
            const currentSpeed = (12 + Math.random() * 8).toFixed(1);
            speedElement.textContent = `${currentSpeed} knots`;
        }
        
        if (distanceElement) {
            const distance = (20 + Math.random() * 40).toFixed(1);
            distanceElement.textContent = `${distance} nm`;
        }
        
        if (etaElement) {
            const hours = Math.floor(Math.random() * 6) + 10;
            const minutes = Math.floor(Math.random() * 60);
            etaElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        if (fuelElement) {
            const fuel = Math.floor(Math.random() * 30) + 70;
            fuelElement.textContent = `${fuel}%`;
        }
    }, 5000);
}

// Start live updates
function startLiveUpdates() {
    console.log('Live updates started');
    // Initialize live data updates for weather, traffic, etc.
}

// Update trip statistics
function updateTripStats() {
    console.log('Trip stats updated');
    // Update trip statistics display
}

// Initialize reroute functionality
function initializeReroute() {
    console.log('Reroute initialized');
    // Initialize reroute components and suggestions
}

// Load past trips
function loadPastTrips() {
    console.log('Past trips loaded');
    // Load and display past trip history
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 80px; right: 20px; z-index: 1050; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Show loading state
function showLoading(element) {
    element.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
}

// Hide loading state
function hideLoading(element, content) {
    element.innerHTML = content;
}
