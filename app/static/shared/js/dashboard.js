// Main dashboard functionality
document.addEventListener("DOMContentLoaded", function () {
  // Convert Font Awesome markup to Phosphor on this page
  convertIcons();

  // Only run dashboard logic if key elements exist on the page
  if (!isDashboardPage()) {
    return;
  }

  // Initialize charts with empty data
  initCharts();

  // Fetch all dashboard data
  fetchDashboardData();

  // Setup event listeners
  setupEventListeners();
});

function convertIcons() {
  const faToPh = {
    "fa-search": "ph-magnifying-glass",
    "fa-bell": "ph-bell",
    "fa-sign-out-alt": "ph-sign-out",
    "fa-calendar": "ph-calendar",
    "fa-chevron-down": "ph-caret-down",
    "fa-download": "ph-download",
    "fa-file-alt": "ph-file-text",
    "fa-arrow-up": "ph-arrow-up",
    "fa-arrow-down": "ph-arrow-down",
    "fa-check-circle": "ph-check-circle",
    "fa-clock": "ph-clock",
    "fa-users": "ph-users",
    "fa-expand": "ph-arrows-out-simple",
    "fa-filter": "ph-funnel",
    "fa-chart-line": "ph-chart-line",
    "fa-home": "ph-house",
    "fa-database": "ph-database",
    "fa-clipboard-check": "ph-clipboard-check",
    "fa-chart-pie": "ph-chart-pie",
    "fa-cog": "ph-gear",
    "fa-user": "ph-user",
    "fa-chevron-right": "ph-caret-right",
    "fa-chevron-left": "ph-caret-left",
    "fa-arrow-right": "ph-arrow-right",
    "fa-arrow-left": "ph-arrow-left",
    "fa-spinner": "ph-spinner",
    "fa-save": "ph-floppy-disk",
    "fa-trash": "ph-trash",
    "fa-list": "ph-list",
    "fa-list-alt": "ph-list-check",
    "fa-plus": "ph-plus",
    "fa-times": "ph-x",
  };

  function convertElement(el) {
    if (!el || !el.classList) return;
    
    // Skip conversion for school form tree view - it uses Font Awesome intentionally
    const treeContainer = el.closest('#treeContent, .tree-content, .tree-view-sidebar');
    if (treeContainer) return;
    
    // Skip conversion for hamburger button - it uses Font Awesome intentionally
    const hamburgerBtn = el.closest('#sidebar-toggle, .hamburger-btn, .hamburger');
    if (hamburgerBtn) return;
    
    // Skip conversion for header icons in user dashboard - it uses Font Awesome intentionally
    const headerElement = el.closest('header, .header');
    if (headerElement) return;
    
    // Skip conversion for sidebar menu items - they use Font Awesome intentionally
    const sidebarMenu = el.closest('.sidebar');
    if (sidebarMenu) return;
    
    const classes = Array.from(el.classList);
    // If already a phosphor icon, skip
    if (classes.some((c) => c.startsWith("ph-"))) return;
    let added = false;
    classes.forEach((c) => {
      if (faToPh[c]) {
        el.classList.add("ph", faToPh[c]);
        added = true;
      }
    });
    if (added) {
      // remove common FA classes but keep any other classes
      ["fa", "fas", "far", "fal", "fab"].forEach((k) => el.classList.remove(k));
      classes.forEach((c) => {
        if (c.startsWith("fa-")) el.classList.remove(c);
      });
    }
  }

  function convertAll(root = document) {
    // find elements with class names starting with fa-
    const nodes = root.querySelectorAll('[class*="fa-"]');
    nodes.forEach(convertElement);
    // also cover elements with 'fas'/'fa' etc which may not include fa- in selector
    const nodes2 = root.querySelectorAll(".fa, .fas, .far, .fal, .fab");
    nodes2.forEach(convertElement);
  }

  // Run on DOMContentLoaded and observe for future additions
  convertAll(document);
  const mo = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) convertAll(n);
        });
      }
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

function isDashboardPage() {
  return Boolean(
    document.getElementById("completionChart") ||
      document.getElementById("activity-table") ||
      document.getElementById("total-forms")
  );
}

// Global variables to store current date range
let currentDateRange = 30; // Default to 30 days
let customDateRange = { start: null, end: null }; // For custom date range
let isCustomRange = false;

function setupEventListeners() {
  if (!isDashboardPage()) return;

  // Date selector dropdown
  const dateSelector = document.getElementById('date-range-selector');
  const dateDropdown = document.getElementById('date-dropdown');
  const dateRangeText = document.getElementById('date-range-text');
  
  if (dateSelector && dateDropdown) {
    // Toggle dropdown on click
    dateSelector.addEventListener('click', function(e) {
      e.stopPropagation();
      const isVisible = dateDropdown.style.display !== 'none';
      dateDropdown.style.display = isVisible ? 'none' : 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!dateSelector.contains(e.target)) {
        dateDropdown.style.display = 'none';
      }
    });
    
    // Handle date option selection
    const dateOptions = dateDropdown.querySelectorAll('.date-option');
    dateOptions.forEach(option => {
      option.addEventListener('click', function(e) {
        e.stopPropagation();
        const isCustom = this.getAttribute('data-custom') === 'true';
        
        if (isCustom) {
          // Show custom date range picker
          dateDropdown.style.display = 'none';
          const dateRangePicker = document.getElementById('date-range-picker');
          const backdrop = document.getElementById('date-range-modal-backdrop');
          if (dateRangePicker && backdrop) {
            backdrop.style.display = 'block';
            dateRangePicker.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
            // Set default dates (last 30 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
            document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
          }
        } else {
          const days = parseInt(this.getAttribute('data-days'));
          currentDateRange = days;
          isCustomRange = false;
          customDateRange = { start: null, end: null };
          dateRangeText.textContent = this.textContent;
          dateDropdown.style.display = 'none';
          const dateRangePicker = document.getElementById('date-range-picker');
          if (dateRangePicker) {
            dateRangePicker.style.display = 'none';
          }
          
          // Reload dashboard data with new date range
          fetchDashboardData();
        }
      });
    });
  }
  
  // Custom date range picker handlers
  const applyDateRangeBtn = document.getElementById('apply-date-range');
  const cancelDateRangeBtn = document.getElementById('cancel-date-range');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const dateRangePicker = document.getElementById('date-range-picker');
  const backdrop = document.getElementById('date-range-modal-backdrop');
  
  function closeDateRangeModal() {
    if (dateRangePicker) dateRangePicker.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
  
  if (applyDateRangeBtn && startDateInput && endDateInput) {
    applyDateRangeBtn.addEventListener('click', function() {
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      
      if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
      }
      
      if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
      }
      
      isCustomRange = true;
      customDateRange = { start: startDate, end: endDate };
      dateRangeText.textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
      closeDateRangeModal();
      
      // Reload dashboard data with custom date range
      fetchDashboardData();
    });
  }
  
  if (cancelDateRangeBtn) {
    cancelDateRangeBtn.addEventListener('click', function() {
      closeDateRangeModal();
    });
  }
  
  // Close date range picker when clicking on backdrop
  if (backdrop) {
    backdrop.addEventListener('click', function() {
      closeDateRangeModal();
    });
  }
  
  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && dateRangePicker && dateRangePicker.style.display === 'block') {
      closeDateRangeModal();
    }
  });
  
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  // Export report button
  const exportBtn = document.getElementById('export-report-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      exportDashboardReport();
    });
  }
}

// Safe fetch helper that returns fallback on error or non-OK responses
async function safeFetch(url, fallback = null) {
  try {
    const res = await fetch(url, { 
      cache: "no-store",
      credentials: "include"  // Include cookies for session authentication
    });
    if (!res.ok) {
      console.warn(`Request failed (${res.status}) for ${url}`);
      return fallback;
    }
    return await res.json();
  } catch (err) {
    console.warn(`Fetch error for ${url}:`, err);
    return fallback;
  }
}

// Fallback sample data to use when API is unavailable
const FALLBACK = {
  stats: {
    total_forms: 1245,
    total_forms_trend: { direction: "up", value: "4%" },
    completion_rate: 78,
    completion_rate_trend: { direction: "up", value: "2%" },
    avg_time: 12,
    avg_time_trend: { direction: "down", value: "1%" },
    active_schools: 98,
    active_schools_trend: { direction: "up", value: "3%" },
  },
  completion: {
    regions: ["North", "South", "East", "West", "Central"],
    completion_rates: [82, 75, 68, 85, 77],
  },
  timeline: {
    dates: [
      "2025-09-12",
      "2025-09-19",
      "2025-09-26",
      "2025-10-03",
      "2025-10-10",
    ],
    counts: [120, 150, 180, 210, 240],
  },
  workflow: {
    labels: ["Draft", "Submitted", "Pending", "Approved", "Completed"],
    values: [45, 30, 15, 8, 2],
  },
  activity: [
    {
      school_name: "Sample School 1",
      status: "Submitted",
      updated_at: "2 hours ago",
      level: "District",
    },
    {
      school_name: "Sample School 2",
      status: "Approved",
      updated_at: "5 hours ago",
      level: "Division",
    },
    {
      school_name: "Sample School 3",
      status: "Pending",
      updated_at: "1 day ago",
      level: "Region",
  },
  ],
};

async function fetchDashboardData() {
  if (!isDashboardPage()) return;

  try {
    // Fetch all data in parallel using safeFetch and fallbacks
    const API_BASE = "http://localhost:8000";
    let dateRangeParam = '';
    
    if (isCustomRange && customDateRange.start && customDateRange.end) {
      dateRangeParam = `?start_date=${customDateRange.start}&end_date=${customDateRange.end}`;
    } else {
      dateRangeParam = currentDateRange > 0 ? `?days=${currentDateRange}` : '';
    }
    
    const [stats, completion, timeline, workflow, activity] =
      await Promise.all([
        safeFetch(`${API_BASE}/api/dashboard/stats/${dateRangeParam}`, FALLBACK.stats),
        safeFetch(
          `${API_BASE}/api/dashboard/completion_by_region/${dateRangeParam}`,
          FALLBACK.completion
        ),
        safeFetch(
          `${API_BASE}/api/dashboard/forms_over_time/${dateRangeParam}`,
          FALLBACK.timeline
        ),
        safeFetch(`${API_BASE}/api/dashboard/workflow_status/${dateRangeParam}`, FALLBACK.workflow),
        safeFetch(
          `${API_BASE}/api/dashboard/recent_activity/${dateRangeParam}`,
          FALLBACK.activity
        ),
      ]);

    // Update UI with fetched or fallback data
    updateStatsCards(stats || FALLBACK.stats);
    if (completion && completion.regions && completion.completion_rates) {
      updateCompletionChart(completion);
    } else {
      updateCompletionChart(FALLBACK.completion);
    }
    if (timeline && timeline.dates && timeline.counts) {
      updateTimelineChart(timeline);
    } else {
      updateTimelineChart(FALLBACK.timeline);
    }
    if (workflow && workflow.labels && workflow.values) {
      updateWorkflowChart(workflow);
    } else {
      updateWorkflowChart(FALLBACK.workflow);
    }
    updateActivityTable(activity || FALLBACK.activity);
  } catch (error) {
    // In case anything unexpected throws, use full fallback set
    console.error("Unexpected error fetching dashboard data:", error);
    updateStatsCards(FALLBACK.stats);
    updateCompletionChart(FALLBACK.completion);
    updateTimelineChart(FALLBACK.timeline);
    updateWorkflowChart(FALLBACK.workflow);
    updateActivityTable(FALLBACK.activity);
  }
}

async function exportDashboardReport() {
  try {
    const API_BASE = "http://localhost:8000";
    let dateRangeParam = '';
    
    if (isCustomRange && customDateRange.start && customDateRange.end) {
      dateRangeParam = `?start_date=${customDateRange.start}&end_date=${customDateRange.end}`;
    } else {
      dateRangeParam = currentDateRange > 0 ? `?days=${currentDateRange}` : '';
    }
    
    // Fetch all dashboard data for export
    const [stats, completion, timeline, workflow, activity] = await Promise.all([
      safeFetch(`${API_BASE}/api/dashboard/stats/${dateRangeParam}`, null),
      safeFetch(`${API_BASE}/api/dashboard/completion_by_region/${dateRangeParam}`, null),
      safeFetch(`${API_BASE}/api/dashboard/forms_over_time/${dateRangeParam}`, null),
      safeFetch(`${API_BASE}/api/dashboard/workflow_status/${dateRangeParam}`, null),
      safeFetch(`${API_BASE}/api/dashboard/recent_activity/${dateRangeParam}`, null),
    ]);
    
    // Create CSV content
    let csvContent = "Dashboard Report\n";
    csvContent += `Date Range: ${document.getElementById('date-range-text').textContent}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Stats section
    csvContent += "STATISTICS\n";
    csvContent += "Metric,Value\n";
    if (stats) {
      csvContent += `Total Forms,${stats.total_forms || 0}\n`;
      csvContent += `Completion Rate,${stats.completion_rate || 0}%\n`;
      csvContent += `Average Time,${stats.avg_time || 0} min\n`;
      csvContent += `Active Schools,${stats.active_schools || 0}\n`;
    }
    csvContent += "\n";
    
    // Completion by Region
    if (completion && completion.regions && completion.completion_rates) {
      csvContent += "COMPLETION BY REGION\n";
      csvContent += "Region,Completion Rate (%)\n";
      for (let i = 0; i < completion.regions.length; i++) {
        csvContent += `${completion.regions[i]},${completion.completion_rates[i]}\n`;
      }
      csvContent += "\n";
    }
    
    // Workflow Status
    if (workflow && workflow.labels && workflow.values) {
      csvContent += "WORKFLOW STATUS\n";
      csvContent += "Status,Count\n";
      for (let i = 0; i < workflow.labels.length; i++) {
        csvContent += `${workflow.labels[i]},${workflow.values[i]}\n`;
      }
      csvContent += "\n";
    }
    
    // Recent Activity
    if (activity && Array.isArray(activity) && activity.length > 0) {
      csvContent += "RECENT ACTIVITY\n";
      csvContent += "School,Status,Updated,Level\n";
      activity.forEach(item => {
        csvContent += `${item.school_name || ''},${item.status || ''},${item.updated_at || ''},${item.level || ''}\n`;
      });
    }
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dateRangeText = document.getElementById('date-range-text').textContent.replace(/\s+/g, '_');
    const filename = `dashboard_report_${dateRangeText}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error("Error exporting dashboard report:", error);
    alert("Failed to export report. Please try again.");
  }
}

function updateStatsCards(data) {
  // Safely update each stat card with null checks
  const totalFormsEl = document.getElementById("total-forms");
  if (totalFormsEl) {
    totalFormsEl.textContent = data.total_forms.toLocaleString();
  }
  
  const totalFormsTrendEl = document.getElementById("total-forms-trend");
  if (totalFormsTrendEl) {
    totalFormsTrendEl.innerHTML = `<i class="ph-bold ph-arrow-${data.total_forms_trend.direction}"></i> ${data.total_forms_trend.value} from last month`;
  }

  const completionRateEl = document.getElementById("completion-rate");
  if (completionRateEl) {
    completionRateEl.textContent = `${data.completion_rate}%`;
  }
  
  const completionRateTrendEl = document.getElementById("completion-rate-trend");
  if (completionRateTrendEl) {
    completionRateTrendEl.innerHTML = `<i class="ph-bold ph-arrow-${data.completion_rate_trend.direction}"></i> ${data.completion_rate_trend.value} from last month`;
  }

  const avgTimeEl = document.getElementById("avg-time");
  if (avgTimeEl) {
    avgTimeEl.textContent = `${data.avg_time} min`;
  }
  
  const avgTimeTrendEl = document.getElementById("avg-time-trend");
  if (avgTimeTrendEl) {
    avgTimeTrendEl.innerHTML = `<i class="ph-bold ph-arrow-${data.avg_time_trend.direction}"></i> ${data.avg_time_trend.value} from last month`;
  }

  const activeSchoolsEl = document.getElementById("active-schools");
  if (activeSchoolsEl) {
    activeSchoolsEl.textContent = data.active_schools;
  }
  
  const activeSchoolsTrendEl = document.getElementById("active-schools-trend");
  if (activeSchoolsTrendEl) {
    activeSchoolsTrendEl.innerHTML = `<i class="ph-bold ph-arrow-${data.active_schools_trend.direction}"></i> ${data.active_schools_trend.value} from last month`;
  }

  // Add trend classes
  document.querySelectorAll(".card-trend").forEach((el) => {
    el.classList.remove("positive", "negative");
    const isPositive = el.querySelector(".ph-arrow-up");
    el.classList.add(isPositive ? "positive" : "negative");
  });
}

function updateActivityTable(activities) {
  const tableBody = document.querySelector("#activity-table tbody");
  if (!tableBody) {
    console.warn("Skipping activity table update: table element not found");
    return;
  }
  tableBody.innerHTML = "";

  if (!activities || activities.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">No recent activity</td></tr>';
    return;
  }

  activities.forEach((activity) => {
    const row = document.createElement("tr");
    const statusClass = getStatusClass(activity.status);
    row.innerHTML = `
      <td>${activity.school_name || 'N/A'}</td>
      <td><span class="badge ${statusClass}">${activity.status || 'N/A'}</span></td>
      <td>${activity.updated_at || 'N/A'}</td>
      <td>${activity.level || 'N/A'}</td>
    `;
    tableBody.appendChild(row);
  });

  // Add row click listeners
  document.querySelectorAll(".data-table tbody tr").forEach((row) => {
    row.addEventListener("click", function () {
      document
        .querySelectorAll(".data-table tbody tr")
        .forEach((r) => r.classList.remove("active"));
      this.classList.add("active");
    });
  });
}

function getStatusClass(status) {
  if (!status) return 'default';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('approved') || statusLower.includes('completed')) {
    return 'success';
  } else if (statusLower.includes('pending') || statusLower.includes('submitted')) {
    return 'warning';
  } else if (statusLower.includes('returned')) {
    return 'danger';
  } else if (statusLower.includes('draft')) {
    return 'default';
  }
  return 'default';
}
