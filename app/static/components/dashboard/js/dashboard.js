// Global chart instances
let completionChart, timelineChart, distributionChart;

// Initialize charts and fetch data
document.addEventListener("DOMContentLoaded", function () {
  // Initialize charts with empty data
  initCharts();

  // Fetch all dashboard data
  fetchDashboardData();

  // Setup event listeners
  setupEventListeners();
});

function initCharts() {
  // Completion Rate by Region Chart
  const completionCtx = document
    .getElementById("completionChart")
    .getContext("2d");
  completionChart = new Chart(completionCtx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Completion Rate (%)",
          data: [],
          backgroundColor: "#abc7d6",
          borderColor: "#e0ebf6",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: getBarChartOptions("Completion Rate (%)"),
  });

  // Forms Completed Over Time Chart
  const timelineCtx = document.getElementById("timelineChart").getContext("2d");
  timelineChart = new Chart(timelineCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Forms Completed",
          data: [],
          fill: true,
          backgroundColor: "rgba(171, 199, 214, 0.2)",
          borderColor: "#293440",
          borderWidth: 3,
          tension: 0.3,
          pointBackgroundColor: "#293440",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: getLineChartOptions(),
  });

  // Response Distribution Chart
  const distributionCtx = document
    .getElementById("distributionChart")
    .getContext("2d");
  distributionChart = new Chart(distributionCtx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#293440",
            "#46576c",
            "#788b95",
            "#abc7d6",
            "#e0ebf6",
          ],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: getDoughnutChartOptions(),
  });
}

function getBarChartOptions(label) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#293440",
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        padding: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: "rgba(0, 0, 0, 0.05)" },
        ticks: { callback: (value) => value + "%" },
      },
      x: { grid: { display: false } },
    },
  };
}

function getLineChartOptions() {
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(0, 0, 0, 0.05)" } },
      x: { grid: { display: false } },
    },
  };
}

function getDoughnutChartOptions() {
  return {
    responsive: true,
    plugins: {
      legend: {
        position: "right",
        labels: { boxWidth: 15, padding: 20, font: { size: 13 } },
      },
    },
    cutout: "65%",
  };
}

function setupEventListeners() {
  // Theme toggle removed - project does not support dark mode

  // Notification badge click (target notif-badge to avoid colliding with status .badge)
  const notification = document.querySelector(".notification");
  if (notification) {
    notification.addEventListener("click", function () {
      const nb = this.querySelector(".notif-badge");
      if (!nb) return;
      nb.textContent = "0";
      nb.style.backgroundColor = "#4caf50";
    });
  }

  // Question selector change
  document
    .getElementById("question-selector")
    .addEventListener("change", function () {
      fetchResponseDistribution(this.value);
    });
}

async function fetchDashboardData() {
  try {
    // Fetch all data in parallel
    const API_BASE = "http://localhost:8000";
    const [stats, completion, timeline, schools, distribution] =
      await Promise.all([
        fetch(`${API_BASE}/api/dashboard/stats/`).then((res) => res.json()),
        fetch(`${API_BASE}/api/dashboard/completion_by_region/`).then((res) =>
          res.json()
        ),
        fetch(`${API_BASE}/api/dashboard/forms_over_time/`).then((res) =>
          res.json()
        ),
        fetch(`${API_BASE}/api/dashboard/top_schools/`).then((res) =>
          res.json()
        ),
        fetch(
          `${API_BASE}/api/dashboard/response_distribution/?question=1`
        ).then((res) => res.json()),
      ]);

    // Update UI with fetched data
    updateStatsCards(stats);
    updateCompletionChart(completion);
    updateTimelineChart(timeline);
    updateSchoolsTable(schools);
    updateDistributionChart(distribution);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    alert("Failed to load dashboard data");
  }
}

function updateStatsCards(data) {
  document.getElementById("total-forms").textContent =
    data.total_forms.toLocaleString();
  document.getElementById(
    "total-forms-trend"
  ).innerHTML = `<i class="fas fa-arrow-${data.total_forms_trend.direction}"></i> ${data.total_forms_trend.value} from last month`;

  document.getElementById(
    "completion-rate"
  ).textContent = `${data.completion_rate}%`;
  document.getElementById(
    "completion-rate-trend"
  ).innerHTML = `<i class="fas fa-arrow-${data.completion_rate_trend.direction}"></i> ${data.completion_rate_trend.value} from last month`;

  document.getElementById("avg-time").textContent = `${data.avg_time} min`;
  document.getElementById(
    "avg-time-trend"
  ).innerHTML = `<i class="fas fa-arrow-${data.avg_time_trend.direction}"></i> ${data.avg_time_trend.value} from last month`;

  document.getElementById("active-schools").textContent = data.active_schools;
  document.getElementById(
    "active-schools-trend"
  ).innerHTML = `<i class="fas fa-arrow-${data.active_schools_trend.direction}"></i> ${data.active_schools_trend.value} from last month`;

  // Add trend classes
  document.querySelectorAll(".card-trend").forEach((el) => {
    el.classList.remove("positive", "negative");
    const isPositive = el.querySelector(".fa-arrow-up");
    el.classList.add(isPositive ? "positive" : "negative");
  });
}

function updateCompletionChart(data) {
  completionChart.data.labels = data.regions;
  completionChart.data.datasets[0].data = data.completion_rates;
  completionChart.update();
}

function updateTimelineChart(data) {
  timelineChart.data.labels = data.dates;
  timelineChart.data.datasets[0].data = data.counts;
  timelineChart.update();
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

async function fetchResponseDistribution(questionId) {
  try {
    const API_BASE = "http://localhost:8000";
    const response = await fetch(
      `${API_BASE}/api/dashboard/response_distribution/?question=${questionId}`
    );
    const data = await response.json();
    updateDistributionChart(data);
  } catch (error) {
    console.error("Error fetching response distribution:", error);
  }
}

function updateDistributionChart(data) {
  distributionChart.data.labels = data.labels;
  distributionChart.data.datasets[0].data = data.values;
  distributionChart.update();
}
