<<<<<<< HEAD
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
=======
// Signup Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const successMessage = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordStrength = document.getElementById('password-strength');
    
    // Check if user is already logged in
    if (localStorage.getItem('nauticalflow-logged-in') === 'true') {
        redirectToDashboard();
    }
    
    // Handle password visibility toggle
    togglePasswordBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
    });
    
    // Password strength checker
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = checkPasswordStrength(password);
        updatePasswordStrengthIndicator(strength);
    });
    
    // Handle form submission
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const displayName = document.getElementById('display-name').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Validate form
        const validation = validateForm(displayName, username, password, confirmPassword);
        
        if (!validation.isValid) {
            showError(validation.message);
            return;
        }
        
        // Show loading state
        const signupBtn = document.querySelector('button[type="submit"]');
        const originalText = signupBtn.innerHTML;
        signupBtn.disabled = true;
        signupBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Creating Account...';
        
        // Simulate API call delay
        setTimeout(() => {
            // Check if username already exists (simulate backend check)
            if (username === 'admin' || username === 'user') {
                showError('Username already exists. Please choose a different username.');
                signupBtn.disabled = false;
                signupBtn.innerHTML = originalText;
                return;
            }
            
            // Simulate successful account creation
            handleSuccessfulSignup(displayName, username, signupBtn, originalText);
        }, 1500);
    });
    
    // Auto-focus display name field
    document.getElementById('display-name').focus();
    
    // Handle Enter key navigation
    setupEnterKeyNavigation();
});

// Validate form inputs
function validateForm(displayName, username, password, confirmPassword) {
    if (!displayName || !username || !password || !confirmPassword) {
        return { isValid: false, message: 'Please fill in all required fields.' };
    }
    
    if (displayName.length < 2) {
        return { isValid: false, message: 'Display name must be at least 2 characters long.' };
    }
    
    if (username.length < 3) {
        return { isValid: false, message: 'Username must be at least 3 characters long.' };
    }
    
    if (!isValidUsername(username)) {
        return { isValid: false, message: 'Username can only contain letters, numbers, and underscores.' };
    }
    
    if (password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long.' };
    }
    
    if (!isStrongPassword(password)) {
        return { isValid: false, message: 'Password must contain uppercase, lowercase, number, and special character.' };
    }
    
    if (password !== confirmPassword) {
        return { isValid: false, message: 'Passwords do not match.' };
    }
    
    return { isValid: true, message: '' };
}

// Check username validity
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    return usernameRegex.test(username);
}

// Check password strength
function isStrongPassword(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
}

// Check password strength and return level
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

// Update password strength indicator
function updatePasswordStrengthIndicator(strength) {
    const strengthBar = document.getElementById('password-strength');
    strengthBar.className = 'password-strength';
    
    if (strength === 'weak') {
        strengthBar.classList.add('strength-weak');
    } else if (strength === 'medium') {
        strengthBar.classList.add('strength-medium');
    } else if (strength === 'strong') {
        strengthBar.classList.add('strength-strong');
    }
}

// Handle successful signup
function handleSuccessfulSignup(displayName, username, signupBtn, originalText) {
    // Store user data (in real app, this would be sent to backend)
    const userData = {
        displayName: displayName,
        username: username,
        createdAt: new Date().toISOString()
    };
    
    // Store in localStorage for demo purposes
    localStorage.setItem('nauticalflow-user-data', JSON.stringify(userData));
    
    // Show success state
    signupBtn.classList.remove('btn-primary');
    signupBtn.classList.add('btn-success');
    signupBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Account Created!';
    
    // Show success message
    showSuccess(`Welcome ${displayName}! Your account has been created successfully.`);
    
    // Redirect to login page after delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

// Show success message
function showSuccess(message) {
    const successMessage = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    
    successText.textContent = message;
    successMessage.style.display = 'block';
    
    // Hide any existing error message
    document.getElementById('error-message').style.display = 'none';
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    
    // Hide any existing success message
    document.getElementById('success-message').style.display = 'none';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Setup Enter key navigation
function setupEnterKeyNavigation() {
    const inputs = ['display-name', 'username', 'password', 'confirm-password'];
    
    inputs.forEach((inputId, index) => {
        const input = document.getElementById(inputId);
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (index < inputs.length - 1) {
                    document.getElementById(inputs[index + 1]).focus();
                } else {
                    document.getElementById('signup-form').dispatchEvent(new Event('submit'));
                }
            }
        });
    });
}

// Redirect to dashboard based on user type
function redirectToDashboard() {
    const userType = localStorage.getItem('nauticalflow-user-type');
    
    if (userType === 'admin') {
        window.location.href = 'admin/homepage.html';
    } else if (userType === 'user') {
        window.location.href = 'user/user-dashboard.html';
    } else {
        // Default to admin if no user type is stored
        window.location.href = 'admin/homepage.html';
    }
}
>>>>>>> 9d715c893e97bd00cc88f5d3bec7f474e89ecb62
