import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader, showAlert } from './modules/utils.js';
import { loadLayout } from './modules/layout.js';
import { getPorts, getWeatherData } from './modules/api.js';

// === SAFETY ASSESSMENT CONFIGURATION ===
const SAFETY_THRESHOLDS = {
    waveHeight: {
        safe: 2.0,      // meters
        caution: 4.0    // anything above is dangerous
    },
    windSpeed: {
        safe: 40,       // km/h
        caution: 60     // anything above is dangerous
    },
    temperature: {
        safe: { min: 10, max: 35 }  // °C - extreme temps are concerning
    }
};

/**
 * Assesses the safety level based on a value and thresholds
 * @param {number} value - The current value to assess
 * @param {object} thresholds - Object with 'safe' and 'caution' limits
 * @param {boolean} reverse - If true, lower values are more dangerous
 * @returns {string} 'safe', 'caution', or 'dangerous'
 */
function assessSafetyLevel(value, thresholds, reverse = false) {
    if (reverse) {
        if (value >= thresholds.safe) return 'safe';
        if (value >= thresholds.caution) return 'caution';
        return 'dangerous';
    } else {
        if (value <= thresholds.safe) return 'safe';
        if (value <= thresholds.caution) return 'caution';
        return 'dangerous';
    }
}

/**
 * Performs a comprehensive safety assessment of weather conditions
 * @param {object} weatherData - Current weather data
 * @returns {object} Safety assessment with overall status, warnings, and details
 */
function performSafetyAssessment(weatherData) {
    const current = weatherData.current;

    // Assess individual parameters - handle missing marine data
    const waveHeight = current.wave_height !== null && current.wave_height !== undefined ? current.wave_height : 0;
    const waveStatus = assessSafetyLevel(waveHeight, SAFETY_THRESHOLDS.waveHeight);
    const windStatus = assessSafetyLevel(current.wind_speed_10m, SAFETY_THRESHOLDS.windSpeed);

    // Temperature assessment
    let tempStatus = 'safe';
    if (current.temperature_2m < SAFETY_THRESHOLDS.temperature.safe.min ||
        current.temperature_2m > SAFETY_THRESHOLDS.temperature.safe.max) {
        tempStatus = 'caution';
    }

    // Determine overall status (worst case wins)
    const statuses = [waveStatus, windStatus, tempStatus];
    let overallStatus = 'safe';
    if (statuses.includes('dangerous')) overallStatus = 'dangerous';
    else if (statuses.includes('caution')) overallStatus = 'caution';

    // Build warnings array
    const warnings = [];
    if (windStatus !== 'safe') {
        warnings.push({
            type: 'wind',
            level: windStatus,
            message: `Wind speed ${windStatus === 'dangerous' ? 'exceeds' : 'approaching'} safe limits (${current.wind_speed_10m.toFixed(1)}/${SAFETY_THRESHOLDS.windSpeed[windStatus === 'dangerous' ? 'caution' : 'safe']} km/h)`,
            recommendation: windStatus === 'dangerous'
                ? 'Operations not recommended. Delay departure until conditions improve.'
                : 'Exercise caution. Enhanced safety protocols advised for docking operations.'
        });
    }

    if (waveStatus !== 'safe' && waveHeight > 0) {
        warnings.push({
            type: 'wave',
            level: waveStatus,
            message: `Wave height ${waveStatus === 'dangerous' ? 'exceeds' : 'above'} safe operational limits (${waveHeight.toFixed(1)}m/${SAFETY_THRESHOLDS.waveHeight[waveStatus === 'dangerous' ? 'caution' : 'safe']}m)`,
            recommendation: waveStatus === 'dangerous'
                ? 'High risk to crew safety. Postpone operations until sea state improves.'
                : 'Moderate sea conditions. Use tugboat assistance and increase mooring lines.'
        });
    }

    if (tempStatus !== 'safe') {
        const isHot = current.temperature_2m > SAFETY_THRESHOLDS.temperature.safe.max;
        warnings.push({
            type: 'temperature',
            level: tempStatus,
            message: `${isHot ? 'High' : 'Low'} temperature conditions (${current.temperature_2m.toFixed(1)}°C)`,
            recommendation: isHot
                ? 'Heat stress risk. Ensure crew hydration and limit outdoor exposure times.'
                : 'Cold conditions. Ensure crew has appropriate cold weather gear.'
        });
    }

    return {
        overall: overallStatus,
        warnings: warnings,
        details: {
            wave: { status: waveStatus, value: waveHeight },
            wind: { status: windStatus, value: current.wind_speed_10m },
            temperature: { status: tempStatus, value: current.temperature_2m }
        }
    };
}

let allPorts = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();

    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeLiveDataPage();

    hideLoader();
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

        await fetchAndDisplayWeather(selectedPort.id, selectedPort.name);

        // Re-enable button and restore original text
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalBtnText;
    }
}

/**
 * Fetches weather data from the API for a given port and updates the UI.
 * @param {number} portId - The ID of the port.
 * @param {string} portName - The name of the port to display.
 */
async function fetchAndDisplayWeather(portId, portName) {
    showLoadingState(true);
    updateCurrentTimeDisplay();
    try {
        const weatherData = await getWeatherData(portId);

        // Log the API response for debugging purposes
        console.log('--- Cached Weather Data ---');
        console.log(weatherData);
        console.log('----------------------------');

        updateWeatherCards(weatherData, portName);
        updateForecastCards(weatherData.hourly, weatherData);
    } catch (error) {
        // Log any errors that occur during the fetch
        console.error('Error fetching or displaying weather:', error);
        showAlert('Failed to fetch cached weather data. Weather updates daily at 2 AM.', 'warning');
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

    // Perform safety assessment
    const safetyAssessment = performSafetyAssessment(data);

    // Update Weather Card
    document.getElementById('location-name').textContent = portName;
    document.getElementById('weather-icon').className = `bi ${weatherInfo.icon} display-4 ${weatherInfo.color}`;
    document.getElementById('weather-description').textContent = weatherInfo.description;
    document.getElementById('weather-temp').textContent = `${weather.temperature_2m.toFixed(1)} °C`;
    document.getElementById('wind-speed').textContent = `${weather.wind_speed_10m.toFixed(1)} km/h`;

    // Add safety indicator to wind speed
    const windSafetyIcon = getSafetyIcon(safetyAssessment.details.wind.status);
    document.getElementById('wind-speed').innerHTML = `${weather.wind_speed_10m.toFixed(1)} km/h ${windSafetyIcon}`;

    // Add safety indicator to temperature
    const tempSafetyIcon = getSafetyIcon(safetyAssessment.details.temperature.status);
    document.getElementById('weather-temp').innerHTML = `${weather.temperature_2m.toFixed(1)} °C ${tempSafetyIcon}`;

    // Update Wave Card - handle missing marine data
    const hasMarineData = weather.wave_height !== null && weather.wave_height !== undefined;
    
    if (hasMarineData) {
        document.getElementById('wave-height').textContent = `${weather.wave_height.toFixed(1)} m`;
        document.getElementById('wave-period').textContent = `${(weather.wave_period || 0).toFixed(1)} s`;
        document.getElementById('wave-direction').textContent = `${(weather.wave_direction || 0).toFixed(0)} °`;

        // Add safety indicators to wave data
        const waveSafetyIcon = getSafetyIcon(safetyAssessment.details.wave.status);
        document.getElementById('wave-height').innerHTML = `${weather.wave_height.toFixed(1)} m ${waveSafetyIcon}`;

        const periodSafetyIcon = getSafetyIcon('safe');
        document.getElementById('wave-period').innerHTML = `${(weather.wave_period || 0).toFixed(1)} s ${periodSafetyIcon}`;

        const directionSafetyIcon = getSafetyIcon('safe');
        document.getElementById('wave-direction').innerHTML = `${(weather.wave_direction || 0).toFixed(0)} ° ${directionSafetyIcon}`;
    } else {
        // No marine data available (inland port or data unavailable)
        document.getElementById('wave-height').innerHTML = `<span class="text-muted">N/A</span>`;
        document.getElementById('wave-period').innerHTML = `<span class="text-muted">N/A</span>`;
        document.getElementById('wave-direction').innerHTML = `<span class="text-muted">N/A</span>`;
    }

    // Update safety status badges on card headers
    const weatherBadge = document.getElementById('weather-safety-badge');
    const waveBadge = document.getElementById('wave-safety-badge');

    // Determine weather card status (based on wind and temperature)
    let weatherCardStatus = 'safe';
    if (safetyAssessment.details.wind.status === 'dangerous' ||
        safetyAssessment.details.temperature.status === 'dangerous') {
        weatherCardStatus = 'dangerous';
    } else if (safetyAssessment.details.wind.status === 'caution' ||
        safetyAssessment.details.temperature.status === 'caution') {
        weatherCardStatus = 'caution';
    }

    // Update Weather Card badge
    weatherBadge.className = `badge ${getSafetyStatusClass(weatherCardStatus)} text-white`;
    weatherBadge.innerHTML = `${getSafetyIcon(weatherCardStatus)} ${getSafetyStatusText(weatherCardStatus)}`;

    // Update Wave Card badge
    waveBadge.className = `badge ${getSafetyStatusClass(safetyAssessment.details.wave.status)} text-white`;
    waveBadge.innerHTML = `${getSafetyIcon(safetyAssessment.details.wave.status)} ${getSafetyStatusText(safetyAssessment.details.wave.status)}`;

    // Add educational tooltips
    addTooltip('weather-temp', 'Safe operating temperature: 10°C - 35°C. Extreme temperatures require additional crew protection.');
    addTooltip('wind-speed', 'Safe wind speed: < 40 km/h. Higher winds may require tugboat assistance or operation delays.');
    addTooltip('wave-height', 'Safe wave height: < 2.0m. Higher waves increase risks during docking and crew operations.');

    // Initialize tooltips
    initializeSafetyTooltips();

    // Update overall safety banner// Update the overall safety assessment banner
    updateSafetyBanner(safetyAssessment);
}



/**
 * Returns the appropriate emoji/icon for a safety status
 * @param {string} status - 'safe', 'caution', or 'dangerous'
 * @returns {string} The icon HTML
 */
function getSafetyIcon(status) {
    const icons = {
        'safe': '✅',
        'caution': '⚠️',
        'dangerous': '🔴'
    };
    return icons[status] || '';
}

/**
 * Returns CSS class for safety status styling
 * @param {string} status - 'safe', 'caution', or 'dangerous'
 * @returns {string} The CSS class name
 */
function getSafetyStatusClass(status) {
    const classes = {
        'safe': 'bg-success',
        'caution': 'bg-warning',
        'dangerous': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

/**
 * Returns a readable status text
 * @param {string} status - 'safe', 'caution', or 'dangerous'
 * @returns {string} Human-readable status
 */
function getSafetyStatusText(status) {
    const texts = {
        'safe': 'SAFE',
        'caution': 'CAUTION',
        'dangerous': 'DANGEROUS'
    };
    return texts[status] || 'UNKNOWN';
}

/**
 * Updates the overall safety assessment banner with warnings and recommendations
 * @param {object} safetyAssessment - The complete safety assessment object
 */
function updateSafetyBanner(safetyAssessment) {
    const banner = document.getElementById('safety-assessment-banner');
    const overallIcon = document.getElementById('safety-overall-icon');
    const overallStatus = document.getElementById('safety-overall-status');
    const overallMessage = document.getElementById('safety-overall-message');
    const warningsContainer = document.getElementById('safety-warnings-container');
    const warningsList = document.getElementById('safety-warnings-list');

    // Show the banner
    banner.classList.remove('d-none');

    // Update overall status
    const statusClass = getSafetyStatusClass(safetyAssessment.overall);
    const statusText = getSafetyStatusText(safetyAssessment.overall);
    const statusIcon = getSafetyIcon(safetyAssessment.overall);

    overallStatus.className = `badge ${statusClass} text-white`;
    overallStatus.innerHTML = `${statusIcon} ${statusText}`;

    // Update icon based on status
    const iconClasses = {
        'safe': 'bi-shield-check text-success',
        'caution': 'bi-shield-exclamation text-warning',
        'dangerous': 'bi-shield-x text-danger'
    };
    overallIcon.className = `bi ${iconClasses[safetyAssessment.overall]} display-4`;

    // Update overall message
    const messages = {
        'safe': 'All conditions are within safe operational limits. Normal operations may proceed.',
        'caution': 'Some conditions require attention. Operations may proceed with enhanced safety protocols.',
        'dangerous': 'Hazardous conditions detected. Operations are not recommended at this time.'
    };
    overallMessage.textContent = messages[safetyAssessment.overall];

    // Handle warnings
    warningsContainer.classList.remove('d-none'); // Always show the warnings section
    
    if (safetyAssessment.warnings.length > 0) {
        warningsList.innerHTML = '';

        safetyAssessment.warnings.forEach((warning, index) => {
            const warningCard = document.createElement('div');
            warningCard.className = `alert alert-${warning.level === 'dangerous' ? 'danger' : 'warning'} mb-3`;
            warningCard.innerHTML = `
                <div class="d-flex">
                    <div class="me-3">
                        <i class="bi bi-${warning.level === 'dangerous' ? 'exclamation-octagon' : 'exclamation-triangle'}-fill fs-4"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="alert-heading mb-2">
                            ${getSafetyIcon(warning.level)} 
                            ${warning.type.charAt(0).toUpperCase() + warning.type.slice(1)} ${warning.level === 'dangerous' ? 'DANGER' : 'WARNING'}
                        </h6>
                        <p class="mb-2"><strong>Issue:</strong> ${warning.message}</p>
                        <p class="mb-0">
                            <i class="bi bi-lightbulb me-1"></i>
                            <strong>Recommendation:</strong> ${warning.recommendation}
                        </p>
                    </div>
                </div>
            `;
            warningsList.appendChild(warningCard);
        });
    } else {
        // Show a positive message when no warnings
        warningsList.innerHTML = `
            <div class="alert alert-success mb-0">
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <i class="bi bi-check-circle-fill fs-4"></i>
                    </div>
                    <div class="flex-grow-1">
                        <p class="mb-0">
                            <strong>✅ All Clear!</strong> No safety warnings at this time. All weather and sea conditions are within safe operational parameters.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Updates the forecast section with hourly data and safety assessments.
 * @param {Object} hourlyData - The hourly forecast data from the API.
 * @param {Object} currentData - The current weather data for baseline comparison.
 */
function updateForecastCards(hourlyData, currentData) {
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
    const usedIndices = new Set(); // Track which data points we've already used

    // Debug: Log the available time range
    console.log('📅 Current time:', currentTime.toISOString());
    console.log('📅 Last available forecast time:', hourlyData.time[hourlyData.time.length - 1]);
    console.log('📅 Total forecast hours available:', hourlyData.time.length);

    forecastHours.forEach(hourOffset => {
        const forecastTime = new Date(currentTime.getTime() + hourOffset * 60 * 60 * 1000);
        const closestIndex = findClosestTimeIndex(hourlyData.time, forecastTime);

        if (closestIndex === -1) return;

        // Skip if we've already used this data point (prevents duplicate cards)
        if (usedIndices.has(closestIndex)) {
            console.log(`⚠️ +${hourOffset}h: Skipping duplicate index ${closestIndex} (${hourlyData.time[closestIndex]})`);
            return;
        }
        usedIndices.add(closestIndex);

        const matchedTime = new Date(hourlyData.time[closestIndex]);
        const timeDiffHours = Math.abs(matchedTime.getTime() - forecastTime.getTime()) / (1000 * 60 * 60);
        
        // Debug: Log what time we're looking for and what we found
        console.log(`🔍 +${hourOffset}h: Looking for ${forecastTime.toISOString()}, found ${hourlyData.time[closestIndex]}, diff: ${timeDiffHours.toFixed(1)}h`);
        
        // If the matched time is more than 6 hours BEFORE our target (meaning we're at the end of available data),
        // use the forecast target time for display instead of the matched time
        const time = (matchedTime.getTime() < forecastTime.getTime() - (6 * 60 * 60 * 1000)) 
            ? forecastTime 
            : matchedTime;
        const weatherInfo = getWeatherInfoFromCode(hourlyData.weather_code[closestIndex]);

        // Assess safety for this forecast period
        const waveHeight = hourlyData.wave_height && hourlyData.wave_height[closestIndex] !== null ? hourlyData.wave_height[closestIndex] : 0;
        const forecastSafety = assessForecastSafety(
            waveHeight,
            hourlyData.wind_speed_10m[closestIndex],
            hourlyData.temperature_2m[closestIndex]
        );

        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3';

        // Determine border color based on safety status
        const borderClass = {
            'safe': 'border-success',
            'caution': 'border-warning',
            'dangerous': 'border-danger'
        }[forecastSafety.overall] || 'border-secondary';

        // Format wave display
        const waveDisplay = waveHeight > 0 
            ? `${waveHeight.toFixed(1)}m ${getSafetyIcon(forecastSafety.details.wave)}`
            : '<span class="text-muted">N/A</span>';

        col.innerHTML = `
            <div class="card h-100 ${borderClass}" style="border-width: 3px;">
                <div class="card-header text-center ${getSafetyStatusClass(forecastSafety.overall)} text-white py-2">
                    <strong>${getSafetyIcon(forecastSafety.overall)} ${getSafetyStatusText(forecastSafety.overall)}</strong>
                </div>
                <div class="card-body text-center">
                    <h6 class="text-muted mb-3">+${hourOffset} Hours</h6>
                    <p class="small text-muted mb-3">${time.toLocaleString('en-MY', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}</p>
                    <i class="bi ${weatherInfo.icon} display-6 ${weatherInfo.color} mb-3"></i>
                    <p class="mb-2"><strong>${hourlyData.temperature_2m[closestIndex].toFixed(1)}°C</strong> ${getSafetyIcon(forecastSafety.details.temperature)}</p>
                    <p class="mb-2 small">Wind: ${hourlyData.wind_speed_10m[closestIndex].toFixed(1)} km/h ${getSafetyIcon(forecastSafety.details.wind)}</p>
                    <p class="mb-0 small">Waves: ${waveDisplay}</p>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

/**
 * Assesses safety for a specific forecast period
 * @param {number} waveHeight - Wave height in meters
 * @param {number} windSpeed - Wind speed in km/h
 * @param {number} temperature - Temperature in Celsius
 * @returns {object} Safety assessment for the forecast period
 */
function assessForecastSafety(waveHeight, windSpeed, temperature) {
    // Assess individual parameters - handle missing marine data
    const safeWaveHeight = waveHeight !== null && waveHeight !== undefined ? waveHeight : 0;
    const waveStatus = assessSafetyLevel(safeWaveHeight, SAFETY_THRESHOLDS.waveHeight);
    const windStatus = assessSafetyLevel(windSpeed, SAFETY_THRESHOLDS.windSpeed);

    // Temperature assessment
    let tempStatus = 'safe';
    if (temperature < SAFETY_THRESHOLDS.temperature.safe.min ||
        temperature > SAFETY_THRESHOLDS.temperature.safe.max) {
        tempStatus = 'caution';
    }

    // Determine overall status (worst case wins)
    const statuses = [waveStatus, windStatus, tempStatus];
    let overallStatus = 'safe';
    if (statuses.includes('dangerous')) overallStatus = 'dangerous';
    else if (statuses.includes('caution')) overallStatus = 'caution';

    return {
        overall: overallStatus,
        details: {
            wave: waveStatus,
            wind: windStatus,
            temperature: tempStatus
        }
    };
}

/**
 * Shows or hides the loading overlay and content sections.
 * @param {boolean} isLoading - True to show loading state, false to show content.
 */
function showLoadingState(isLoading) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const weatherDataRow = document.getElementById('weather-data-row');
    const forecastRow = document.getElementById('forecast-row');
    const safetyLegend = document.getElementById('safety-legend');

    if (isLoading) {
        loadingOverlay.classList.remove('d-none');
        loadingOverlay.classList.add('d-flex');
        weatherDataRow.classList.add('d-none');
        forecastRow.classList.add('d-none');
        if (safetyLegend) safetyLegend.classList.add('d-none');
    } else {
        loadingOverlay.classList.add('d-none');
        loadingOverlay.classList.remove('d-flex');
        weatherDataRow.classList.remove('d-none');
        if (safetyLegend) safetyLegend.classList.remove('d-none');
    }
}

/**
 * Finds the index in a time array that is closest to a target time.
 * Prioritizes future times over past times to avoid showing duplicate data.
 * @param {Array<string>} timeArray - Array of ISO date strings.
 * @param {Date} targetTime - The target time to find the closest match for.
 * @returns {number} The index of the closest time, or -1 if none suitable found.
 */
function findClosestTimeIndex(timeArray, targetTime) {
    const targetTimestamp = targetTime.getTime();
    let closestIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < timeArray.length; i++) {
        const currentTime = new Date(timeArray[i]).getTime();
        const diff = Math.abs(currentTime - targetTimestamp);
        
        // Prefer future times; only use past times if no future time is closer
        if (diff < minDiff) {
            // If we already have a match and this one is further in the past, skip it
            if (closestIndex !== -1 && currentTime < targetTimestamp && 
                new Date(timeArray[closestIndex]).getTime() >= targetTimestamp) {
                continue;
            }
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
        80: { icon: "bi-cloud-drizzle-fill", color: "text-info", description: "Rain showers" },
        95: { icon: "bi-cloud-lightning-rain-fill", color: "text-danger", description: "Thunderstorm" }
    };
    return weatherMap[code] || { icon: "bi-question-circle", color: "", description: "Unknown" };
}

/**
 * Initializes Bootstrap tooltips for safety information
 * This provides educational hover text explaining the safety indicators
 */
function initializeSafetyTooltips() {
    // Add tooltips to safety badges if Bootstrap tooltip is available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }
}

/**
 * Adds educational tooltips to elements
 * @param {string} elementId - The ID of the element
 * @param {string} tooltipText - The tooltip text to display
 */
function addTooltip(elementId, tooltipText) {
    const element = document.getElementById(elementId);
    if (element) {
        element.setAttribute('data-bs-toggle', 'tooltip');
        element.setAttribute('data-bs-placement', 'top');
        element.setAttribute('title', tooltipText);
    }
}
/**
 * Updates and displays the current local time
 */
function updateCurrentTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleString('en-MY', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
    });
    
    const displayElement = document.getElementById('current-time-display');
    if (displayElement) {
        displayElement.textContent = timeString;
    }
}