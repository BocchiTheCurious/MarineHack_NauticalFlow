import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, showLoader, hideLoader } from './modules/utils.js';
import { getUserProfile, updateUserProfile, changeUserPassword } from './modules/api.js';
import { loadLayout } from './modules/layout.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();

    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeProfilePage();

     hideLoader();
});

/**
 * Sets up all functionality for the profile page.
 */
async function initializeProfilePage() {
    // The try/catch block has been removed to prevent the alert from showing.
    // The script will now attempt to fetch the profile, and if it fails,
    // the page will simply show the default placeholder data.
    const profile = await getUserProfile();
    if (profile) {
        populateProfileHeader(profile);
    }

    document.getElementById('personal-info-form').addEventListener('submit', handleUpdateInfo);
    document.getElementById('password-form').addEventListener('submit', handleChangePassword);
    
    const newPasswordInput = document.getElementById('new-password');
    newPasswordInput.addEventListener('input', () => {
        const strength = checkPasswordStrength(newPasswordInput.value);
        updatePasswordStrengthIndicator(strength);
    });

    setupPasswordToggle('toggle-current-password', 'current-password');
    setupPasswordToggle('toggle-new-password', 'new-password');
    setupPasswordToggle('toggle-confirm-password', 'confirm-new-password');
}

/**
 * A reusable function to add show/hide functionality to a password field.
 * @param {string} toggleId The ID of the button element.
 * @param {string} inputId The ID of the input[type=password] element.
 */
function setupPasswordToggle(toggleId, inputId) {
    const toggleButton = document.getElementById(toggleId);
    const passwordInput = document.getElementById(inputId);

    if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            toggleButton.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
    }
}

/**
 * Fills the page header with the user's profile data and initials.
 */
function populateProfileHeader(profile) {
    document.getElementById('profile-display-name').textContent = profile.displayName;
    document.getElementById('profile-username').textContent = `@${profile.username}`;
    document.getElementById('display-name').value = profile.displayName;
    document.getElementById('username').value = profile.username;

    const avatar = document.querySelector('.profile-avatar');
    if(avatar) {
        const initials = profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
        avatar.innerHTML = `<span>${initials}</span>`;
    }
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
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Your profile has been updated.',
            timer: 2000,
            showConfirmButton: false
        });
        
        populateProfileHeader({ displayName, username });
        localStorage.setItem('nauticalflow-display-name', displayName);
        updateUserDisplayName();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Update Failed', text: error.message });
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Handles the submission of the change password form with SweetAlerts.
 */
async function handleChangePassword(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        Swal.fire('Incomplete', 'Please fill in all password fields.', 'warning');
        return;
    }
    if (newPassword !== confirmPassword) {
        Swal.fire('Mismatch', 'The new passwords do not match.', 'error');
        return;
    }
    if (!isStrongPassword(newPassword)) {
        Swal.fire('Weak Password', 'Your new password is not strong enough. Please follow the requirements below the input field.', 'warning');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Changing...';

    try {
        await changeUserPassword({ currentPassword, newPassword });

        Swal.fire({
            icon: 'success',
            title: 'Password Changed!',
            text: 'Your password has been updated successfully.'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'homepage.html';
            }
        });
        
        form.reset();
        updatePasswordStrengthIndicator('');

    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Change Failed', text: error.message });
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// --- Password Strength Helper Functions ---
function isStrongPassword(password) {
    if (password.length < 8) return false;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
}

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