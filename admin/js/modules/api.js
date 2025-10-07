// js/modules/api.js

// --- API Configuration & Helper ---
const API_BASE_URL = 'http://127.0.0.1:5000/api';

/**
 * Decodes a JWT token without verification (client-side only)
 * @param {string} token - The JWT token
 * @returns {object|null} - Decoded payload or null if invalid
 */
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

/**
 * Checks if a JWT token is expired
 * @param {string} token - The JWT token
 * @returns {boolean} - True if expired
 */
function isTokenExpired(token) {
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.exp) {
        return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
}

/**
 * A helper function to perform authenticated fetch requests.
 * It automatically adds the JWT token to the headers and handles common responses.
 * @param {string} endpoint - The API endpoint to call (e.g., '/ports').
 * @param {object} [options={}] - The options for the fetch call (method, body, etc.).
 * @param {boolean} [requiresAuth=true] - Whether the endpoint requires an Authorization token.
 * @returns {Promise<any>} The JSON response from the API, or null for empty responses.
 */
async function fetchWithAuth(endpoint, options = {}, requiresAuth = true) {
    const token = localStorage.getItem('nauticalflow-token');
    
    if (requiresAuth && token && isTokenExpired(token)) {
        console.log('Token expired before request, logging out...');
        localStorage.removeItem('nauticalflow-token');
        localStorage.removeItem('nauticalflow-display-name');
        localStorage.setItem('nauticalflow-logout-reason', 'expired');
        window.location.href = '../index.html';
        throw new Error('Session expired');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token && requiresAuth) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        if (response.status === 401 && requiresAuth) {
            console.log('401 Unauthorized - clearing session...');
            localStorage.removeItem('nauticalflow-token');
            localStorage.removeItem('nauticalflow-display-name');
            localStorage.setItem('nauticalflow-logout-reason', 'expired');
            window.location.href = '../index.html';
            throw new Error('Session expired');
        }
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'An unspecified API error occurred');
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
    }

    return response.json();
}

// --- Authentication Functions ---
export function loginUser(credentials) {
    return fetchWithAuth('/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
    }, false);
}

export function signupUser(userData) {
    return fetchWithAuth('/signup', {
        method: 'POST',
        body: JSON.stringify(userData)
    }, false);
}

// --- Port Functions (CRUD) ---
export function getPorts() {
    return fetchWithAuth('/ports');
}

export async function addPort(portData) {
    return fetchWithAuth('/ports', {
        method: 'POST',
        body: JSON.stringify(portData)
    });
}

export async function updatePort(portId, portData) {
    return fetchWithAuth(`/ports/${portId}`, {
        method: 'PUT',
        body: JSON.stringify(portData)
    });
}

export async function deletePort(portId) {
    return fetchWithAuth(`/ports/${portId}`, {
        method: 'DELETE'
    });
}


// --- Cruise Ship Functions (CRUD) ---
export function getCruiseShips() {
    return fetchWithAuth('/cruise-ships');
}

export async function addCruiseShip(shipData) {
    return fetchWithAuth('/cruise-ships', { method: 'POST', body: JSON.stringify(shipData) });
}

export async function updateCruiseShip(shipId, shipData) {
    return fetchWithAuth(`/cruise-ships/${shipId}`, {
        method: 'PUT',
        body: JSON.stringify(shipData)
    });
}

export async function deleteCruiseShip(shipId) {
    return fetchWithAuth(`/cruise-ships/${shipId}`, { method: 'DELETE' });
}

// --- Fuel Type Functions (CRUD) ---
export function getFuelTypes() {
    return fetchWithAuth('/fuel-types');
}

export async function addFuelType(fuelTypeData) {
    return fetchWithAuth('/fuel-types', { method: 'POST', body: JSON.stringify(fuelTypeData) });
}

export async function updateFuelType(fuelTypeId, fuelTypeData) {
    return fetchWithAuth(`/fuel-types/${fuelTypeId}`, { method: 'PUT', body: JSON.stringify(fuelTypeData) });
}

export async function deleteFuelType(fuelTypeId) {
    return fetchWithAuth(`/fuel-types/${fuelTypeId}`, { method: 'DELETE' });
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

// --- Optimization Functions ---
// This is the function we corrected
/**
 * Sends route data to the backend to run the optimization algorithm.
 * @param {Array<Array<number>>} coords - The list of [lat, lon] coordinates.
 * @param {number} selectedShipId - The ID of the selected ship.
 * @param {Array<string>} portNames - The list of port names (for congestion calculation).
 * @param {Array<string>} portCountries - The list of port countries (for congestion calculation).
 * @returns {Promise<object>} The optimization result object.
 */
export function runOptimization(coords, selectedShipId, portNames = [], portCountries = []) {
    
    // Get the current time and format it for the backend
    const startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // The payload now uses the correct keys and includes the new ETA data and congestion info
    const payload = {
        coords: coords,
        selectedShipId: selectedShipId,
        start_datetime_str: startTime,
        port_stay_hours: 24, // Using a default of 24 hours
        port_names: portNames,      // NEW: For congestion calculation
        port_countries: portCountries // NEW: For congestion calculation
    };

    return fetchWithAuth('/optimize', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

/**
 * Fetches all previously saved optimization results for the current user.
 * @returns {Promise<Array<object>>} An array of saved result objects.
 */
export function getSavedOptimizations() {
    return fetchWithAuth('/optimizations');
}

/**
 * Saves a new optimization result to the backend.
 * @param {object} resultData - The data object for the result to be saved.
 * @returns {Promise<object>} The server's confirmation message.
 */
export function saveOptimizationResult(resultData) {
    return fetchWithAuth('/optimizations', {
        method: 'POST',
        body: JSON.stringify(resultData)
    });
}

/**
 * Deletes a specific optimization result by its ID.
 * @param {number} resultId - The ID of the result to delete.
 * @returns {Promise<null>} Resolves when deletion is successful.
 */
export function deleteOptimizationResult(resultId) {
    return fetchWithAuth(`/optimizations/${resultId}`, {
        method: 'DELETE'
    });
}

// --- Congestion Data Functions ---
/**
 * Fetches regional congestion data (2023, All ships) from US_PortCalls.csv
 * @returns {Promise<object>} The congestion data with country-level median port times
 */
export function getCongestionData() {
    return fetchWithAuth('/congestion-data');
}

// --- External APIs: Live Weather Data ---
/**
 * Fetches current and hourly marine weather data from the Open-Meteo API.
 * This function does not use fetchWithAuth as it's an unauthenticated, public API.
 * @param {number} latitude - The latitude for the weather forecast.
 * @param {number} longitude - The longitude for the weather forecast.
 * @returns {Promise<Object>} The combined weather data from the APIs.
 */
export async function getWeatherData(latitude, longitude) {
    const weatherParams = "temperature_2m,weather_code,wind_speed_10m";
    const marineParams = "wave_height,wave_direction,wave_period";
    const weatherURL = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=${weatherParams},weather_code&hourly=${weatherParams}&timezone=auto&forecast_days=2`;
    const marineURL = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=${marineParams}&hourly=wave_height&timezone=auto&forecast_days=2`;

    try {
        const [weatherResponse, marineResponse] = await Promise.all([
            fetch(weatherURL),
            fetch(marineURL)
        ]);

        if (!weatherResponse.ok || !marineResponse.ok) {
            console.error("Weather API Error:", await weatherResponse.text());
            console.error("Marine API Error:", await marineResponse.text());
            throw new Error(`Failed to fetch data from one or more weather APIs.`);
        }

        const weatherData = await weatherResponse.json();
        const marineData = await marineResponse.json();

        // Manually and precisely merge the two results into a single object
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
            current: { ...weatherData.current, ...marineData.current },
            hourly: {
                time: weatherData.hourly.time,
                temperature_2m: weatherData.hourly.temperature_2m,
                weather_code: weatherData.hourly.weather_code,
                wind_speed_10m: weatherData.hourly.wind_speed_10m,
                wave_height: marineData.hourly.wave_height
            }
        };
        return combinedData;
    } catch (error) {
        console.error("Failed to fetch and combine weather data:", error);
        throw error; // Re-throw the error to be handled by the calling function
    }
}