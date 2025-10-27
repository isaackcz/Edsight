// Charts functionality
let completionChart, timelineChart, distributionChart;

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
          /* use UI blues for charts, ensure accessible contrast */
          backgroundColor: "rgba(58,110,165,0.18)",
          borderColor: "rgba(58,110,165,0.9)",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: Object.assign({}, getBarChartOptions("Completion Rate (%)"), {
      maintainAspectRatio: false,
    }),
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
          backgroundColor: "rgba(58,110,165,0.12)",
          borderColor: "rgba(0,78,152,0.95)",
          borderWidth: 3,
          tension: 0.3,
          pointBackgroundColor: "rgba(0,78,152,0.95)",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: Object.assign({}, getLineChartOptions(), {
      maintainAspectRatio: false,
    }),
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
            "#004e98" /* polynesian-blue */,
            "#3a6ea5" /* bice-blue */,
            "#789dbf",
            "#bcd6ea",
            "#e9f3fb",
          ],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: Object.assign({}, getDoughnutChartOptions(), {
      maintainAspectRatio: false,
    }),
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

function updateDistributionChart(data) {
  distributionChart.data.labels = data.labels;
  distributionChart.data.datasets[0].data = data.values;
  distributionChart.update();
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
