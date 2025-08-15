import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName } from './modules/utils.js';

// A variable to hold our interval, so we can stop it when the user leaves the page
let liveFeedInterval;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Initialize common UI components
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Start the live data simulation for this page
    initializeLiveDataFeed();
});

/**
 * Sets up and starts the live data feed simulation.
 */
function initializeLiveDataFeed() {
    console.log("Live Data Feed page initialized. Starting feed...");
    
    // Update the data immediately on page load
    updateLiveDataCards();

    // Then, set it to update every 5 seconds (5000 milliseconds)
    liveFeedInterval = setInterval(updateLiveDataCards, 5000);

    // Good practice: stop the interval when the user navigates away
    // to prevent it from running in the background.
    window.addEventListener('beforeunload', () => {
        clearInterval(liveFeedInterval);
    });
}

/**
 * Fetches and updates the data in the various cards on the page.
 */
function updateLiveDataCards() {
    // Select all the elements we need to update
    const weatherTempEl = document.getElementById('weather-temp');
    const windSpeedEl = document.getElementById('wind-speed');
    const waveHeightEl = document.getElementById('wave-height');
    const wavePeriodEl = document.getElementById('wave-period');
    const currentSpeedEl = document.getElementById('current-speed');
    const currentDirectionEl = document.getElementById('current-direction');

    // --- Simulate new data by generating small random variations ---

    // Update Weather Data
    if (weatherTempEl && windSpeedEl) {
        const tempVariation = (Math.random() * 0.5 - 0.25).toFixed(1); // Small fluctuation
        weatherTempEl.textContent = `${(28 + parseFloat(tempVariation)).toFixed(1)}°C`;
        
        const windVariation = Math.floor(Math.random() * 4) - 2; // -2 to +1
        windSpeedEl.textContent = `${15 + windVariation} knots`;
    }

    // Update Wave Data
    if (waveHeightEl && wavePeriodEl) {
        const heightVariation = (Math.random() * 0.2 - 0.1).toFixed(1); // -0.1 to +0.1
        waveHeightEl.textContent = `${(1.2 + parseFloat(heightVariation)).toFixed(1)}m`;

        const periodVariation = (Math.random() * 0.4 - 0.2).toFixed(1);
        wavePeriodEl.textContent = `${(8.5 + parseFloat(periodVariation)).toFixed(1)}s`;
    }

    // Update Current Data
    if (currentSpeedEl && currentDirectionEl) {
        const speedVariation = (Math.random() * 0.3 - 0.15).toFixed(1);
        currentSpeedEl.textContent = `${(1.2 + parseFloat(speedVariation)).toFixed(1)} knots`;

        // Occasionally change direction
        if (Math.random() > 0.8) {
            const directions = ['SE', 'E', 'NE'];
            currentDirectionEl.textContent = directions[Math.floor(Math.random() * directions.length)];
        }
    }
    
    // Add a subtle visual cue that the data has updated
    flashUpdateIndicator();
}

/**
 * Briefly flashes the card headers to indicate a data refresh.
 */
function flashUpdateIndicator() {
    const cardHeaders = document.querySelectorAll('#live-data-feed-content .card-header');
    cardHeaders.forEach(header => {
        header.style.transition = 'background-color 0.2s ease-in-out';
        header.style.backgroundColor = 'rgba(0, 123, 255, 0.1)'; // A light blue flash
        setTimeout(() => {
            header.style.backgroundColor = ''; // Revert to default
        }, 300);
    });
}