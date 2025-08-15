// js/modules/utils.js
export function showAlert(message, type = 'info') {
    const container = document.querySelector('main'); // Target the main content area
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

export function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

export function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// New function to update the navbar display name
export function updateUserDisplayName() {
    const displayNameElement = document.getElementById('user-display-name');
    const storedName = localStorage.getItem('nauticalflow-display-name');
    if (displayNameElement && storedName) {
        displayNameElement.textContent = storedName;
    }
}