// js/modules/utils.js

/**
 * Displays a dismissible alert message at the top of the main content area.
 * @param {string} message - The message to display.
 * @param {string} type - The alert type ('success', 'warning', 'danger', 'info').
 */
export function showAlert(message, type = 'info') {
    const container = document.querySelector('main');
    if (!container) return;

    const alertWrapper = document.createElement('div');
    alertWrapper.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show m-3" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    container.prepend(alertWrapper.firstChild);

    setTimeout(() => {
        const alert = container.querySelector('.alert');
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}

/**
 * Formats an ISO date string into a more readable local format.
 * @param {string} dateString - The ISO date string.
 * @returns {string} - The formatted date and time.
 */
export function formatDate(dateString) { // <-- THIS IS THE MISSING FUNCTION
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Initializes all Bootstrap tooltips on the page.
 */
export function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Highlights the active page in the sidebar navigation.
 */
export function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

/**
 * Updates the user's display name in the navbar.
 */
export function updateUserDisplayName() {
    const displayNameElement = document.getElementById('user-display-name');
    const storedName = localStorage.getItem('nauticalflow-display-name');
    if (displayNameElement && storedName) {
        displayNameElement.textContent = storedName;
    }
}

/**
 * Shows the full-screen loading overlay.
 */
export function showLoader() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.classList.remove('hidden');
    }
}

/**
 * Hides the full-screen loading overlay with a fade-out effect.
 */
export function hideLoader() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.classList.add('hidden');
    }
}