// Simple Geographic Search Implementation
// This replaces the complex geographic search logic with a clean, simple approach

// Simple search setup function
function setupSimpleSearch(type) {
    const input = document.getElementById(type);
    if (!input) return;
    
    const wrapper = input.closest('.search-input-wrapper');
    const results = wrapper.querySelector('.search-results');
    const clearBtn = wrapper.querySelector('.search-clear-btn');
    
    // Store selected values
    input._selectedValue = null;
    input._selectedText = '';
    
    // Input event handler
    input.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        if (searchTerm === '') {
            clearBtn.style.display = 'none';
            results.innerHTML = '';
            results.classList.remove('show');
            return;
        }
        
        clearBtn.style.display = 'block';
        performSimpleSearch(type, searchTerm, results);
    });
    
    // Focus event handler
    input.addEventListener('focus', function() {
        if (this.value.trim() === '') {
            showAllOptions(type, results);
        } else {
            results.classList.add('show');
            wrapper.classList.add('active');
        }
    });
    
    // Blur event handler
    input.addEventListener('blur', function() {
        setTimeout(() => {
            results.classList.remove('show');
            wrapper.classList.remove('active');
        }, 200);
    });
    
    // Clear button handler
    if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            input.value = '';
            input._selectedValue = null;
            input._selectedText = '';
            clearBtn.style.display = 'none';
            results.innerHTML = '';
            results.classList.remove('show');
            wrapper.classList.remove('active');
        });
    }
}

// Perform simple search
async function performSimpleSearch(type, searchTerm, resultsContainer) {
    try {
        resultsContainer.innerHTML = '<div class="search-loading">Loading...</div>';
        resultsContainer.classList.add('show');
        
        // Fetch data based on type
        let data = [];
        if (type === 'region') {
            data = await fetchGeographicData('regions');
        } else if (type === 'division') {
            const regionId = getSelectedValue('region');
            if (regionId) {
                data = await fetchGeographicData('divisions', regionId);
            } else {
                data = await fetchGeographicData('divisions');
            }
        } else if (type === 'district') {
            const divisionId = getSelectedValue('division');
            if (divisionId) {
                data = await fetchGeographicData('districts', divisionId);
            } else {
                data = await fetchGeographicData('districts');
            }
        } else if (type === 'school') {
            const districtId = getSelectedValue('district');
            if (districtId) {
                data = await fetchGeographicData('schools', districtId);
            } else {
                data = await fetchGeographicData('schools');
            }
        }
        
        // Filter data based on search term
        const filteredData = data.filter(item => {
            const text = type === 'school' ? item.school_name : item.name;
            return text.toLowerCase().includes(searchTerm.toLowerCase());
        });
        
        displayResults(filteredData, resultsContainer, type);
        
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div class="search-error">Error loading data</div>';
    }
}

// Show all options
async function showAllOptions(type, resultsContainer) {
    try {
        resultsContainer.innerHTML = '<div class="search-loading">Loading...</div>';
        resultsContainer.classList.add('show');
        
        let data = [];
        if (type === 'region') {
            data = await fetchGeographicData('regions');
        } else if (type === 'division') {
            const regionId = getSelectedValue('region');
            if (regionId) {
                data = await fetchGeographicData('divisions', regionId);
            } else {
                data = await fetchGeographicData('divisions');
            }
        } else if (type === 'district') {
            const divisionId = getSelectedValue('division');
            if (divisionId) {
                data = await fetchGeographicData('districts', divisionId);
            } else {
                data = await fetchGeographicData('districts');
            }
        } else if (type === 'school') {
            const districtId = getSelectedValue('district');
            if (districtId) {
                data = await fetchGeographicData('schools', districtId);
            } else {
                data = await fetchGeographicData('schools');
            }
        }
        
        displayResults(data, resultsContainer, type);
        
    } catch (error) {
        console.error('Show all options error:', error);
        resultsContainer.innerHTML = '<div class="search-error">Error loading data</div>';
    }
}

// Display search results
function displayResults(data, resultsContainer, type) {
    if (data.length === 0) {
        resultsContainer.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i><p>No results found</p></div>';
        return;
    }
    
    // Limit display to 6 items
    const displayData = data.slice(0, 6);
    
    let html = '';
    if (data.length > 6) {
        html += `<div class="search-results-header">Showing 6 of ${data.length} available ${type}s</div>`;
    }
    
    displayData.forEach(item => {
        const value = item.id;
        const text = type === 'school' ? item.school_name : item.name;
        
        html += `<div class="search-result-item" data-value="${value}">`;
        html += `<div class="result-main">${escapeHtml(text)}</div>`;
        
        // Add context if available
        if (type === 'division' && item.region_id) {
            html += `<div class="result-sub">Region ID: ${item.region_id}</div>`;
        } else if (type === 'district' && item.division_id) {
            html += `<div class="result-sub">Division ID: ${item.division_id}</div>`;
        } else if (type === 'school' && item.district_id) {
            html += `<div class="result-sub">District ID: ${item.district_id}</div>`;
        }
        
        html += '</div>';
    });
    
    resultsContainer.innerHTML = html;
    
    // Add click handlers
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            const text = this.querySelector('.result-main').textContent;
            const input = document.getElementById(type);
            
            console.log(`Selected ${type}: ${text} (${value})`);
            
            input.value = text;
            input._selectedValue = value;
            input._selectedText = text;
            
            resultsContainer.classList.remove('show');
            input.closest('.search-input-wrapper').classList.remove('active');
            
            // Enable next level if applicable
            enableNextLevel(type, value);
            
            // Show clear button
            const clearBtn = input.closest('.search-input-wrapper').querySelector('.search-clear-btn');
            if (clearBtn) {
                clearBtn.style.display = 'block';
            }
        });
    });
}

// Get selected value from input
function getSelectedValue(type) {
    const input = document.getElementById(type);
    return input ? input._selectedValue : null;
}

// Enable next level in hierarchy
function enableNextLevel(currentType, value) {
    console.log(`Enabling next level after selecting ${currentType} with value ${value}`);
    
    const hierarchy = ['region', 'division', 'district', 'school'];
    const currentIndex = hierarchy.indexOf(currentType);
    const nextIndex = currentIndex + 1;
    
    // Enable the next input in hierarchy
    if (nextIndex < hierarchy.length) {
        const nextInput = document.getElementById(hierarchy[nextIndex]);
        if (nextInput) {
            nextInput.disabled = false;
            nextInput.placeholder = `Search and select ${hierarchy[nextIndex]}...`;
            console.log(`Enabled ${hierarchy[nextIndex]} input`);
        }
    }
    
    // Clear dependent inputs (inputs that come after the next one)
    for (let i = nextIndex + 1; i < hierarchy.length; i++) {
        const input = document.getElementById(hierarchy[i]);
        if (input) {
            input.value = '';
            input._selectedValue = null;
            input._selectedText = '';
            input.disabled = true;
            
            // Clear their results and clear buttons
            const wrapper = input.closest('.search-input-wrapper');
            const results = wrapper.querySelector('.search-results');
            const clearBtn = wrapper.querySelector('.search-clear-btn');
            
            if (results) results.innerHTML = '';
            if (clearBtn) clearBtn.style.display = 'none';
            
            console.log(`Cleared and disabled ${hierarchy[i]} input`);
        }
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simple fetch function
async function fetchGeographicData(type, parentId = null) {
    const url = parentId 
        ? `/api/geographic-data/${type}/?parent_id=${parentId}`
        : `/api/geographic-data/${type}/`;
    
    console.log(`Fetching ${type} from:`, url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
        console.log(`Loaded ${data.data.length} ${type}`);
        return data.data;
    } else {
        console.error(`Error loading ${type}:`, data.error);
        return [];
    }
}

// Initialize simple geographic search
function initializeSimpleGeographicSearch() {
    console.log('Initializing simple geographic search...');
    
    // Set initial state
    setInitialInputState();
    
    setupSimpleSearch('region');
    setupSimpleSearch('division');
    setupSimpleSearch('district');
    setupSimpleSearch('school');
    
    console.log('Simple geographic search initialized');
}

// Set initial state of inputs
function setInitialInputState() {
    const regionInput = document.getElementById('region');
    const divisionInput = document.getElementById('division');
    const districtInput = document.getElementById('district');
    const schoolInput = document.getElementById('school');
    
    // Enable region input, disable others
    if (regionInput) regionInput.disabled = false;
    if (divisionInput) divisionInput.disabled = true;
    if (districtInput) districtInput.disabled = true;
    if (schoolInput) schoolInput.disabled = true;
    
    console.log('Set initial input state: region enabled, others disabled');
}
