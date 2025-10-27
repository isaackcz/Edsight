// Main dashboard functionality
document.addEventListener("DOMContentLoaded", function () {
  // Convert Font Awesome markup to Phosphor on this page
  convertIcons();

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

function setupEventListeners() {
  // Question selector change (guarded)
  const questionSelector = document.getElementById("question-selector");
  if (questionSelector) {
    questionSelector.addEventListener("change", function () {
      fetchResponseDistribution(this.value);
    });
  }
}

// Safe fetch helper that returns fallback on error or non-OK responses
async function safeFetch(url, fallback = null) {
  try {
    const res = await fetch(url, { cache: "no-store" });
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
  schools: [
    {
      name: "Green Valley High",
      region: "North",
      completion_rate: 92,
      avg_score: 88,
      status: "Completed",
    },
    {
      name: "Riverside Prep",
      region: "West",
      completion_rate: 88,
      avg_score: 84,
      status: "Completed",
    },
    {
      name: "Hilltop School",
      region: "Central",
      completion_rate: 80,
      avg_score: 79,
      status: "In Progress",
    },
  ],
  distribution: {
    labels: ["Excellent", "Good", "Average", "Poor"],
    values: [45, 30, 15, 10],
  },
};

async function fetchDashboardData() {
  try {
    // Fetch all data in parallel using safeFetch and fallbacks
    const API_BASE = "http://localhost:8000";
    const [stats, completion, timeline, schools, distribution] =
      await Promise.all([
        safeFetch(`${API_BASE}/api/dashboard/stats/`, FALLBACK.stats),
        safeFetch(
          `${API_BASE}/api/dashboard/completion_by_region/`,
          FALLBACK.completion
        ),
        safeFetch(
          `${API_BASE}/api/dashboard/forms_over_time/`,
          FALLBACK.timeline
        ),
        safeFetch(`${API_BASE}/api/dashboard/top_schools/`, FALLBACK.schools),
        safeFetch(
          `${API_BASE}/api/dashboard/response_distribution/?question=1`,
          FALLBACK.distribution
        ),
      ]);

    // Update UI with fetched or fallback data
    updateStatsCards(stats || FALLBACK.stats);
    updateCompletionChart(completion || FALLBACK.completion);
    updateTimelineChart(timeline || FALLBACK.timeline);
    updateSchoolsTable(schools || FALLBACK.schools);
    updateDistributionChart(distribution || FALLBACK.distribution);
  } catch (error) {
    // In case anything unexpected throws, use full fallback set
    console.error("Unexpected error fetching dashboard data:", error);
    updateStatsCards(FALLBACK.stats);
    updateCompletionChart(FALLBACK.completion);
    updateTimelineChart(FALLBACK.timeline);
    updateSchoolsTable(FALLBACK.schools);
    updateDistributionChart(FALLBACK.distribution);
  }
}

function updateStatsCards(data) {
  document.getElementById("total-forms").textContent =
    data.total_forms.toLocaleString();
  document.getElementById(
    "total-forms-trend"
  ).innerHTML = `<i class="ph-bold ph-arrow-${data.total_forms_trend.direction}"></i> ${data.total_forms_trend.value} from last month`;

  document.getElementById(
    "completion-rate"
  ).textContent = `${data.completion_rate}%`;
  document.getElementById(
    "completion-rate-trend"
  ).innerHTML = `<i class="ph-bold ph-arrow-${data.completion_rate_trend.direction}"></i> ${data.completion_rate_trend.value} from last month`;

  document.getElementById("avg-time").textContent = `${data.avg_time} min`;
  document.getElementById(
    "avg-time-trend"
  ).innerHTML = `<i class="ph-bold ph-arrow-${data.avg_time_trend.direction}"></i> ${data.avg_time_trend.value} from last month`;

  document.getElementById("active-schools").textContent = data.active_schools;
  document.getElementById(
    "active-schools-trend"
  ).innerHTML = `<i class="ph-bold ph-arrow-${data.active_schools_trend.direction}"></i> ${data.active_schools_trend.value} from last month`;

  // Add trend classes
  document.querySelectorAll(".card-trend").forEach((el) => {
    el.classList.remove("positive", "negative");
    const isPositive = el.querySelector(".ph-arrow-up");
    el.classList.add(isPositive ? "positive" : "negative");
  });
}

function updateSchoolsTable(schools) {
  const tableBody = document.querySelector("#schools-table tbody");
  tableBody.innerHTML = "";

  schools.forEach((school) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${school.name}</td>
      <td>${school.region}</td>
      <td>${school.completion_rate}%</td>
      <td>${school.avg_score}</td>
      <td><span class="badge ${
        school.status === "Completed" ? "success" : "warning"
      }">${school.status}</span></td>
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
