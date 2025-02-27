document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References ---
    const checkSitemapBtn = document.getElementById('checkSitemapBtn');
    const sitemapUrlInput = document.getElementById('sitemapUrl');
    const urlCheckMessage = document.getElementById('urlCheckMessage');
    const timePriorityFilters = document.getElementById('timePriorityFilters');
    const urlFrequencyFilters = document.getElementById('urlFrequencyFilters');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const checkBtnText = document.getElementById('checkBtnText');
    const checkBtnSpinner = document.getElementById('checkBtnSpinner');
    const applyFiltersBtnText = document.getElementById('applyFiltersBtnText');

    // Filter Input Elements
    const dateStartInput = document.querySelector('#timePriorityFilters input[type="date"]:first-of-type');
    const dateEndInput = document.querySelector('#timePriorityFilters input[type="date"]:last-of-type');
    const priorityMinInput = document.querySelector('#timePriorityFilters input[type="number"]:first-of-type');
    const priorityMaxInput = document.querySelector('#timePriorityFilters input[type="number"]:last-of-type');
    const changeFrequencySelect = document.querySelector('#urlFrequencyFilters select');
    const urlPatternInput = document.querySelector('#urlFrequencyFilters input[type="text"]');

    // Results Tab Button (for enabling/showing)
    const resultsTabButton = document.querySelector('button[data-bs-target="#results"]');

    // Modal Elements
    const taskProgressModal = new bootstrap.Modal(document.getElementById('taskProgressModal'));
    const taskProgressBar = document.getElementById('taskProgressBar');
    const taskProgressMessage = document.getElementById('taskProgressMessage');

    // Content Search Elements
    const contentSearchInput = document.querySelector('#results input[type="text"]');
    const contentSearchButton = document.querySelector('#results button.btn-primary'); // Button, not just any button
    const titleCheckbox = document.querySelector('#results .form-check:nth-child(1) input');
    const metaCheckbox = document.querySelector('#results .form-check:nth-child(2) input');
    const headingCheckbox = document.querySelector('#results .form-check:nth-child(3) input');
    const bodyCheckbox = document.querySelector('#results .form-check:nth-child(4) input');


    //Active Filter
    const activeFiltersContainer = document.querySelector('#results .bg-body.rounded.p-4.mb-4:nth-child(2) .d-flex.flex-wrap.gap-2');
    // Global variable to store the scraped data
    let scrapedData = null;

    // --- Initial State ---
    resultsTabButton.disabled = true;  // Disable results tab
    applyFiltersBtn.disabled = true;   // Disable apply filters button

      // Store active content search terms
    let activeContentSearches = [];
     // Keep track of selected URLs across all pages
    let selectedItems = new Set();

    const pageSize = 5; // Items per page.  Make this a constant.

    // --- Helper Function (to avoid repetition) ---

    function resetFilterUI() {
        urlCheckMessage.classList.remove('show');
        timePriorityFilters.classList.remove('show');
        urlFrequencyFilters.classList.remove('show');
        applyFiltersBtn.disabled = true;
    }
    // --- Event Listeners ---

    // Check Sitemap Button
    checkSitemapBtn.addEventListener('click', function() {
        const sitemapUrl = sitemapUrlInput.value;

        if (!sitemapUrl) {
            alert('Please enter a Sitemap URL.');
            return;
        }

        checkBtnText.textContent = 'Checking...';
        checkBtnSpinner.classList.remove('d-none');
        checkSitemapBtn.disabled = true;

        fetch(`/sitemaps/check_sitemap/?url=${sitemapUrl}`) //Corrected URL
            .then(response => response.json())
            .then(data => {
                checkBtnText.textContent = 'Check';
                checkBtnSpinner.classList.add('d-none');
                checkSitemapBtn.disabled = false;

                if (data.is_valid_sitemap) {
                    urlCheckMessage.classList.add('show');
                    timePriorityFilters.classList.add('show');
                    urlFrequencyFilters.classList.add('show');
                    applyFiltersBtn.disabled = false;
                } else {
                    resetFilterUI();
                    alert('Invalid Sitemap URL.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while validating the Sitemap URL.');
                checkBtnText.textContent = 'Check';
                checkBtnSpinner.classList.add('d-none');
                checkSitemapBtn.disabled = false;
                resetFilterUI();
            });
    });

    // Sitemap URL Input (Hide filters on change)
    sitemapUrlInput.addEventListener('input', resetFilterUI);


    // Apply Filters Buttos
    applyFiltersBtn.addEventListener('click', function(event) {
        event.preventDefault();

        const sitemapUrl = sitemapUrlInput.value;
        const startDate = dateStartInput.value;
        const endDate = dateEndInput.value;
        const priorityMin = parseFloat(priorityMinInput.value);
        const priorityMax = parseFloat(priorityMaxInput.value);
        const changeFrequency = changeFrequencySelect.value;
        const urlPattern = urlPatternInput.value.split(/[\s,]+/).filter(Boolean);

        const payload = {
            url: sitemapUrl,
            start_date:startDate,  // Use actual values now
            end_date:endDate,  // Use actual values now",
            priority_range: {
                min: priorityMin,
                max: priorityMax
            },
            changefreq: changeFrequency ? [changeFrequency] : [],
            url_pattern: urlPattern
        };


        applyFiltersBtnText.innerHTML = 'Processing...'; // Use innerHTML
        document.getElementById('applyFiltersBtnSpinner').classList.remove('d-none');
        applyFiltersBtn.disabled = true;
        fetch('/sitemaps/scrape_sitemaps/', {  // Corrected URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // REMOVED: 'X-CSRFToken': getCookie('csrftoken')  <-- NO CSRF
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            applyFiltersBtnText.innerHTML = '<i class="bi bi-funnel"></i> Apply Filters';
            document.getElementById('applyFiltersBtnSpinner').classList.add('d-none');
            applyFiltersBtn.disabled = false;

            if (data.error) {
                alert('Error from backend: ' + data.error);
            } else {
                taskProgressModal.show();
                connectWebSocket(data.task_id);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while sending data.');
            applyFiltersBtnText.innerHTML = '<i class="bi bi-funnel"></i> Apply Filters';
            document.getElementById('applyFiltersBtnSpinner').classList.add('d-none');
            applyFiltersBtn.disabled = false;
        });
    });


    // --- WebSocket Connection ---
    function connectWebSocket(taskId) {
        const websocketUrl = `ws://127.0.0.1:8000/ws/task-progress/${taskId}`; // Correct URL
        const websocket = new WebSocket(websocketUrl);

        websocket.onopen = function() {
            console.log('WebSocket connection established.');
            taskProgressMessage.textContent = "Fecthing URLs...";
        };

        websocket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            const messageType = data.task;
            const messageData = data.data;


            if (messageType === 'scraper') { // Corrected message type check
                if (data.type === "init") {
                    const totalUrls = data.total_urls || 0;
                    const filteredUrls = data.filtered_urls || 0;
                    taskProgressMessage.textContent = `Fetching URLs... Found ${totalUrls} total URLs. ${filteredUrls} URLs will be processed.`;
                    updateTotalAndFilteredUrls(totalUrls, filteredUrls); // Update UI
                } else if (data.type  === "done") {
                    scrapedData = messageData;  // Store the data
                    taskProgressBar.style.width = '100%';
                    taskProgressBar.setAttribute('aria-valuenow', 100);
                    taskProgressMessage.textContent = 'URLs fetched successfully.';
                    if(resultsTabButton){
                        resultsTabButton.disabled = false;
                        const tab = new bootstrap.Tab(resultsTabButton);
                        tab.show();
                    }


                    setTimeout(() => {
                        taskProgressModal.hide();
                        websocket.close();
                    }, 2000);
                    //Gets current filter to display on the filter active section
                    const currentFilters = getCurrentFilters();
                    currentFilters.content_search = activeContentSearches; // Add content searches
                    displayActiveFilters(currentFilters);
                    // Display initial page and create pagination:
                    displayScrapedData(scrapedData, 1, pageSize);


                } else {
                    // Handle progress updates
                    const progress = data.progress || 0;
                    const message = data.message || '';
                    taskProgressBar.style.width = `${progress}%`;
                    taskProgressBar.setAttribute('aria-valuenow', progress);
                    taskProgressMessage.textContent = message;
                }
            }
              else {
                console.warn('Unexpected message type:', messageType);
            }

        };

        websocket.onerror = function(e) {
            console.error('WebSocket error:', e);
            taskProgressMessage.textContent = 'WebSocket error occurred.';
        };

        websocket.onclose = function(e) {
            console.log('WebSocket connection closed:', e);
            taskProgressMessage.textContent = e.wasClean ? 'WebSocket connection closed.' : 'WebSocket connection closed unexpectedly.';
        };
    }


    // --- Helper Functions ---
    function updateTotalAndFilteredUrls(totalUrls, filteredUrls) {
        document.getElementById("totalUrls").textContent = totalUrls;
        document.getElementById("filteredUrls").textContent = filteredUrls;
    }

    function displayScrapedData(data, page = 1, pageSize = 5) {
        const resultsList = document.getElementById('scrapedResultsList');
        resultsList.innerHTML = ''; // Clear existing

        if (!data || !data.results || data.results.length === 0) {
            resultsList.innerHTML = '<div class="list-group-item">No data to display.</div>';
            updateSelectedCount(); // Update count even with no data
            addPagination(0, 1, pageSize); // Show empty pagination
            return;
        }

        // Calculate pagination boundaries
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, data.stats.filtered);
        const pageData = data.results.slice(startIndex, endIndex);

        // Update "Showing X-Y of Z items" text
        const showingText = document.getElementById('showingItemsText');
        if(showingText){
            showingText.textContent = `Showing ${startIndex + 1}-${endIndex} of ${data.stats.filtered} items`;
        }

        //Update the average priority.
        document.getElementById("avgPriority").textContent = data.stats.avg_priority;


        pageData.forEach(item => {
            const listItem = document.createElement('div');
            listItem.classList.add('list-group-item');
            const isChecked = selectedItems.has(item.url); // Check if URL is in the Set
            const checkedAttribute = isChecked ? 'checked' : '';


            listItem.innerHTML = `
                <div class="row align-items-center g-3">
                    <div class="col-auto">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" data-url="${item.url}" ${checkedAttribute}>
                        </div>
                    </div>
                    <div class="col">
                        <h5 class="mb-1">${item.content.title || 'N/A'}</h5>
                        <p class="text-muted small mb-1">
                            <i class="bi bi-link"></i> ${item.url}
                        </p>
                        <div class="d-flex flex-wrap gap-2">
                            ${item.date ? `<span class="badge bg-secondary"><i class="bi bi-calendar"></i> ${item.date}</span>` : ''}
                            ${item.priority ? `<span class="badge bg-primary"><i class="bi bi-star"></i> ${item.priority}</span>` : ''}
                            ${item.changefreq ? `<span class="badge bg-info"><i class="bi bi-arrow-repeat"></i> ${item.changefreq}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
            resultsList.appendChild(listItem);
        });

        updateSelectedCount(); // Update "Selected" count AFTER displaying data
        addPagination(data.stats.filtered, page, pageSize);
    }
    //Function to create pagination
    function addPagination(totalItems, currentPage = 1, pageSize = 5){
        const paginationContainer = document.querySelector('.pagination');
        paginationContainer.innerHTML = ''; // Clear

        if (totalItems <= pageSize) {
            return; // Not needed
        }

        const totalPages = Math.ceil(totalItems / pageSize);

        // Previous Button
        const prevButton = document.createElement('li');
        prevButton.classList.add('page-item');
        if (currentPage === 1) {
            prevButton.classList.add('disabled');
        }
        prevButton.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>`;
        paginationContainer.appendChild(prevButton);

        // Page Number Buttons
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('li');
            pageButton.classList.add('page-item');
            if (i === currentPage) {
                pageButton.classList.add('active');
            }
            pageButton.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
            paginationContainer.appendChild(pageButton);
        }

        // Next Button
        const nextButton = document.createElement('li');
        nextButton.classList.add('page-item');
        if (currentPage === totalPages) {
            nextButton.classList.add('disabled');
        }
        nextButton.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>`;
        paginationContainer.appendChild(nextButton);

        // Event listener for pagination clicks
        paginationContainer.addEventListener('click', function(event) {
            event.preventDefault();
            if (event.target.classList.contains('page-link')) {
                const clickedPage = parseInt(event.target.dataset.page, 10);
                 if (!isNaN(clickedPage)) { //Don't check for current page
                    refilterData(clickedPage); // Re-filter and display the new page
                }
            }
        });
    }

       // Content Search Functionality
       contentSearchButton.addEventListener('click', function() {
        if (!scrapedData) {
            return; // No data to search
        }
        applyContentSearch(); // Call the applyContentSearch function
    });


    function calculateAvgPriority(filteredResults) {
        if (!filteredResults || filteredResults.length === 0) {
            return 0;
        }

        let totalPriority = 0;
        let priorityCount = 0;

        for (const result of filteredResults) {
            if (result.priority !== null && result.priority !== undefined) {
                totalPriority += result.priority;
                priorityCount++;
            }
        }

        if (priorityCount === 0) {
            return 0;
        }

        return (totalPriority / priorityCount).toFixed(2); //Keep two decimals
    }


    function displayActiveFilters(filters) {
       activeFiltersContainer.innerHTML = ''; // Clear existing

        if (!filters) {
          return; // No filters to display
         }

        // Date Range Filter
        if (filters.date_range && filters.date_range.start && filters.date_range.end) {
            const dateBadge = createFilterBadge('calendar', `${filters.date_range.start} to ${filters.date_range.end}`, 'secondary', false);
            activeFiltersContainer.appendChild(dateBadge);
        }

        // Priority Range Filter
        if (filters.priority_range && (filters.priority_range.min !== undefined || filters.priority_range.max !== undefined)) {
            const priorityBadge = createFilterBadge('star', `Priority: ${filters.priority_range.min || 0} - ${filters.priority_range.max || 1}`, 'primary', false);
            activeFiltersContainer.appendChild(priorityBadge);
        }

        // Change Frequency Filter
        if (filters.changefreq && filters.changefreq.length > 0) {
            filters.changefreq.forEach(freq => {
                const freqBadge = createFilterBadge('arrow-repeat', freq, 'info', false);
                activeFiltersContainer.appendChild(freqBadge);
            });
        }

        // URL Pattern Filter
        if (filters.url_pattern && filters.url_pattern.length > 0) {
            filters.url_pattern.forEach(pattern => {
                const urlBadge = createFilterBadge('link', `Pattern: ${pattern}`, 'secondary', false);
                activeFiltersContainer.appendChild(urlBadge);
            });
        }
        // Content Search Filters (plural)
        if (filters.content_search && filters.content_search.length > 0) {
            filters.content_search.forEach(term => {
                const contentFilterText = `Content: "${term}" (${getContentFilterTypes()})`;
                const contentBadge = createFilterBadge('search', contentFilterText, 'secondary', true); // Removable
                activeFiltersContainer.appendChild(contentBadge);
            });
        }

          // Add event listener for removing *content search* filter.  This is outside the loop.
        activeFiltersContainer.addEventListener('click', function(event) {
            if (event.target.classList.contains('btn-close')) {
                const badge = event.target.closest('.badge');
                 if (badge && badge.querySelector('[data-filter-type="search"]')) {
                    removeFilter(badge);
                }
            }
        });
    }
     function createContentFilter() {
        // No clearing of existing badges.

        const searchTerm = contentSearchInput.value.trim().toLowerCase(); // Get and trim
        if (!searchTerm) {
            return; // Don't add empty searches
        }
        // No need to get checked state *here* - we'll use a helper function

        if (!activeContentSearches.includes(searchTerm)) { // Prevent duplicates
            activeContentSearches.push(searchTerm);
        }

        // No direct badge creation here - let displayActiveFilters handle it
    }

     // Helper function to get a string of checked content types
    function getContentFilterTypes() {
        const activeFilters = [];
        if (titleCheckbox.checked) activeFilters.push("Title");
        if (metaCheckbox.checked) activeFilters.push("Meta");
        if (headingCheckbox.checked) activeFilters.push("H1-5");
        if (bodyCheckbox.checked) activeFilters.push("Body");
        return activeFilters.join(', ');
    }

    // Helper function to create filter badges.  Now includes `removable` argument.
    function createFilterBadge(iconName, text, bgColor, removable = false) {
        const badge = document.createElement('div');
        badge.classList.add('badge', `bg-${bgColor}`, 'd-flex', 'align-items-center');
        let badgeContent = `<i class="bi bi-${iconName} me-2"></i><span class="me-2">${text}</span>`;
        if (removable) {
            // Add data-term for content search removal
            badgeContent += `<button type="button" class="btn-close btn-close-white" data-filter-type="${iconName}"></button>`;
        }
        badge.innerHTML = badgeContent;
        return badge;
    }

     function applyContentSearch() {
        if (!scrapedData) {
            return; // No data to search.  Shouldn't happen, but good to check.
        }

        const searchTerm = contentSearchInput.value.trim().toLowerCase(); //Get the term
        if (searchTerm) { // Only add if not empty
            activeContentSearches.push(searchTerm); // Add to the array
            contentSearchInput.value = ''; // Clear the input
            createContentFilter(); // Create/update the badges
            refilterData();  // Re-filter and show
        }

    }

    function removeFilter(badgeElement) {
      const filterType = badgeElement.querySelector('.btn-close').dataset.filterType;
        if (filterType === 'search') {
            // Get the search term from the badge text.  More robust than relying on input field.
            const searchTerm = badgeElement.querySelector('span').textContent.match(/"([^"]+)"/)[1]; // Extract term

            // Remove the term from the activeContentSearches array
             activeContentSearches = activeContentSearches.filter(term => term !== searchTerm);

            //Remove the badge
              badgeElement.remove();

            refilterData(); // Re-filter after any change

        }
    }
    function refilterData(page = 1) {
        if (!scrapedData) return;

        let filteredResults = scrapedData.results;

        // --- 1. Apply Main Filters ---
        const startDate = dateStartInput.value;
        const endDate = dateEndInput.value;
        const priorityMin = parseFloat(priorityMinInput.value);
        const priorityMax = parseFloat(priorityMaxInput.value);
        const changeFrequency = changeFrequencySelect.value;
        const urlPattern = urlPatternInput.value.split(/[\s,]+/).filter(Boolean);;

        filteredResults = filteredResults.filter(item => {
            if (startDate && endDate && item.date) {
                const itemDate = new Date(item.date);
                    if (itemDate < new Date(startDate) || itemDate > new Date(endDate)) return false;
            }
            if (!isNaN(priorityMin) && item.priority < priorityMin) return false;
            if (!isNaN(priorityMax) && item.priority > priorityMax) return false;
            if (changeFrequency && item.changefreq !== changeFrequency) return false;
            if (urlPattern.length > 0 && !urlPattern.some(pattern => item.url.includes(pattern))) return false;
            return true;
        });

        // --- 2. Apply Content Search Filters (Plural) ---
        const searchTitle = titleCheckbox.checked;
        const searchMeta = metaCheckbox.checked;
        const searchHeading = headingCheckbox.checked;
        const searchBody = bodyCheckbox.checked;

        if (activeContentSearches.length > 0) {
            filteredResults = filteredResults.filter(item => {
                return activeContentSearches.some(searchTerm => {
                    if (searchTitle && item.content.title && item.content.title.toLowerCase().includes(searchTerm)) return true;
                    if (searchMeta && item.content.meta_description && item.content.meta_description.toLowerCase().includes(searchTerm)) return true;
                    if (searchHeading && item.content.heading && item.content.heading.toLowerCase().includes(searchTerm)) return true;
                    if (searchBody && item.content.body && item.content.body.toLowerCase().includes(searchTerm)) return true;
                    return false;
                });
            });
        }

        // --- 3. Update Selected Items based on filtered results ---
        const filteredUrls = filteredResults.map(item => item.url); // Get URLs of filtered results
        const newSelectedItems = new Set(); // Create a new Set to hold only selected URLs that are in the filtered results
        selectedItems.forEach(selectedUrl => {
            if (filteredUrls.includes(selectedUrl)) {
                newSelectedItems.add(selectedUrl); // Add URLs that are still in filtered results and were previously selected
            }
        });
        selectedItems = newSelectedItems; // Replace the old selectedItems with the new filtered set


        // --- 4. Update Display ---
        const currentFilters = getCurrentFilters();
        currentFilters.content_search = activeContentSearches;
        displayActiveFilters(currentFilters);

        displayScrapedData({
            results: filteredResults,
            stats: {
                avg_priority: calculateAvgPriority(filteredResults),
                filtered: filteredResults.length, // Corrected: Use filteredResults.length
                selected: selectedItems.size // Corrected: Use selectedItems.size
            },
            filters: currentFilters
        }, page, pageSize); // Pass page number and pageSize
    }
    // Helper to create filter object, to update filters after new scrape.
    function getCurrentFilters(){
          const startDate = dateStartInput.value;
          const endDate = dateEndInput.value;
          const priorityMin = parseFloat(priorityMinInput.value);
          const priorityMax = parseFloat(priorityMaxInput.value);
          const changeFrequency = changeFrequencySelect.value;
          const urlPattern = urlPatternInput.value;

        const currentFilters = {
            url: sitemapUrlInput.value, // Always include the URL
            date_range: { start: startDate, end: endDate },
            priority_range: { min: priorityMin, max: priorityMax },
            changefreq: changeFrequency ? [changeFrequency] : [],
            url_pattern: urlPattern ? [urlPattern] : []  // Use actual value

        }
        return currentFilters;
    }

    //Process Selected Handler
    addProcessSelectedHandler(); // Call it ONCE here, after DOMContentLoaded

    function addProcessSelectedHandler() {
        const processSelectedBtn = document.getElementById('processSelectedBtn');

        if (!processSelectedBtn) {
            console.error("Process Selected button not found!");
            return;
        }

        processSelectedBtn.addEventListener('click', function() {
            console.log("Process Selected button clicked!"); // Debugging line
            // Use selectedItems Set directly - it contains URLs from all pages
            const selectedUrls = Array.from(selectedItems); // Convert Set to Array for easier use

            if (selectedUrls.length === 0) {
                alert('Please select at least one URL to process.');
                return; // Exit if nothing is selected
            }

            // Get the *full* data for the selected URLs by filtering scrapedData.results
            const selectedData = scrapedData.results.filter(item => selectedUrls.includes(item.url));

            // --- Generate Text File Content ---
            let textFileContent = "";
            selectedData.forEach(entry => {
                let combined_content = entry.content.body || 'N/A'; // Default body to 'N/A' if missing

                let content_to_save = `Title: ${entry.content.title || 'N/A'}\n`;
                content_to_save += `URL: ${entry.url || 'N/A'}\n`;
                content_to_save += `Last Modified: ${entry.date || 'N/A'}\n`;
                content_to_save += `Priority: ${entry.priority || 'N/A'}\n`;
                content_to_save += `Change Frequency: ${entry.changefreq || 'N/A'}\n`;
                content_to_save += "\n--- CONTENT ---\n\n";
                content_to_save += combined_content + "\n\n"; // Add extra newline for separation

                textFileContent += content_to_save; // Append to the main content
            });

            // --- Trigger File Download ---
            const blob = new Blob([textFileContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = 'selected_sitemap_data.txt'; // Suggest filename
            document.body.appendChild(downloadLink); // Append to the document
            downloadLink.click(); // Programmatically click the link
            document.body.removeChild(downloadLink); // Remove from the document
            URL.revokeObjectURL(url); // Clean up URL


        });
    }
      // --- Add Select All Functionality ---
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const allCheckboxes = document.querySelectorAll('#scrapedResultsList .form-check-input');
            const isChecked = this.checked;
            const results = scrapedData.results; //get all result

            allCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });

             if (results && isChecked) {
                results.forEach(item => selectedItems.add(item.url)); // Add *all* URLs to Set
            } else {
                 selectedItems.clear(); // Clear ALL selected items if unchecking "Select All"
            }
            updateSelectedCount();
            // Update label based on checkbox state
            document.querySelector('label[for="selectAll"]').textContent = isChecked ? 'Unselect All' : 'Select All';
        });


        // Listen for changes on individual checkboxes (Event Delegation)
        document.querySelector('#scrapedResultsList').addEventListener('change', function(event) {
            if (event.target.classList.contains('form-check-input')) {
                const url = event.target.dataset.url;
                if (event.target.checked) {
                    selectedItems.add(url);
                } else {
                    selectedItems.delete(url);
                }
                updateSelectedCount();

                // Update "Select All" checkbox state - only when individual checkboxes change
                const allCheckboxes = document.querySelectorAll('#scrapedResultsList .form-check-input');
                const allChecked = Array.from(allCheckboxes).every(checkbox => checkbox.checked);
                selectAllCheckbox.checked = allChecked;
                 document.querySelector('label[for="selectAll"]').textContent = allChecked  ? 'Unselect All' : 'Select All';
            }
        });


    } else {
        console.error("Select All checkbox not found!");
    }

    // --- Update Selected Count ---
    function updateSelectedCount() {
        const selectedCountElement = document.getElementById("selectedUrls");
        if (selectedCountElement) {
            selectedCountElement.textContent = selectedItems.size; // Correctly use selectedItems.size
        }
    }
});