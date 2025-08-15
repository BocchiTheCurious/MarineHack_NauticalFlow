// js/profile.js
import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getUserProfile, updateUserProfile, changeUserPassword } from './modules/api.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Initialize common UI components from utils
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    // Run the specific logic for the profile page
    initializeProfilePage();
});

/**
 * Sets up all functionality for the profile page.
 */
async function initializeProfilePage() {
    // Fetch and display user data
    try {
        const profile = await getUserProfile();
        populateProfileData(profile);
    } catch (error) {
        showAlert('Could not load profile data.', 'danger');
    }

    // Set up form submission listeners
    const personalInfoForm = document.getElementById('personal-info-form');
    personalInfoForm.addEventListener('submit', handleUpdateInfo);

    const passwordForm = document.getElementById('password-form');
    passwordForm.addEventListener('submit', handleChangePassword);

    // Set up password strength checker
    const newPasswordInput = document.getElementById('new-password');
    newPasswordInput.addEventListener('input', () => {
        const strength = checkPasswordStrength(newPasswordInput.value);
        updatePasswordStrengthIndicator(strength);
    });
}

/**
 * Fills the page with the user's profile data.
 * @param {Object} profile - The user data object from the API.
 */
function populateProfileData(profile) {
    document.getElementById('profile-display-name').textContent = profile.displayName;
    document.getElementById('profile-username').textContent = `@${profile.username}`;
    document.getElementById('display-name').value = profile.displayName;
    document.getElementById('username').value = profile.username;
}

/**
 * Handles the submission of the personal information form.
 */
async function handleUpdateInfo(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const displayName = document.getElementById('display-name').value.trim();
    const username = document.getElementById('username').value.trim();

    // Basic validation
    if (displayName.length < 2 || username.length < 3) {
        showAlert('Display name and username must be valid.', 'warning');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';

    try {
        const updatedProfile = await updateUserProfile({ displayName, username });
        populateProfileData(updatedProfile); // Refresh UI with new data
        updateUserDisplayName(); // Update navbar as well
        showAlert('Profile updated successfully!', 'success');
    } catch (error) {
        showAlert(error.message, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Handles the submission of the change password form.
 */
async function handleChangePassword(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    // Validation
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
        showAlert('Please fill all fields correctly. New password must be at least 8 characters and match the confirmation.', 'warning');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Changing...';

    try {
        await changeUserPassword(currentPassword, newPassword);
        showAlert('Password changed successfully!', 'success');
        event.target.reset(); // Clear the form
        updatePasswordStrengthIndicator(''); // Reset strength bar
    } catch (error) {
        showAlert(error.message, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}


// --- Password Strength Helper Functions ---

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

function updatePasswordStrengthIndicator(strength) {
    const strengthBar = document.getElementById('password-strength');
    strengthBar.className = 'password-strength'; // Reset classes
    if (strength) {
        strengthBar.classList.add(`strength-${strength}`);
    }
}