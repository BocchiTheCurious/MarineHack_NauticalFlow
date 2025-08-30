// js/modules/api.js

// --- API Configuration & Helper ---
const API_BASE_URL = 'http://127.0.0.1:5000/api';

/**
 * A helper function to perform authenticated fetch requests.
 * It automatically adds the JWT token to the headers and handles common responses.
 * @param {string} endpoint - The API endpoint to call (e.g., '/ports').
 * @param {object} [options={}] - The options for the fetch call (method, body, etc.).
 * @param {boolean} [requiresAuth=true] - Whether the endpoint requires an Authorization token.
 * @returns {Promise<any>} The JSON response from the API, or null for empty responses.
 */
async function fetchWithAuth(endpoint, options = {}, requiresAuth = true) {
    // NOTE: Ensure your application consistently uses 'nauticalflow-token' as the key in localStorage.
    const token = localStorage.getItem('nauticalflow-token');
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
            // If unauthorized, token might be expired or invalid. Redirect to login.
            window.location.href = '../index.html';
        }
        // Attempt to parse error message from the server, otherwise use status text.
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'An unspecified API error occurred');
    }

    // Handle responses with no content (e.g., 204 from a DELETE request)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
    }

    return response.json();
}

// --- Authentication Functions ---
/**
 * Logs a user in and returns user data and a token.
 * @param {object} credentials - The user's login credentials {username, password}.
 * @returns {Promise<object>} The server's response, typically including a token.
 */
export function loginUser(credentials) {
    return fetchWithAuth('/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
    }, false); // Auth is not required for the login endpoint itself
}

/**
 * Signs up a new user.
 * @param {object} userData - The data for the new user {displayName, username, password}.
 * @returns {Promise<object>} The server's confirmation message.
 */
export function signupUser(userData) {
    return fetchWithAuth('/signup', {
        method: 'POST',
        body: JSON.stringify(userData)
    }, false); // Auth is not required for the signup endpoint
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
/**
 * Sends route data to the backend to run the optimization algorithm.
 * @param {Array<Array<number>>} routeCoords - The list of [lat, lon] coordinates.
 * @param {number} shipId - The ID of the selected ship.
 * @returns {Promise<object>} The optimization result object.
 */
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
