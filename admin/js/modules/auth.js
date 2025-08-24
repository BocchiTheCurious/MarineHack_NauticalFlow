// js/modules/auth.js

// --- Configuration ---
const API_URL = 'http://127.0.0.1:5000/api';

// --- General Auth Utilities (Exported) ---

/**
 * Checks if a user token exists in localStorage.
 * If the token is not found, it redirects the user to the main index page.
 * This is intended for use on pages that require authentication.
 * @returns {boolean} Returns true if the user is authenticated, otherwise false.
 */
export function checkAuth() {
    if (!localStorage.getItem('nauticalflow-token')) {
        // Adjust the path if your pages are nested differently
        window.location.href = '../index.html';
        return false;
    }
    return true;
}

/**
 * Logs the user out by removing their token and display name from localStorage,
 * then redirects them to the main index page.
 */
export function handleLogout() {
    localStorage.removeItem('nauticalflow-token');
    localStorage.removeItem('nauticalflow-display-name');
    window.location.href = '../index.html';
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


// --- Page Initializers (Exported) ---

/**
 * Sets up all event listeners and initial checks for the login page.
 * It should be called on DOMContentLoaded for the login page.
 */
export function initializeLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return; // Exit if not on the login page

    // If the user is already logged in, redirect them to the dashboard
    if (localStorage.getItem('nauticalflow-token')) {
        redirectToDashboard();
        return;
    }

    loginForm.addEventListener('submit', handleLoginSubmit);
}

/**
 * Sets up all event listeners and functionality for the signup page.
 * It should be called on DOMContentLoaded for the signup page.
 */
export function initializeSignupPage() {
    const signupForm = document.getElementById('signup-form');
    if (!signupForm) return; // Exit if not on the signup page

    const passwordInput = document.getElementById('password');

    // Setup password visibility toggles for both password fields
    setupPasswordToggle('toggle-password', 'password');
    setupPasswordToggle('toggle-confirm-password', 'confirm-password');

    // Setup password strength indicator
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
        showError('Please enter both username and password.');
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
            showError(data.error || 'Login failed. Please try again.');
            return;
        }

        handleSuccessfulLogin(data.token, data.displayName);

    } catch (error) {
        console.error('Login request failed:', error);
        showError('Could not connect to the server.');
    } finally {
        // Only re-enable the button if the login failed and the user is not being redirected
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
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    const validation = validateSignupForm(displayName, username, password, confirmPassword);
    if (!validation.isValid) {
        showError(validation.message);
        return;
    }

    const signupBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = signupBtn.innerHTML;
    toggleButtonSpinner(signupBtn, 'Creating Account...', true);

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

        handleSuccessfulSignup(displayName, signupBtn);

    } catch (error) {
        console.error('Signup request failed:', error);
        showError('Could not connect to the server. Please try again later.');
    } finally {
        // The success handler has a timeout, so don't re-enable the button immediately on success
        if (!document.getElementById('success-message').style.display || document.getElementById('success-message').style.display === 'none') {
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
    signupBtn.disabled = true; // Keep disabled

    showSuccess(`Welcome, ${displayName}! Redirecting to login...`);

    setTimeout(() => {
        window.location.href = 'index.html'; // Redirect to login page
    }, 2500);
}

/**
 * Navigates the user to the admin dashboard page.
 */
function redirectToDashboard() {
    window.location.href = 'admin/homepage.html';
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
        button.innerHTML = text; // Restore original text
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
    strengthBar.className = 'password-strength'; // Reset classes
    if (strength) {
        strengthBar.classList.add(`strength-${strength}`);
    }
}

/**
 * Displays a success message to the user.
 * @param {string} message The message to display.
 */
function showSuccess(message) {
    const successMessageEl = document.getElementById('success-message');
    const successTextEl = document.getElementById('success-text');
    const errorMessageEl = document.getElementById('error-message');

    if (successTextEl && successMessageEl && errorMessageEl) {
        successTextEl.textContent = message;
        successMessageEl.style.display = 'block';
        errorMessageEl.style.display = 'none';
    }
}

/**
 * Displays an error message to the user.
 * @param {string} message The message to display.
 */
function showError(message) {
    const errorMessageEl = document.getElementById('error-message');
    const errorTextEl = document.getElementById('error-text');
    const successMessageEl = document.getElementById('success-message');

    if (errorTextEl && errorMessageEl) {
        errorTextEl.textContent = message;
        errorMessageEl.style.display = 'block';
        if (successMessageEl) {
            successMessageEl.style.display = 'none';
        }
    }
}
