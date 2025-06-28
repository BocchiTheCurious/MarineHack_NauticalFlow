// Login Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    // Check if user is already logged in
    if (localStorage.getItem('nauticalflow-logged-in') === 'true') {
        redirectToDashboard();
    }
    
    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        // Show loading state
        const loginBtn = document.querySelector('button[type="submit"]');
        const originalText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Logging in...';
        
        // Simulate API call delay
        setTimeout(() => {
            // Validate credentials
            if (username === 'admin' && password === 'admin123') {
                // Admin login
                handleSuccessfulLogin(username, 'admin', rememberMe, loginBtn, originalText);
            } else if (username === 'user' && password === 'user123') {
                // User login
                handleSuccessfulLogin(username, 'user', rememberMe, loginBtn, originalText);
            } else {
                // Show error message
                showError('Invalid username or password. Please try again.');
                
                // Reset button state
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
                
                // Clear password field
                document.getElementById('password').value = '';
                document.getElementById('password').focus();
            }
        }, 1000);
    });
    
    // Pre-fill username if remembered
    const rememberedUsername = localStorage.getItem('nauticalflow-username');
    if (rememberedUsername) {
        document.getElementById('username').value = rememberedUsername;
        document.getElementById('remember-me').checked = true;
    }
    
    // Auto-focus username field
    document.getElementById('username').focus();
    
    // Handle Enter key in password field
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
    
    // Handle Enter key in username field
    document.getElementById('username').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('password').focus();
        }
    });
});

// Handle successful login
function handleSuccessfulLogin(username, userType, rememberMe, loginBtn, originalText) {
    // Store login status and user type
    localStorage.setItem('nauticalflow-logged-in', 'true');
    localStorage.setItem('nauticalflow-user-type', userType);
    if (rememberMe) {
        localStorage.setItem('nauticalflow-username', username);
    }
    
    // Show success state
    loginBtn.classList.remove('btn-primary');
    loginBtn.classList.add('btn-success');
    loginBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Success!';
    
    // Redirect to appropriate dashboard
    setTimeout(() => {
        redirectToDashboard();
    }, 600);
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
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
