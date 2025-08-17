import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { loadLayout } from './modules/layout.js';
import { getPorts, getWeatherData } from './modules/api.js';

let allPorts = [];

document.addEventListener('DOMContentLoaded', async () => { 
    if (!checkAuth()) return;
    await loadLayout();

    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeLiveDataPage();
});

/**
 * Initializes the live data page by fetching ports, setting up event listeners,
 * and loading the initial weather data.
 */
async function initializeLiveDataPage() {
    const portSelector = document.getElementById('port-selector');
    const refreshBtn = document.getElementById('refresh-weather-btn');
    
    try {
        allPorts = await getPorts();
        populatePortSelector(allPorts);
        
        if (allPorts.length > 0) {
            // Fetch weather for the initially selected port
            await fetchAndDisplayWeatherForSelectedPort();
        } else {
            portSelector.innerHTML = '<option>No ports found. Please add one.</option>';
        }
    } catch (error) {
        showAlert('Could not load port list.', 'danger');
        portSelector.innerHTML = '<option>Could not load ports</option>';
    }

    // Add event listeners for the dropdown and the refresh button
    portSelector.addEventListener('change', fetchAndDisplayWeatherForSelectedPort);
    refreshBtn.addEventListener('click', fetchAndDisplayWeatherForSelectedPort);
}

/**
 * A central function to get the currently selected port from the dropdown 
 * and trigger the weather data fetch and display process.
 */
async function fetchAndDisplayWeatherForSelectedPort() {
    const portSelector = document.getElementById('port-selector');
    const selectedPort = allPorts.find(p => p.id == portSelector.value);
    
    if (selectedPort) {
        const refreshBtn = document.getElementById('refresh-weather-btn');
        const originalBtnText = refreshBtn.innerHTML;
        
        // Disable button and show loading state
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...`;

        await fetchAndDisplayWeather(selectedPort.latitude, selectedPort.longitude, selectedPort.name);

        // Re-enable button and restore original text
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalBtnText;
    }
}

/**
 * Fetches weather data from the API for a given location and updates the UI.
 * @param {number} lat - The latitude of the location.
 * @param {number} lon - The longitude of the location.
 * @param {string} portName - The name of the port to display.
 */
async function fetchAndDisplayWeather(lat, lon, portName) {
    showLoadingState(true);
    try {
        const weatherData = await getWeatherData(lat, lon);

        // Log the API response for debugging purposes
        console.log('--- Open-Meteo API Response ---');
        console.log(weatherData);
        console.log('---------------------------------');

        updateWeatherCards(weatherData, portName);
        updateForecastCards(weatherData.hourly);
    } catch (error) {
        // Log any errors that occur during the fetch
        console.error('Error fetching or displaying weather:', error);
        showAlert('Failed to fetch live weather data from Open-Meteo.', 'warning');
    } finally {
        showLoadingState(false);
    }
}


/**
 * Populates the port selector dropdown with a list of ports.
 * @param {Array<Object>} ports - An array of port objects.
 */
function populatePortSelector(ports) {
    const selector = document.getElementById('port-selector');
    selector.innerHTML = '';
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.id;
        option.textContent = `${port.name}, ${port.country}`;
        selector.appendChild(option);
    });
}

/**
 * Updates the main weather and wave data cards with new information.
 * @param {Object} data - The weather data object from the API.
 * @param {string} portName - The name of the currently selected port.
 */
function updateWeatherCards(data, portName) {
    const weather = data.current;
    const weatherInfo = getWeatherInfoFromCode(weather.weather_code); 

    // Update Weather Card
    document.getElementById('location-name').textContent = portName;
    document.getElementById('weather-icon').className = `bi ${weatherInfo.icon} display-4 ${weatherInfo.color}`;
    document.getElementById('weather-description').textContent = weatherInfo.description;
    document.getElementById('weather-temp').textContent = `${weather.temperature_2m.toFixed(1)} °C`;
    document.getElementById('wind-speed').textContent = `${weather.wind_speed_10m.toFixed(1)} km/h`;

    // Update Wave Card
    document.getElementById('wave-height').textContent = `${weather.wave_height.toFixed(1)} m`;
    document.getElementById('wave-period').textContent = `${weather.wave_period.toFixed(1)} s`;
    document.getElementById('wave-direction').textContent = `${weather.wave_direction.toFixed(0)} °`;
}

/**
 * Updates the forecast section with hourly data.
 * @param {Object} hourlyData - The hourly forecast data from the API.
 */
function updateForecastCards(hourlyData) {
    const container = document.getElementById('forecast-container');
    container.innerHTML = ''; 
    const forecastRow = document.getElementById('forecast-row');
    
    if (!hourlyData || !hourlyData.time || hourlyData.time.length === 0) {
        forecastRow.classList.add('d-none');
        return;
    }
    forecastRow.classList.remove('d-none');
    
    const forecastHours = [6, 12, 24, 48];
    const currentTime = new Date();

    forecastHours.forEach(hourOffset => {
        const forecastTime = new Date(currentTime.getTime() + hourOffset * 60 * 60 * 1000);
        const closestIndex = findClosestTimeIndex(hourlyData.time, forecastTime);
        
        if (closestIndex === -1) return;

        const time = new Date(hourlyData.time[closestIndex]);
        const weatherInfo = getWeatherInfoFromCode(hourlyData.weather_code[closestIndex]);
        
        const col = document.createElement('div');
        col.className = 'col-md-3 text-center mb-3';
        col.innerHTML = `
            <h6 class="text-muted">+${hourOffset} Hours (${time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</h6>
            <i class="bi ${weatherInfo.icon} display-6 ${weatherInfo.color}"></i>
            <p class="mb-1"><strong>${hourlyData.temperature_2m[closestIndex].toFixed(1)}°C</strong></p>
            <p class="mb-1">Wind: ${hourlyData.wind_speed_10m[closestIndex].toFixed(1)} km/h</p>
            <p class="mb-0">Waves: ${hourlyData.wave_height[closestIndex].toFixed(1)}m</p>
        `;
        container.appendChild(col);
    });
}

/**
 * Shows or hides the loading overlay and content sections.
 * @param {boolean} isLoading - True to show loading state, false to show content.
 */
function showLoadingState(isLoading) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const weatherDataRow = document.getElementById('weather-data-row');
    const forecastRow = document.getElementById('forecast-row');
    
    if (isLoading) {
        loadingOverlay.classList.remove('d-none');
        loadingOverlay.classList.add('d-flex');
        weatherDataRow.classList.add('d-none');
        forecastRow.classList.add('d-none');
    } else {
        loadingOverlay.classList.add('d-none');
        loadingOverlay.classList.remove('d-flex');
        weatherDataRow.classList.remove('d-none');
    }
}

/**
 * Finds the index in a time array that is closest to a target time.
 * @param {Array<string>} timeArray - Array of ISO date strings.
 * @param {Date} targetTime - The target time to find the closest match for.
 * @returns {number} The index of the closest time.
 */
function findClosestTimeIndex(timeArray, targetTime) {
    const targetTimestamp = targetTime.getTime();
    let closestIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < timeArray.length; i++) {
        const diff = Math.abs(new Date(timeArray[i]).getTime() - targetTimestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }
    }
    return closestIndex;
}

/**
 * Maps a WMO weather code to an icon, color, and description.
 * @param {number} code - The WMO weather code.
 * @returns {Object} An object containing the icon, color, and description.
 */
function getWeatherInfoFromCode(code) {
    const weatherMap = {
        0: { icon: "bi-sun-fill", color: "text-warning", description: "Clear sky" },
        1: { icon: "bi-cloud-sun-fill", color: "text-warning", description: "Mainly clear" },
        2: { icon: "bi-cloud-fill", color: "text-secondary", description: "Partly cloudy" },
        3: { icon: "bi-clouds-fill", color: "text-secondary", description: "Overcast" },
        45: { icon: "bi-cloud-fog2-fill", color: "text-muted", description: "Fog" },
        61: { icon: "bi-cloud-rain-fill", color: "text-primary", description: "Light rain" },
        63: { icon: "bi-cloud-rain-heavy-fill", color: "text-primary", description: "Moderate rain" },
        80: { icon: "bi-cloud-showers-heavy-fill", color: "text-info", description: "Rain showers" },
        95: { icon: "bi-cloud-lightning-rain-fill", color: "text-danger", description: "Thunderstorm" }
    };
    return weatherMap[code] || { icon: "bi-question-circle", color: "", description: "Unknown" };
}
