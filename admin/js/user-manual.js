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
 * Opens YouTube videos in an embedded modal player.
 */
function setupVideoPlaceholders() {
    const videoContainers = document.querySelectorAll('.video-container');
    
    videoContainers.forEach(container => {
        const placeholder = container.querySelector('.video-placeholder');
        if (placeholder) {
            placeholder.addEventListener('click', () => handleVideoClick(container));
        }
    });
}

/**
 * Handles clicks on video placeholder elements.
 * Opens a modal with embedded YouTube player.
 * @param {HTMLElement} container - The video container element.
 */
function handleVideoClick(container) {
    const videoId = container.getAttribute('data-video-id');
    const videoTitle = container.querySelector('.video-title')?.textContent || 'Tutorial Video';
    
    if (!videoId) {
        toastr.error('Video ID not found', 'Error');
        console.error('Video container missing data-video-id attribute');
        return;
    }
    
    // Create and show video modal
    openVideoModal(videoId, videoTitle);
    
    // Log the video click for analytics
    console.log(`User clicked video: ${videoTitle} (ID: ${videoId})`);
}

/**
 * Creates and displays a modal with embedded YouTube video player.
 * @param {string} videoId - The YouTube video ID.
 * @param {string} videoTitle - The title of the video.
 */
function openVideoModal(videoId, videoTitle) {
    // Remove existing modal if present
    const existingModal = document.getElementById('videoModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML
    const modalHTML = `
        <div class="modal fade" id="videoModal" tabindex="-1" aria-labelledby="videoModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="videoModalLabel">
                            <i class="bi bi-play-circle me-2"></i>${videoTitle}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="ratio ratio-16x9">
                            <iframe
                                id="youtubePlayer"
                                src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
                                title="${videoTitle}"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen>
                            </iframe>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Open in YouTube
                        </a>
                        <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize and show modal
    const modalElement = document.getElementById('videoModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // Clean up: Remove iframe src when modal is closed to stop video playback
    modalElement.addEventListener('hidden.bs.modal', () => {
        const iframe = document.getElementById('youtubePlayer');
        if (iframe) {
            iframe.src = '';
        }
        // Remove modal from DOM after it's hidden
        setTimeout(() => modalElement.remove(), 300);
    });
    
    // Show success notification
    toastr.success(`Now playing: ${videoTitle}`, 'Video Player', {
        timeOut: 2000
    });
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
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.scrollTop = 0;
            }
        });
    });
}

/**
 * Sets up a scroll-to-top button for better navigation in long manual pages.
 */
function setupScrollToTop() {
    const mainContent = document.getElementById('main-content');
    
    if (!mainContent) {
        console.warn('main-content element not found, scroll-to-top button not initialized');
        return;
    }
    
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
            const tabButton = document.querySelector(`[data-bs-target="#${tabId}"]`);
            if (tabButton) {
                const tabName = tabButton.textContent.trim();
                foundResults.push({ tabId, tabName });
            }
        }
    });
    
    if (foundResults.length > 0) {
        // Show first result
        const firstResult = foundResults[0];
        const tabButton = document.querySelector(`[data-bs-target="#${firstResult.tabId}"]`);
        const tab = new bootstrap.Tab(tabButton);
        tab.show();
        
        toastr.success(`Found ${foundResults.length} result(s) for "${searchQuery}"`, 'Search Results');
        
        // Highlight search results (optional enhancement)
        highlightSearchResults(query, firstResult.tabId);
    } else {
        toastr.info(`No results found for "${searchQuery}"`, 'Search Results');
    }
}

/**
 * Highlights search results in the active tab.
 * @param {string} query - The search query.
 * @param {string} tabId - The ID of the tab to highlight in.
 */
function highlightSearchResults(query, tabId) {
    // Remove previous highlights
    document.querySelectorAll('.search-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
    });
    
    const tabPane = document.getElementById(tabId);
    if (!tabPane) return;
    
    // Simple text highlighting (can be enhanced)
    const walker = document.createTreeWalker(
        tabPane,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.toLowerCase().includes(query)) {
            textNodes.push(node);
        }
    }
    
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const index = text.toLowerCase().indexOf(query);
        if (index !== -1) {
            const beforeText = text.substring(0, index);
            const matchText = text.substring(index, index + query.length);
            const afterText = text.substring(index + query.length);
            
            const span = document.createElement('span');
            span.innerHTML = `${beforeText}<span class="search-highlight" style="background-color: yellow; padding: 2px 4px; border-radius: 3px;">${matchText}</span>${afterText}`;
            textNode.parentNode.replaceChild(span, textNode);
        }
    });
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
    
    const activeTabButton = document.querySelector('.nav-link.active');
    const tabName = activeTabButton ? activeTabButton.textContent.trim() : 'Manual Section';
    
    // Create a print-friendly window
    const printWindow = window.open('', '_blank');
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>NauticalFlow User Manual - ${tabName}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
            <style>
                body { 
                    padding: 20px; 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                }
                .video-container { 
                    display: none; 
                }
                .video-placeholder {
                    display: none;
                }
                .section-title {
                    color: #2d3748;
                    margin-bottom: 20px;
                }
                .step-card {
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .feature-card {
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .info-box {
                    margin-top: 20px;
                    page-break-inside: avoid;
                }
                @media print {
                    .no-print { 
                        display: none; 
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 30px;">
                <h1>NauticalFlow User Manual</h1>
                <h2>${tabName}</h2>
                <p style="color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            ${activeTab.innerHTML}
            <script>
                window.onload = function() {
                    window.print();
                };
                window.onafterprint = function() { 
                    window.close(); 
                };
            </script>
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
    toastr.info('Preparing PDF download...', 'Download', {
        timeOut: 3000
    });
    
    // In a real application, you would:
    // - Generate PDF on the server side
    // - Use a library like jsPDF to generate client-side
    // - Fetch a pre-generated PDF file
    // Example:
    // fetch('/api/manual/download-pdf')
    //     .then(response => response.blob())
    //     .then(blob => {
    //         const url = window.URL.createObjectURL(blob);
    //         const a = document.createElement('a');
    //         a.href = url;
    //         a.download = 'NauticalFlow-User-Manual.pdf';
    //         a.click();
    //     });
    
    console.log('PDF download requested at:', new Date().toISOString());
}

/**
 * Provides feedback on the manual page helpfulness.
 * @param {boolean} isHelpful - Whether the user found the page helpful.
 */
function submitManualFeedback(isHelpful) {
    const activeTabButton = document.querySelector('.nav-link.active');
    const tabName = activeTabButton ? activeTabButton.textContent.trim() : 'Unknown';
    
    const feedbackMessage = isHelpful 
        ? 'Thank you for your positive feedback!' 
        : 'We appreciate your feedback and will improve this section.';
    
    toastr.success(feedbackMessage, 'Feedback Received');
    
    // In a real application, you would send this to the server
    const feedbackData = {
        isHelpful,
        tabName,
        timestamp: new Date().toISOString(),
        url: window.location.href
    };
    
    console.log('Manual feedback submitted:', feedbackData);
    
    // Example API call:
    // fetch('/api/feedback/manual', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(feedbackData)
    // });
}

/**
 * Exports manual content for a specific tab to markdown format.
 * @param {string} tabId - The ID of the tab to export.
 */
function exportTabToMarkdown(tabId) {
    const tabPane = document.getElementById(tabId);
    if (!tabPane) {
        toastr.error('Tab content not found', 'Export Failed');
        return;
    }
    
    const tabButton = document.querySelector(`[data-bs-target="#${tabId}"]`);
    const tabName = tabButton ? tabButton.textContent.trim() : 'Manual Section';
    
    // Extract text content in a structured way
    let markdown = `# NauticalFlow User Manual - ${tabName}\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n---\n\n`;
    
    const sectionTitle = tabPane.querySelector('.section-title')?.textContent.trim();
    if (sectionTitle) {
        markdown += `## ${sectionTitle}\n\n`;
    }
    
    const description = tabPane.querySelector('.section-description')?.textContent.trim();
    if (description) {
        markdown += `${description}\n\n`;
    }
    
    // Add steps if present
    const steps = tabPane.querySelectorAll('.step-card');
    if (steps.length > 0) {
        markdown += `### Steps\n\n`;
        steps.forEach((step, index) => {
            const title = step.querySelector('.step-title')?.textContent.trim();
            const desc = step.querySelector('.step-description')?.textContent.trim();
            markdown += `${index + 1}. **${title}**\n   ${desc}\n\n`;
        });
    }
    
    // Download as file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NauticalFlow-${tabName.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    
    toastr.success('Markdown file downloaded', 'Export Successful');
}

/**
 * Navigates to a specific tab by ID.
 * @param {string} tabId - The ID of the tab to navigate to.
 */
function navigateToTab(tabId) {
    const tabButton = document.querySelector(`[data-bs-target="#${tabId}"]`);
    if (tabButton) {
        const tab = new bootstrap.Tab(tabButton);
        tab.show();
    } else {
        toastr.error('Tab not found', 'Navigation Error');
    }
}

// Make certain functions globally available if needed
window.searchManualContent = searchManualContent;
window.printManualPage = printManualPage;
window.downloadManualPDF = downloadManualPDF;
window.submitManualFeedback = submitManualFeedback;
window.exportTabToMarkdown = exportTabToMarkdown;
window.navigateToTab = navigateToTab;