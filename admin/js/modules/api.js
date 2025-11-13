// js/modules/api.js

// --- API Configuration & Helper ---
export const API_BASE_URL = 'https://nauticalflow-backend.onrender.com/api';

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
/**
 * Sends route data to the backend to run the optimization algorithm.
 * @param {Array<Array<number>>} coords - The list of [lat, lon] coordinates.
 * @param {number} selectedShipId - The ID of the selected ship.
 * @returns {Promise<object>} The optimization result object.
 */
export function runOptimization(coords, selectedShipId, portIds = [], optimizationWeights) {
    
    // Get the current time and format it for the backend
    const startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // The payload includes route coordinates, vessel info, port IDs, and weights
    const payload = {
        coords: coords,
        selectedShipId: selectedShipId,
        portIds: portIds,
        weights: optimizationWeights, 
        start_datetime_str: startTime,
        port_stay_hours: 24
    };

    console.log("📤 Sending to API:", payload.weights); // Debug log

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

// --- Analytics Functions ---
/**
 * Fetches overall analytics summary (total optimizations, fuel saved, CO2 reduced)
 * @returns {Promise<object>} Summary statistics
 */
export function getAnalyticsSummary() {
    return fetchWithAuth('/analytics/summary');
}

/**
 * Get monthly optimization trends
 * @param {number} months - Number of months to retrieve (default: 12)
 * @returns {Promise<{labels: string[], counts: number[]}>}
 */
export function getMonthlyTrends(months = 12) {
    return fetchWithAuth(`/analytics/monthly-trends?months=${months}`);
}

/**
 * Fetches recent optimization results
 * @param {number} limit - Number of recent results to fetch (default 10)
 * @returns {Promise<Array>} Array of recent optimization objects
 */
export function getRecentOptimizations(limit = 10) {
    return fetchWithAuth(`/analytics/recent?limit=${limit}`);
}

/**
 * Fetches vessel usage statistics (most used vessels)
 * @returns {Promise<object>} Object with labels and counts arrays
 */
export function getVesselUsageStats() {
    return fetchWithAuth('/analytics/vessel-usage');
}

/**
 * Fetches fuel type distribution from user's optimization history
 * @returns {Promise<object>} Object with labels and counts arrays
 */
export function getFuelTypeDistribution() {
    return fetchWithAuth('/analytics/fuel-distribution');
}

/**
 * Fetches weekly activity data
 * @param {number} weeks - Number of weeks to look back (default 8)
 * @returns {Promise<object>} Object with labels and counts arrays
 */
export function getWeeklyActivity(weeks = 8) {
    return fetchWithAuth(`/analytics/weekly-activity?weeks=${weeks}`);
}

/**
 * Fetches summary statistics for dashboard stats cards
 * @returns {Promise<object>} Object with totalRoutes, totalVessels, totalPorts, totalFuelTypes
 */
export function getStatsSummary() {
    return fetchWithAuth('/analytics/stats-summary');
}

// --- External APIs: Live Weather Data ---
/**
 * Fetches cached weather data from the backend for a specific port.
 * Weather data is updated daily at 2 AM via scheduled cron job.
 * @param {number} portId - The ID of the port to get weather for.
 * @returns {Promise<Object>} The cached weather data from the backend.
 */
export async function getWeatherData(portId) {
    try {
        const response = await fetchWithAuth(`/weather/${portId}`);
        return response.data;  // ✅ Return only the weather data
    } catch (error) {
        console.error('Failed to fetch cached weather data:', error);
        throw error;
    }
}
// --- Port Review Functions ---

export function getPortReviews(portId) {
    return fetchWithAuth(`/ports/${portId}/reviews`);
}

export function getPortReviewsSummary(portId) {
    return fetchWithAuth(`/ports/${portId}/reviews/summary`);
}

export function getMyPortReview(portId) {
    return fetchWithAuth(`/ports/${portId}/reviews/my-review`);
}

export function addPortReview(portId, reviewData) {
    return fetchWithAuth(`/ports/${portId}/reviews`, {
        method: 'POST',
        body: JSON.stringify(reviewData)
    });
}

export function deletePortReview(portId, reviewId) {
    return fetchWithAuth(`/ports/${portId}/reviews/${reviewId}`, {
        method: 'DELETE'
    });
}

// --- Feedback Functions ---
/**
 * Submits user feedback to the backend
 * @param {object} feedbackData - The feedback data object with question responses
 * @returns {Promise<object>} The server's confirmation response
 */
export function submitFeedback(feedbackData) {
    return fetchWithAuth('/feedback', {
        method: 'POST',
        body: JSON.stringify(feedbackData)
    });
}