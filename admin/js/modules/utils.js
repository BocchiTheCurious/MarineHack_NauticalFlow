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

/**
 * Initializes pagination for a table
 * @param {string} tableId - The ID of the table element
 * @param {Array} data - The full dataset to paginate
 * @param {Function} renderFunction - Function to render table rows (receives array of items)
 * @param {Object} options - Pagination options
 * @returns {Object} - Pagination controller object
 */
export function initializePagination(tableId, data, renderFunction, options = {}) {
    const defaults = {
        itemsPerPage: 10,
        containerClass: 'pagination-container',
        showEntriesSelector: true,
        entriesOptions: [10, 25, 50, 100],
        showInfo: true,
        scrollToTop: true
    };
    
    const config = { ...defaults, ...options };
    
    let currentPage = 1;
    let itemsPerPage = config.itemsPerPage;
    let currentData = [...data];
    
    // Create pagination container if it doesn't exist
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found`);
        return null;
    }
    
    let paginationContainer = table.closest('.card-body')?.querySelector(`.${config.containerClass}`);
    
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.className = config.containerClass;
        table.closest('.card-body')?.appendChild(paginationContainer);
    }
    
    // Render pagination controls
    function renderPaginationControls() {
        const totalPages = Math.ceil(currentData.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, currentData.length);
        
        let html = '<div class="d-flex justify-content-between align-items-center flex-wrap mt-3">';
        
        // Left side: Show entries selector and info
        html += '<div class="d-flex align-items-center gap-3">';
        
        if (config.showEntriesSelector) {
            html += `
                <div class="d-flex align-items-center gap-2">
                    <label class="mb-0 text-muted small">Show</label>
                    <select class="form-select form-select-sm entries-selector" style="width: auto;">
                        ${config.entriesOptions.map(option => 
                            `<option value="${option}" ${option === itemsPerPage ? 'selected' : ''}>${option}</option>`
                        ).join('')}
                    </select>
                    <label class="mb-0 text-muted small">entries</label>
                </div>
            `;
        }
        
        if (config.showInfo) {
            html += `
                <div class="text-muted small">
                    Showing ${currentData.length === 0 ? 0 : startIndex + 1} to ${endIndex} of ${currentData.length} entries
                </div>
            `;
        }
        
        html += '</div>';
        
        // Right side: Pagination buttons
        html += '<nav aria-label="Table pagination"><ul class="pagination pagination-sm mb-0">';
        
        // Previous button
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link pagination-prev" href="#" tabindex="${currentPage === 1 ? '-1' : '0'}">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page
        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link pagination-page" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        // Visible pages
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link pagination-page" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            html += `<li class="page-item"><a class="page-link pagination-page" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }
        
        // Next button
        html += `
            <li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
                <a class="page-link pagination-next" href="#" tabindex="${currentPage === totalPages ? '-1' : '0'}">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;
        
        html += '</ul></nav></div>';
        
        paginationContainer.innerHTML = html;
        
        // Attach event listeners
        attachPaginationEvents();
    }
    
    // Attach event listeners to pagination controls
    function attachPaginationEvents() {
        // Entries selector
        const entriesSelector = paginationContainer.querySelector('.entries-selector');
        if (entriesSelector) {
            entriesSelector.addEventListener('change', (e) => {
                itemsPerPage = parseInt(e.target.value);
                currentPage = 1;
                render();
            });
        }
        
        // Previous button
        const prevButton = paginationContainer.querySelector('.pagination-prev');
        if (prevButton) {
            prevButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentPage > 1) {
                    currentPage--;
                    render();
                }
            });
        }
        
        // Next button
        const nextButton = paginationContainer.querySelector('.pagination-next');
        if (nextButton) {
            nextButton.addEventListener('click', (e) => {
                e.preventDefault();
                const totalPages = Math.ceil(currentData.length / itemsPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    render();
                }
            });
        }
        
        // Page number buttons
        const pageButtons = paginationContainer.querySelectorAll('.pagination-page');
        pageButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page);
                if (page !== currentPage) {
                    currentPage = page;
                    render();
                }
            });
        });
    }
    
    // Render current page
    function render() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = currentData.slice(startIndex, endIndex);
        
        renderFunction(pageData);
        renderPaginationControls();
        
        // Scroll to top of table if enabled
        if (config.scrollToTop) {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    // Public API
    return {
        render: render,
        setData: function(newData) {
            currentData = [...newData];
            currentPage = 1;
            render();
        },
        getCurrentPage: function() {
            return currentPage;
        },
        setPage: function(page) {
            const totalPages = Math.ceil(currentData.length / itemsPerPage);
            if (page >= 1 && page <= totalPages) {
                currentPage = page;
                render();
            }
        },
        refresh: function() {
            render();
        },
        getData: function() {
            return currentData;
        },
        getItemsPerPage: function() {
            return itemsPerPage;
        }
    };
}

/**
 * Makes a table body scrollable with fixed header
 * @param {string} tableId - The ID of the table element
 * @param {number} maxHeight - Maximum height in pixels (default: 500)
 */
export function makeTableScrollable(tableId, maxHeight = 500) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found`);
        return;
    }
    
    // Check if already wrapped
    if (table.parentElement.classList.contains('table-scroll-wrapper')) {
        return;
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll-wrapper';
    wrapper.style.maxHeight = `${maxHeight}px`;
    wrapper.style.overflowY = 'auto';
    wrapper.style.overflowX = 'auto';
    wrapper.style.position = 'relative';
    
    // Wrap the table
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    
    // Make table head sticky
    const thead = table.querySelector('thead');
    if (thead) {
        thead.style.position = 'sticky';
        thead.style.top = '0';
        thead.style.zIndex = '10';
        thead.style.backgroundColor = '#fff';
    }
}

/**
 * Initializes a search functionality for tables with pagination support
 * @param {string} inputId - The ID of the search input element
 * @param {Array} dataset - The full dataset to search through
 * @param {Array} searchFields - Array of field names to search in (e.g., ['name', 'country'])
 * @param {Function} renderCallback - Function to call with filtered results
 * @param {Object} options - Search options
 * @returns {Object} - Search controller object
 */
export function initializeTableSearch(inputId, dataset, searchFields, renderCallback, options = {}) {
    const defaults = {
        debounceDelay: 300,
        caseSensitive: false,
        minCharacters: 0,
        placeholder: 'Search...',
        showResultCount: true,
        onSearch: null // Callback when search is performed
    };
    
    const config = { ...defaults, ...options };
    
    const searchInput = document.getElementById(inputId);
    if (!searchInput) {
        console.error(`Search input with ID "${inputId}" not found`);
        return null;
    }
    
    // Set placeholder if provided
    if (config.placeholder) {
        searchInput.placeholder = config.placeholder;
    }
    
    let currentDataset = [...dataset];
    let debounceTimer = null;
    let resultCountElement = null;
    
    // Create result count display if enabled
    if (config.showResultCount) {
        resultCountElement = document.createElement('small');
        resultCountElement.className = 'text-muted ms-2 search-result-count';
        resultCountElement.style.display = 'none';
        searchInput.parentElement.appendChild(resultCountElement);
    }
    
    // Search function
    function performSearch(searchTerm) {
        // Clear previous timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        // Debounce the search
        debounceTimer = setTimeout(() => {
            if (!searchTerm || searchTerm.length < config.minCharacters) {
                // Show all data if search is empty or below min characters
                renderCallback(currentDataset);
                hideResultCount();
                if (config.onSearch) {
                    config.onSearch(currentDataset, searchTerm);
                }
                return;
            }
            
            const searchTermProcessed = config.caseSensitive ? searchTerm : searchTerm.toLowerCase();
            
            // Filter dataset
            const filteredData = currentDataset.filter(item => {
                return searchFields.some(field => {
                    const fieldValue = getNestedValue(item, field);
                    if (fieldValue === null || fieldValue === undefined) return false;
                    
                    const valueString = String(fieldValue);
                    const valueProcessed = config.caseSensitive ? valueString : valueString.toLowerCase();
                    
                    return valueProcessed.includes(searchTermProcessed);
                });
            });
            
            // Render filtered results
            renderCallback(filteredData);
            
            // Update result count
            if (config.showResultCount) {
                showResultCount(filteredData.length, currentDataset.length);
            }
            
            // Call custom callback if provided
            if (config.onSearch) {
                config.onSearch(filteredData, searchTerm);
            }
            
        }, config.debounceDelay);
    }
    
    // Helper to get nested object values (e.g., 'facilities.potableWater')
    function getNestedValue(obj, path) {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }
    
    // Show result count
    function showResultCount(filtered, total) {
        if (resultCountElement) {
            resultCountElement.textContent = `Found ${filtered} of ${total} results`;
            resultCountElement.style.display = 'inline';
        }
    }
    
    // Hide result count
    function hideResultCount() {
        if (resultCountElement) {
            resultCountElement.style.display = 'none';
        }
    }
    
    // Attach event listener
    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value.trim());
    });
    
    // Clear search function
    function clearSearch() {
        searchInput.value = '';
        renderCallback(currentDataset);
        hideResultCount();
    }
    
    // Public API
    return {
        performSearch: (term) => performSearch(term),
        clearSearch: clearSearch,
        setDataset: function(newDataset) {
            currentDataset = [...newDataset];
            // Re-run search if there's an active search term
            const currentSearchTerm = searchInput.value.trim();
            if (currentSearchTerm) {
                performSearch(currentSearchTerm);
            } else {
                renderCallback(currentDataset);
                hideResultCount();
            }
        },
        getSearchTerm: function() {
            return searchInput.value.trim();
        },
        getFilteredData: function() {
            const searchTerm = searchInput.value.trim();
            if (!searchTerm) return currentDataset;
            
            const searchTermProcessed = config.caseSensitive ? searchTerm : searchTerm.toLowerCase();
            return currentDataset.filter(item => {
                return searchFields.some(field => {
                    const fieldValue = getNestedValue(item, field);
                    if (fieldValue === null || fieldValue === undefined) return false;
                    const valueString = String(fieldValue);
                    const valueProcessed = config.caseSensitive ? valueString : valueString.toLowerCase();
                    return valueProcessed.includes(searchTermProcessed);
                });
            });
        }
    };
}

/**
 * Adds a clear button to a search input
 * @param {string} inputId - The ID of the search input element
 * @param {Function} onClear - Callback function when clear is clicked
 */
export function addSearchClearButton(inputId, onClear) {
    const searchInput = document.getElementById(inputId);
    if (!searchInput) {
        console.error(`Search input with ID "${inputId}" not found`);
        return;
    }
    
    // Check if clear button already exists
    if (searchInput.parentElement.querySelector('.search-clear-btn')) {
        return;
    }
    
    // Make input parent position relative
    const parent = searchInput.parentElement;
    if (parent.style.position !== 'relative') {
        parent.style.position = 'relative';
    }
    
    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'search-clear-btn';
    clearBtn.innerHTML = '<i class="bi bi-x-circle-fill"></i>';
    clearBtn.style.cssText = `
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: #6c757d;
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        display: none;
        z-index: 10;
    `;
    
    parent.appendChild(clearBtn);
    
    // Show/hide clear button based on input value
    function toggleClearButton() {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
    }
    
    // Event listeners
    searchInput.addEventListener('input', toggleClearButton);
    
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        toggleClearButton();
        searchInput.focus();
        if (onClear) {
            onClear();
        }
    });
    
    // Initial check
    toggleClearButton();
}