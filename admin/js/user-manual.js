import { checkAuth, setupLogout } from './modules/auth.js';
import { initializeTooltips, highlightCurrentPage, updateUserDisplayName, hideLoader } from './modules/utils.js';
import { loadLayout } from './modules/layout.js';

// Configure toastr notifications
toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-top-right",
    "preventDuplicates": true,
    "timeOut": "3000"
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;
    await loadLayout();
    
    setupLogout();
    initializeTooltips();
    highlightCurrentPage();
    updateUserDisplayName();

    initializeUserManualPage();

    hideLoader();
});

/**
 * Initializes the user manual page by setting up event listeners
 * for video placeholders and tab navigation.
 */
function initializeUserManualPage() {
    setupVideoPlaceholders();
    setupTabTracking();
    setupScrollToTop();
}

/**
 * Sets up click handlers for video placeholder elements.
 * In a real application, these would open video modals or redirect to video URLs.
 */
function setupVideoPlaceholders() {
    const videoPlaceholders = document.querySelectorAll('.video-placeholder');
    
    videoPlaceholders.forEach(placeholder => {
        placeholder.addEventListener('click', handleVideoClick);
    });
}

/**
 * Handles clicks on video placeholder elements.
 * @param {Event} event - The click event.
 */
function handleVideoClick(event) {
    const videoTitle = event.currentTarget.querySelector('.video-title').textContent;
    const videoDuration = event.currentTarget.querySelector('.video-duration').textContent;
    
    // Show a notification (in a real app, this would open a video player or modal)
    toastr.info(`Video: ${videoTitle}<br>${videoDuration}`, 'Video Player', {
        timeOut: 4000,
        extendedTimeOut: 2000
    });
    
    // Log the video click for analytics (in a real app)
    console.log(`User clicked video: ${videoTitle}`);
    
    // In a real application, you would:
    // - Open a modal with embedded video player
    // - Redirect to a video hosting platform
    // - Track video analytics
    // Example:
    // openVideoModal(videoTitle, videoUrl);
}

/**
 * Sets up tracking for tab navigation to enhance user experience.
 * Stores the active tab in session storage and restores it on page load.
 */
function setupTabTracking() {
    const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
    
    // Restore previously active tab if exists
    const activeTab = sessionStorage.getItem('activeManualTab');
    if (activeTab) {
        const tabButton = document.querySelector(`[data-bs-target="${activeTab}"]`);
        if (tabButton) {
            const tab = new bootstrap.Tab(tabButton);
            tab.show();
        }
    }
    
    // Save active tab when user switches tabs
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', event => {
            const targetTab = event.target.getAttribute('data-bs-target');
            sessionStorage.setItem('activeManualTab', targetTab);
            
            // Log tab view for analytics
            const tabName = event.target.textContent.trim();
            console.log(`User viewed tab: ${tabName}`);
            
            // Scroll to top when switching tabs for better UX
            document.getElementById('main-content').scrollTop = 0;
        });
    });
}

/**
 * Sets up a scroll-to-top button for better navigation in long manual pages.
 */
function setupScrollToTop() {
    const mainContent = document.getElementById('main-content');
    
    // Create scroll-to-top button
    const scrollButton = createScrollToTopButton();
    mainContent.appendChild(scrollButton);
    
    // Show/hide button based on scroll position
    mainContent.addEventListener('scroll', () => {
        if (mainContent.scrollTop > 300) {
            scrollButton.classList.add('show');
        } else {
            scrollButton.classList.remove('show');
        }
    });
    
    // Scroll to top when button is clicked
    scrollButton.addEventListener('click', () => {
        mainContent.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/**
 * Creates a scroll-to-top button element.
 * @returns {HTMLElement} The scroll-to-top button element.
 */
function createScrollToTopButton() {
    const button = document.createElement('button');
    button.className = 'scroll-to-top-btn';
    button.innerHTML = '<i class="bi bi-arrow-up"></i>';
    button.setAttribute('aria-label', 'Scroll to top');
    
    // Add styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .scroll-to-top-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
        }
        
        .scroll-to-top-btn.show {
            opacity: 1;
            visibility: visible;
        }
        
        .scroll-to-top-btn:hover {
            transform: translateY(-5px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .scroll-to-top-btn:active {
            transform: translateY(-2px);
        }
    `;
    
    // Append style only once
    if (!document.querySelector('#scroll-to-top-styles')) {
        style.id = 'scroll-to-top-styles';
        document.head.appendChild(style);
    }
    
    return button;
}

/**
 * Searches through the manual content based on user input.
 * This function would be connected to a search input field.
 * @param {string} searchQuery - The search query string.
 */
function searchManualContent(searchQuery) {
    if (!searchQuery || searchQuery.trim().length < 3) {
        toastr.warning('Please enter at least 3 characters to search', 'Search');
        return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const allContent = document.querySelectorAll('.tab-pane');
    let foundResults = [];
    
    allContent.forEach(tabPane => {
        const tabId = tabPane.id;
        const textContent = tabPane.textContent.toLowerCase();
        
        if (textContent.includes(query)) {
            const tabName = document.querySelector(`[data-bs-target="#${tabId}"]`).textContent.trim();
            foundResults.push({ tabId, tabName });
        }
    });
    
    if (foundResults.length > 0) {
        // Show first result
        const firstResult = foundResults[0];
        const tabButton = document.querySelector(`[data-bs-target="#${firstResult.tabId}"]`);
        const tab = new bootstrap.Tab(tabButton);
        tab.show();
        
        toastr.success(`Found ${foundResults.length} result(s) for "${searchQuery}"`, 'Search Results');
    } else {
        toastr.info(`No results found for "${searchQuery}"`, 'Search Results');
    }
}

/**
 * Prints the current manual page or section.
 * This function would be connected to a print button.
 */
function printManualPage() {
    // Get the active tab content
    const activeTab = document.querySelector('.tab-pane.active');
    
    if (!activeTab) {
        toastr.warning('No content to print', 'Print');
        return;
    }
    
    // Create a print-friendly window
    const printWindow = window.open('', '_blank');
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>NauticalFlow User Manual - ${activeTab.id}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
            <style>
                body { padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .video-container { display: none; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>NauticalFlow User Manual</h1>
            ${activeTab.innerHTML}
            <script>window.print(); window.onafterprint = function() { window.close(); };</script>
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    toastr.success('Print dialog opened', 'Print');
}

/**
 * Downloads the user manual as a PDF.
 * In a real application, this would generate or fetch a PDF file.
 */
function downloadManualPDF() {
    toastr.info('PDF download feature coming soon!', 'Download', {
        timeOut: 3000
    });
    
    // In a real application, you would:
    // - Generate PDF on the server side
    // - Use a library like jsPDF to generate client-side
    // - Fetch a pre-generated PDF file
    // Example:
    // window.location.href = '/api/manual/download-pdf';
}

/**
 * Provides feedback on the manual page helpfulness.
 * @param {boolean} isHelpful - Whether the user found the page helpful.
 */
function submitManualFeedback(isHelpful) {
    const feedbackMessage = isHelpful 
        ? 'Thank you for your positive feedback!' 
        : 'We appreciate your feedback and will improve this section.';
    
    toastr.success(feedbackMessage, 'Feedback Received');
    
    // In a real application, you would send this to the server
    console.log('Manual feedback submitted:', { isHelpful, timestamp: new Date() });
}

// Make certain functions globally available if needed
window.searchManualContent = searchManualContent;
window.printManualPage = printManualPage;
window.downloadManualPDF = downloadManualPDF;
window.submitManualFeedback = submitManualFeedback;