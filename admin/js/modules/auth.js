// js/modules/auth.js

// --- Configuration ---
const API_URL = 'https://nauticalflow-backend.onrender.com/api';

// --- NEW: Toastr Global Configuration ---
// Place this right after your configuration constants.
toastr.options = {
  "closeButton": true,
  "debug": false,
  "newestOnTop": false,
  "progressBar": true,
  "positionClass": "toast-top-right",
  "preventDuplicates": true,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
};

// --- General Auth Utilities (Exported) ---

/**
 * Checks if a user token exists in localStorage.
 * If the token is not found, it redirects the user to the main index page.
 * This is intended for use on pages that require authentication.
 * @returns {boolean} Returns true if the user is authenticated, otherwise false.
 */
export function checkAuth() {
    const token = localStorage.getItem('nauticalflow-token');
    
    if (!token) {
        redirectToLogin();
        return false;
    }
    
    // NEW: Check if token is expired
    if (isTokenExpired(token)) {
        console.log('Token expired, logging out...');
        handleLogout();
        return false;
    }
    
    return true;
}

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
        return true; // Treat invalid tokens as expired
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
}

/**
 * Logs the user out by removing their token and display name from localStorage,
 * then redirects them to the main index page.
 */
export function handleLogout(isExpired = false) {
    localStorage.removeItem('nauticalflow-token');
    localStorage.removeItem('nauticalflow-display-name');
    
    if (isExpired) {
        // Store a message to show after redirect
        localStorage.setItem('nauticalflow-logout-reason', 'expired');
    }
    
    redirectToLogin();
}

/**
 * Finds the logout button by its ID and attaches the handleLogout function
 * to its click event.
 */
export function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
}

/**
 * Centralized redirect to login
 */
function redirectToLogin() {
    window.location.href = '../index.html';
}

/**
 * Check for logout messages and display them
 * Call this in your login page initialization
 */
export function checkLogoutMessage() {
    const reason = localStorage.getItem('nauticalflow-logout-reason');
    if (reason === 'expired') {
        showError('Your session has expired. Please log in again.');
        localStorage.removeItem('nauticalflow-logout-reason');
    }
}

/**
 * Enhanced API call wrapper that handles token expiration
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise} - Fetch promise
 */
export async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('nauticalflow-token');
    
    if (!token || isTokenExpired(token)) {
        handleLogout(true);
        throw new Error('Authentication required');
    }
    
    // Add token to headers
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    try {
        const response = await fetch(url, { ...options, headers });
        
        // Handle token expiration from server
        if (response.status === 401) {
            handleLogout(true);
            throw new Error('Authentication expired');
        }
        
        return response;
    } catch (error) {
        if (error.message === 'Authentication required' || error.message === 'Authentication expired') {
            throw error;
        }
        throw new Error('Network error occurred');
    }
}

// --- Page Initializers (Exported) ---

/**
 * NEW: Initializes both login and signup forms on a single page.
 * Call this on DOMContentLoaded for a page containing both forms.
 */
export function initializeAuthPage() {
    initializeLoginPage();
    initializeSignupPage();
}

/**
 * Sets up all event listeners and initial checks for the login page.
 */
export function initializeLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return; // Exit if login form isn't on the page

    // NEW: Check for logout messages (like session expiration)
    checkLogoutMessage();

    // If the user is already logged in, redirect them
    if (localStorage.getItem('nauticalflow-token')) {
        redirectToDashboard();
        return;
    }
    
    // ADD THIS LINE to handle the login password toggle
    setupPasswordToggle('toggle-password', 'password');

    loginForm.addEventListener('submit', handleLoginSubmit);
}
/**
 * Sets up all event listeners and functionality for the signup page.
 */
export function initializeSignupPage() {
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) return;

    // Define 'passwordInput' by getting the element from the document.
    const passwordInput = document.getElementById('password-signup');

    setupPasswordToggle('toggle-password-signup', 'password-signup');
    setupPasswordToggle('toggle-confirm-password', 'confirm-password');

    // Now this 'if' block will work correctly.
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const strength = checkPasswordStrength(this.value);
            updatePasswordStrengthIndicator(strength);
        });
    }

    signupForm.addEventListener('submit', handleSignupSubmit);
}

// --- Form Submit Handlers (Internal) ---

/**
 * Handles the login form submission, including validation, API call, and UI feedback.
 * @param {Event} e The form submission event.
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showError('Please enter both username and password.'); // This will now call the Toastr version
        return;
    }

    const loginBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = loginBtn.innerHTML;
    toggleButtonSpinner(loginBtn, 'Logging in...', true);

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            showError(data.error || 'Login failed. Please check your credentials.');
            return;
        }

        handleSuccessfulLogin(data.token, data.displayName);

    } catch (error) {
        console.error('Login request failed:', error);
        showError('Could not connect to the server.');
    } finally {
        // This logic is still correct: only reset the button on failure.
        if (!localStorage.getItem('nauticalflow-token')) {
            toggleButtonSpinner(loginBtn, originalBtnText, false);
        }
    }
}

/**
 * Handles the signup form submission, including validation, API call, and UI feedback.
 * @param {Event} e The form submission event.
 */
async function handleSignupSubmit(e) {
    e.preventDefault();
    const displayName = document.getElementById('display-name').value.trim();
    const username = document.getElementById('username-signup').value.trim();
    const password = document.getElementById('password-signup').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    const validation = validateSignupForm(displayName, username, password, confirmPassword);
    if (!validation.isValid) {
        showError(validation.message); // This will now call the Toastr version
        return;
    }

    const signupBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = signupBtn.innerHTML;
    toggleButtonSpinner(signupBtn, 'Creating Account...', true);
    
    // REFACTORED: Use a flag to track success for the 'finally' block
    let signupSuccessful = false; 

    try {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName, username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            showError(data.error || `Error: ${response.statusText}`);
            return;
        }

        signupSuccessful = true; // Set flag to true on success
        handleSuccessfulSignup(displayName, signupBtn);

    } catch (error) {
        console.error('Signup request failed:', error);
        showError('Could not connect to the server. Please try again later.');
    } finally {
        // REFACTORED: This logic is cleaner and no longer depends on HTML elements
        if (!signupSuccessful) {
            toggleButtonSpinner(signupBtn, originalBtnText, false);
        }
    }
}


// --- UI & Helper Functions (Internal) ---

/**
 * Stores user token and display name in localStorage and redirects to the dashboard.
 * @param {string} token The JWT token from the server.
 * @param {string} displayName The user's display name.
 */
function handleSuccessfulLogin(token, displayName) {
    localStorage.setItem('nauticalflow-token', token);
    localStorage.setItem('nauticalflow-display-name', displayName);
    redirectToDashboard();
}

/**
 * Shows a success message and redirects the user to the login page after a delay.
 * @param {string} displayName The user's display name.
 * @param {HTMLElement} signupBtn The signup button element to update its state.
 */
function handleSuccessfulSignup(displayName, signupBtn) {
    signupBtn.classList.remove('btn-primary');
    signupBtn.classList.add('btn-success');
    signupBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Account Created!';
    signupBtn.disabled = true;

    // Use the new Toastr success function
    showSuccess(`Welcome, ${displayName}! Redirecting to login...`);

    setTimeout(() => {
        // Flip the card back to the login form before redirecting for a nice effect
        const flipper = document.getElementById('flipper');
        if (flipper) {
            flipper.classList.remove('is-flipped');
        }
    }, 1500);

    setTimeout(() => {
        window.location.href = 'index.html'; // Or just reload() if on the same page
    }, 2500);
}

/**
 * Navigates the user to the homepage page.
 */
function redirectToDashboard() {
    window.location.href = 'admin/chart-visualization.html';
}

/**
 * Toggles a button's state between active and loading (with a spinner).
 * @param {HTMLElement} button The button element.
 * @param {string} text The text to display (either loading or original).
 * @param {boolean} isDisabled True to disable and show spinner, false to re-enable.
 */
function toggleButtonSpinner(button, text, isDisabled) {
    button.disabled = isDisabled;
    if (isDisabled) {
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${text}`;
    } else {
        button.innerHTML = text;
    }
}

/**
 * Adds show/hide functionality to a password input field.
 * @param {string} toggleId The ID of the button/icon element for toggling.
 * @param {string} inputId The ID of the password input element.
 */
function setupPasswordToggle(toggleId, inputId) {
    const toggleButton = document.getElementById(toggleId);
    const passwordInput = document.getElementById(inputId);

    if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            toggleButton.querySelector('i').className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }
}

/**
 * Validates all fields of the signup form.
 * @returns {{isValid: boolean, message: string}} An object with validation status and an error message.
 */
function validateSignupForm(displayName, username, password, confirmPassword) {
    if (!displayName || !username || !password || !confirmPassword) {
        return { isValid: false, message: 'Please fill in all required fields.' };
    }
    if (displayName.length < 2) {
        return { isValid: false, message: 'Display name must be at least 2 characters long.' };
    }
    if (!/^[a-zA-Z0-9_]{3,}$/.test(username)) {
        return { isValid: false, message: 'Username must be at least 3 characters and contain only letters, numbers, or underscores.' };
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(password)) {
        return { isValid: false, message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.' };
    }
    if (password !== confirmPassword) {
        return { isValid: false, message: 'Passwords do not match.' };
    }
    return { isValid: true, message: '' };
}

/**
 * Analyzes password complexity and returns a strength rating.
 * @param {string} password The password to check.
 * @returns {string} 'weak', 'medium', or 'strong'.
 */
function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
}

/**
 * Updates the password strength indicator UI based on the strength rating.
 * @param {string} strength The strength rating ('weak', 'medium', 'strong').
 */
function updatePasswordStrengthIndicator(strength) {
    const strengthBar = document.getElementById('password-strength');
    if (!strengthBar) return;
    
    // Reset classes
    strengthBar.classList.remove('strength-weak', 'strength-medium', 'strength-strong');

    let width = '0%';
    if (strength === 'weak') {
        width = '33%';
        strengthBar.classList.add('strength-weak');
    } else if (strength === 'medium') {
        width = '66%';
        strengthBar.classList.add('strength-medium');
    } else if (strength === 'strong') {
        width = '100%';
        strengthBar.classList.add('strength-strong');
    }
    
    strengthBar.style.width = width;
}

/**
 * Displays a success message to the user.
 * @param {string} message The message to display.
 */
function showSuccess(message) {
    toastr.success(message, 'Success');
}

/**
 * Displays an error message to the user.
 * @param {string} message The message to display.
 */
function showError(message) {
    toastr.error(message, 'Error');
}
