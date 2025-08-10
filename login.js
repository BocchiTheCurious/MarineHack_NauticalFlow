document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // Check if user is already logged in
    if (localStorage.getItem('nauticalflow-token')) {
        redirectToDashboard();
    }

    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        // Show loading state
        const loginBtn = document.querySelector('button[type="submit"]');
        const originalText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Logging in...';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                // Successful login
                localStorage.setItem('nauticalflow-token', data.token);
                localStorage.setItem('nauticalflow-user-type', data.role);
                if (rememberMe) {
                    localStorage.setItem('nauticalflow-username', username);
                }

                // Show success state
                loginBtn.classList.remove('btn-primary');
                loginBtn.classList.add('btn-success');
                loginBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Success!';

                // Redirect
                setTimeout(() => {
                    redirectToDashboard();
                }, 600);
            } else {
                // Show error
                showError(data.error || 'Login failed. Please try again.');
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
                document.getElementById('password').value = '';
                document.getElementById('password').focus();
            }
        } catch (error) {
            showError('Network error. Please try again later.');
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
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

// Redirect to dashboard based on user type
function redirectToDashboard() {
    const userType = localStorage.getItem('nauticalflow-user-type');
    if (userType === 'admin') {
        window.location.href = 'admin/homepage.html';
    } else if (userType === 'user') {
        window.location.href = 'user/user-dashboard.html';
    } else {
        window.location.href = 'admin/homepage.html'; // Default
    }
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}