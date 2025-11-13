import { setupLogout } from './auth.js';

/**
 * Fetches and injects the navbar and sidebar components into the page.
 */
export async function loadLayout() {
    const fetchNavbar = fetch('components/_navbar.html').then(response => response.text());
    const fetchSidebar = fetch('components/_sidebar.html').then(response => response.text());

    const [navbarHtml, sidebarHtml] = await Promise.all([fetchNavbar, fetchSidebar]);

    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (navbarPlaceholder) {
        navbarPlaceholder.outerHTML = navbarHtml;
    }
    if (sidebarPlaceholder) {
        sidebarPlaceholder.outerHTML = sidebarHtml;
    }

    // Set up logout button functionality
    setupLogout();
    
    // Load user display name
    loadUserDisplayName();

    // Initialize underwater effects
    initFloatingParticles();
    initLightRays();
}

/**
 * Loads and displays the user's display name in the navbar
 */
function loadUserDisplayName() {
    const displayName = localStorage.getItem('nauticalflow-display-name');
    const displayNameElement = document.getElementById('user-display-name');
    
    if (displayNameElement && displayName) {
        displayNameElement.textContent = displayName;
    }
}

/**
 * Creates floating particle elements (underwater bubbles effect)
 */
export function initFloatingParticles() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    document.body.appendChild(particleContainer);

    // Create 20 particles
    for (let i = 0; i < 20; i++) {
        createParticle(particleContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random positioning and animation delay
    const startX = Math.random() * 100;
    const duration = 15 + Math.random() * 10; // 15-25 seconds
    const delay = Math.random() * 5;
    const size = 3 + Math.random() * 5; // 3-8px
    
    particle.style.left = `${startX}%`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    container.appendChild(particle);
}

/**
 * Creates diagonal light ray elements
 */
export function initLightRays() {
    const raysContainer = document.createElement('div');
    raysContainer.className = 'light-rays-container';
    document.body.appendChild(raysContainer);

    // Create 5 light rays
    for (let i = 0; i < 5; i++) {
        const ray = document.createElement('div');
        ray.className = 'light-ray';
        ray.style.left = `${i * 25}%`;
        ray.style.animationDelay = `${i * 2}s`;
        raysContainer.appendChild(ray);
    }
}
