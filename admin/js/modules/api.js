// js/modules/api.js

// --- Live API Configuration & Helper ---

const API_URL = 'http://127.0.0.1:5000/api';

/**
 * A helper function to perform authenticated fetch requests.
 * It automatically adds the JWT token to the headers.
 * @param {string} endpoint - The API endpoint to call (e.g., '/ports').
 * @param {object} [options={}] - The options for the fetch call (method, body, etc.).
 * @returns {Promise<any>} The JSON response from the API.
 */
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('nauticalflow-token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        if (response.status === 401) {
            // If unauthorized, token might be expired, redirect to login
            window.location.href = '../index.html';
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'An API error occurred');
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return;
    }

    return response.json();
}


// --- Port Functions (Live API) ---

export function getPorts() {
    return fetchWithAuth('/ports');
}

export async function addPort(portData) {
    await fetchWithAuth('/ports', {
        method: 'POST',
        body: JSON.stringify(portData)
    });
    return getPorts();
}

export async function deletePort(portId) {
    await fetchWithAuth(`/ports/${portId}`, {
        method: 'DELETE'
    });
    return getPorts();
}

export async function updatePort(portId, portData) {
    await fetchWithAuth(`/ports/${portId}`, {
        method: 'PUT',
        body: JSON.stringify(portData)
    });
    return getPorts();
}

// --- Vessel Functions (Live API) ---

export function getVessels() {
    return fetchWithAuth('/vessels');
}

export async function addVessel(vesselData) {
    const payload = {
        name: vesselData.name,
        type: vesselData.type,
        maxSpeed: vesselData.maxSpeed,
        fuelConsumption: vesselData.fuelConsumption
    };
    await fetchWithAuth('/vessels', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return getVessels();
}

export async function deleteVessel(vesselId) {
    await fetchWithAuth(`/vessels/${vesselId}`, {
        method: 'DELETE'
    });
    return getVessels();
}


// --- Cruise Ship Functions (Corrected Endpoint) ---

export function getCruiseShips() {
    return fetchWithAuth('/cruise-ships');
}

export async function addCruiseShip(shipData) {
    await fetchWithAuth('/cruise-ships', { method: 'POST', body: JSON.stringify(shipData) });
    return getCruiseShips();
}

export async function deleteCruiseShip(shipId) {
    await fetchWithAuth(`/cruise-ships/${shipId}`, { method: 'DELETE' });
    return getCruiseShips();
}

export async function updateCruiseShip(shipId, shipData) {
    await fetchWithAuth(`/cruise-ships/${shipId}`, { 
        method: 'PUT', 
        body: JSON.stringify(shipData) 
    });
    return getCruiseShips();
}


// --- Fuel Type Functions ---

export function getFuelTypes() { return fetchWithAuth('/fuel-types'); }
export async function addFuelType(fuelTypeData) {
    await fetchWithAuth('/fuel-types', { method: 'POST', body: JSON.stringify(fuelTypeData) });
    return getFuelTypes();
}
export async function updateFuelType(fuelTypeId, fuelTypeData) {
    await fetchWithAuth(`/fuel-types/${fuelTypeId}`, { method: 'PUT', body: JSON.stringify(fuelTypeData) });
    return getFuelTypes();
}
export async function deleteFuelType(fuelTypeId) {
    await fetchWithAuth(`/fuel-types/${fuelTypeId}`, { method: 'DELETE' });
    return getFuelTypes();
}


// --- Profile Functions ---

export function getUserProfile() {
    return fetchWithAuth('/profile');
}

export function getProfileStats() {
    return fetchWithAuth('/profile/stats');
}

export function updateUserProfile(profileData) {
    return fetchWithAuth('/profile', { method: 'PUT', body: JSON.stringify(profileData) });
}

export function changeUserPassword(passwordData) {
    return fetchWithAuth('/profile/password', { method: 'PUT', body: JSON.stringify(passwordData) });
}

export function getExchangeRate(date) {
    return fetchWithAuth(`/exchange-rate?date=${date}`);
}

// --- Live Data Feed ---

/**
 * Fetches current and hourly marine weather data from the Open-Meteo API.
 * @param {number} latitude - The latitude for the weather forecast.
 * @param {number} longitude - The longitude for the weather forecast.
 * @returns {Promise<Object>} The weather data from the API.
 */
export async function getWeatherData(latitude, longitude) {
    // 1. Define parameters for both APIs
    const weatherParams = "temperature_2m,weather_code,wind_speed_10m";
    const marineParams = "wave_height,wave_direction,wave_period";
    
    // Define the two different API endpoints
    const weatherURL = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${weatherParams},weather_code&hourly=${weatherParams}&timezone=auto&forecast_days=2`;
    const marineURL = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=${marineParams}&hourly=wave_height&timezone=auto&forecast_days=2`;

    try {
        // 2. Fetch from both APIs in parallel
        const [weatherResponse, marineResponse] = await Promise.all([
            fetch(weatherURL),
            fetch(marineURL)
        ]);

        // 3. Check both responses for errors
        if (!weatherResponse.ok || !marineResponse.ok) {
            console.error("Weather API Error:", await weatherResponse.text());
            console.error("Marine API Error:", await marineResponse.text());
            throw new Error(`Failed to fetch data from one or more weather APIs.`);
        }

        const weatherData = await weatherResponse.json();
        const marineData = await marineResponse.json();

        // 4. Manually and precisely merge the two results
        const combinedData = {
            latitude: weatherData.latitude,
            longitude: weatherData.longitude,
            generationtime_ms: weatherData.generationtime_ms,
            utc_offset_seconds: weatherData.utc_offset_seconds,
            timezone: weatherData.timezone,
            timezone_abbreviation: weatherData.timezone_abbreviation,
            elevation: weatherData.elevation,
            current_units: { ...weatherData.current_units, ...marineData.current_units },
            hourly_units: { ...weatherData.hourly_units, ...marineData.hourly_units },
            current: {
                ...weatherData.current,
                ...marineData.current
            },
            hourly: {
                // Use the 'time' array from the main weather API as the source of truth
                time: weatherData.hourly.time,
                // Add all other arrays from both responses
                temperature_2m: weatherData.hourly.temperature_2m,
                weather_code: weatherData.hourly.weather_code,
                wind_speed_10m: weatherData.hourly.wind_speed_10m,
                wave_height: marineData.hourly.wave_height
            }
        };

        // 5. Return the final, correctly combined object
        return combinedData;

    } catch (error) {
        console.error("Failed to fetch and combine weather data:", error);
        // Re-throw the error so the UI can show an alert
        throw error;
    }
}

// --- Optimization ---
export function runOptimization(routeCoords, shipId) {
    const payload = {
        route: routeCoords,
        shipId: shipId
    };
    return fetchWithAuth('/optimize', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}
export function getSavedOptimizations() {
    // This endpoint should return a list of saved results from your backend
    return fetchWithAuth('/optimizations/saved'); 
}

export function deleteOptimizationResult(resultId) {
    // This endpoint should delete a specific result by its ID
    return fetchWithAuth(`/optimizations/saved/${resultId}`, {
        method: 'DELETE'
    });
}