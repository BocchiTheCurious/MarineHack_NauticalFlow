// login.js

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const API_URL = 'http://127.0.0.1:5000/api';

    if (localStorage.getItem('nauticalflow-token')) {
        redirectToDashboard();
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Please enter both username and password.');
            return;
        }

        const loginBtn = document.querySelector('button[type="submit"]');
        const originalBtnText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';

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
            
            // --- Successful Login ---
            handleSuccessfulLogin(data.token, data.displayName);

        } catch (error) {
            showError('Could not connect to the server.');
        } finally {
            if (!localStorage.getItem('nauticalflow-token')) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalBtnText;
            }
        }
    });
});

function handleSuccessfulLogin(token, displayName) {
    // Store only the token and display name
    localStorage.setItem('nauticalflow-token', token);
    localStorage.setItem('nauticalflow-display-name', displayName);
    
    redirectToDashboard();
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

function redirectToDashboard() {
    // Always redirect to the single admin dashboard
    window.location.href = 'admin/homepage.html';
}