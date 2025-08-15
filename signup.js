// signup.js

document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const API_URL = 'http://127.0.0.1:5000/api'; // Base URL for your Flask API

    // Handle password visibility toggle
    togglePasswordBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('bi-eye');
        this.querySelector('i').classList.toggle('bi-eye-slash');
    });
    
    // Password strength checker
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = checkPasswordStrength(password);
        updatePasswordStrengthIndicator(strength);
    });
    
    // Handle form submission
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const displayName = document.getElementById('display-name').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = passwordInput.value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // --- Client-side validation ---
        const validation = validateForm(displayName, username, password, confirmPassword);
        if (!validation.isValid) {
            showError(validation.message);
            return;
        }
        
        const signupBtn = document.querySelector('button[type="submit"]');
        const originalText = signupBtn.innerHTML;
        signupBtn.disabled = true;
        signupBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating Account...';
        
        try {
            const response = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName, username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Show specific error from backend (e.g., "Username already exists")
                showError(data.error || `Error: ${response.statusText}`);
                return;
            }

            // --- Successful Signup ---
            handleSuccessfulSignup(displayName, signupBtn);

        } catch (error) {
            console.error('Signup request failed:', error);
            showError('Could not connect to the server. Please try again later.');
        } finally {
            if (!response || !response.ok) { // Only re-enable if there was an error
                 signupBtn.disabled = false;
                 signupBtn.innerHTML = originalText;
            }
        }
    });
});


// --- Helper Functions (mostly unchanged) ---

function handleSuccessfulSignup(displayName, signupBtn) {
    // Show success state on button
    signupBtn.classList.remove('btn-primary');
    signupBtn.classList.add('btn-success');
    signupBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Account Created!';
    
    showSuccess(`Welcome, ${displayName}! Redirecting to login...`);
    
    // Redirect to login page after a short delay
    setTimeout(() => {
        window.location.href = 'index.html'; // Or your login page filename
    }, 2500);
}

function validateForm(displayName, username, password, confirmPassword) {
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

function showSuccess(message) {
    const successText = document.getElementById('success-text');
    successText.textContent = message;
    document.getElementById('success-message').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
}

function showError(message) {
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('success-message').style.display = 'none';
}