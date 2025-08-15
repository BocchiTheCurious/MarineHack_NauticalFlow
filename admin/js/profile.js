import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showAlert } from './modules/utils.js';
import { getUserProfile, getProfileStats, updateUserProfile, changeUserPassword } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    await loadLayout();

    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeProfilePage();
});

/**
 * Sets up all functionality for the profile page.
 */
async function initializeProfilePage() {
    try {
        // Fetch profile and stats data concurrently
        const [profile, stats] = await Promise.all([
            getUserProfile(),
            getProfileStats()
        ]);
        populateProfileHeader(profile);
        populateProfileStats(stats);
    } catch (error) {
        showAlert('Could not load profile data.', 'danger');
    }

    // Set up form submission listeners
    document.getElementById('personal-info-form').addEventListener('submit', handleUpdateInfo);
    document.getElementById('password-form').addEventListener('submit', handleChangePassword);

    // Set up password strength checker
    const newPasswordInput = document.getElementById('new-password');
    newPasswordInput.addEventListener('input', () => {
        const strength = checkPasswordStrength(newPasswordInput.value);
        updatePasswordStrengthIndicator(strength);
    });
}

/**
 * Fills the page header with the user's profile data and initials.
 * @param {Object} profile - The user data object from the API.
 */
function populateProfileHeader(profile) {
    document.getElementById('profile-display-name').textContent = profile.displayName;
    document.getElementById('profile-username').textContent = `@${profile.username}`;
    document.getElementById('display-name').value = profile.displayName;
    document.getElementById('username').value = profile.username;

    // Create and display initials in the avatar
    const avatar = document.querySelector('.profile-avatar');
    const initials = profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    avatar.innerHTML = `<span>${initials}</span>`;
}

/**
 * Fills the statistics cards with data.
 * @param {Object} stats - The stats object from the API.
 */
function populateProfileStats(stats) {
    document.querySelector('.profile-stats:nth-child(1) h5').textContent = stats.routesPlanned;
    document.querySelector('.profile-stats:nth-child(2) h5').textContent = stats.routesOptimized;
    document.querySelector('.profile-stats:nth-child(3) h5').textContent = stats.vesselsManaged;
    document.querySelector('.profile-stats:nth-child(4) h5').textContent = stats.daysActive;
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

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';

    try {
        await updateUserProfile({ displayName, username });
        showAlert('Profile updated successfully!', 'success');
        
        // Refresh header and navbar with new name
        populateProfileHeader({ displayName, username });
        localStorage.setItem('nauticalflow-display-name', displayName);
        updateUserDisplayName();
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
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    
    // Add validation...

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Changing...';

    try {
        await changeUserPassword({ currentPassword, newPassword });
        showAlert('Password changed successfully!', 'success');
        form.reset();
        updatePasswordStrengthIndicator('');
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
    strengthBar.className = 'password-strength';
    if (strength) {
        strengthBar.classList.add(`strength-${strength}`);
    }
}