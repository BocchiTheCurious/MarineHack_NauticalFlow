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
        throw new Error(errorData.message || 'An API error occurred');
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

// --- Profile Functions ---
export function getUserProfile() { return fetchWithAuth('/profile'); }
export function getProfileStats() { return fetchWithAuth('/profile/stats'); }
export function updateUserProfile(profileData) {
    return fetchWithAuth('/profile', { method: 'PUT', body: JSON.stringify(profileData) });
}
export function changeUserPassword(passwordData) {
    return fetchWithAuth('/profile/password', { method: 'PUT', body: JSON.stringify(passwordData) });
}

// =========================================================================
// --- MOCK APIs (The functions below are simulated for development) ---
// =========================================================================

// --- Route Data Management (Mock) ---

const routeDatabase = {
    'route-1': { name: 'Port Klang → Singapore (Cargo Ship)', origin: 'Port Klang, Malaysia', destination: 'Singapore' },
    'route-2': { name: 'Rotterdam → Hamburg (Tanker)', origin: 'Rotterdam, Netherlands', destination: 'Hamburg, Germany' },
    'route-3': { name: 'Shanghai → Los Angeles (Container)', origin: 'Shanghai, China', destination: 'Los Angeles, USA' }
};

export function getRoutes() {
    return new Promise(resolve => {
        setTimeout(() => {
            const routeList = Object.keys(routeDatabase).map(key => ({ id: key, name: routeDatabase[key].name }));
            resolve(routeList);
        }, 500);
    });
}

export function getRouteById(routeId) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(routeDatabase[routeId] || null);
        }, 1000);
    });
}


// --- Marine Zone Management (Mock) ---

const marineZonesDatabase = [
    { id: 'Z001', name: 'North Atlantic Shipping Lane', type: 'Navigation Zone', coordinates: '40°N, 60°W to 45°N, 50°W', area: '125,000', status: 'Active', lastUpdated: '2025-08-10T14:30:00Z' },
    { id: 'Z002', name: 'Mediterranean Protected Area', type: 'Protected Area', coordinates: '35°N, 15°E to 40°N, 25°E', area: '45,000', status: 'Active', lastUpdated: '2025-08-05T11:00:00Z' },
    { id: 'Z003', name: 'Pacific Military Zone', type: 'Restricted Area', coordinates: '20°N, 160°E to 25°N, 170°E', area: '75,000', status: 'Active', lastUpdated: '2025-07-28T09:15:00Z' },
];

export function getMarineZones() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(marineZonesDatabase);
        }, 500);
    });
}


// --- Route Optimization Management (Mock) ---

export function runOptimization(params) {
    return new Promise(resolve => {
        setTimeout(() => {
            const fuelSavings = (params.priorities.fuel / 100 * 20 + 5).toFixed(1);
            const timeSavings = (params.priorities.time / 100 * 3 + 1).toFixed(2);
            const co2Savings = (fuelSavings * 0.9).toFixed(1);
            const result = {
                id: `opt_${Date.now()}`,
                timestamp: new Date().toISOString(),
                route: `${params.departure.split(',')[0]} → ${params.arrival}`,
                vessel: params.vessel,
                fuelSaved: `${fuelSavings}%`,
                co2Reduced: `${co2Savings}%`,
                timeSaved: `${timeSavings}h`
            };
            resolve(result);
        }, 2500);
    });
}

export function getSavedOptimizations() {
    return new Promise(resolve => {
        setTimeout(() => {
            const results = JSON.parse(localStorage.getItem('nauticalflow-saved-optimizations')) || [];
            resolve(results);
        }, 300);
    });
}

export function saveOptimizationResult(result) {
    return new Promise(async resolve => {
        const results = await getSavedOptimizations();
        results.unshift(result);
        localStorage.setItem('nauticalflow-saved-optimizations', JSON.stringify(results));
        resolve(results);
    });
}

export function deleteOptimizationResult(resultId) {
    return new Promise(async resolve => {
        let results = await getSavedOptimizations();
        results = results.filter(r => r.id !== resultId);
        localStorage.setItem('nauticalflow-saved-optimizations', JSON.stringify(results));
        resolve(results);
    });
}