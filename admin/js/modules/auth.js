// js/modules/auth.js
export function checkAuth() {
    if (!localStorage.getItem('nauticalflow-token')) {
        window.location.href = '../index.html';
        return false;
    }
    return true;
}

export function handleLogout() {
    localStorage.removeItem('nauticalflow-token');
    localStorage.removeItem('nauticalflow-display-name');
    window.location.href = '../index.html';
}

export function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
}