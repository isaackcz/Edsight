// Charts functionality
let completionChart, timelineChart, workflowChart;

function initCharts() {
  // Destroy existing charts if they exist to prevent "Canvas already in use" error
  if (completionChart) {
    completionChart.destroy();
    completionChart = null;
  }
  if (timelineChart) {
    timelineChart.destroy();
    timelineChart = null;
  }
  if (workflowChart) {
    workflowChart.destroy();
    workflowChart = null;
  }

  const completionCanvas = document.getElementById("completionChart");
  const timelineCanvas = document.getElementById("timelineChart");
  const workflowCanvas = document.getElementById("workflowChart");

  if (!completionCanvas && !timelineCanvas && !workflowCanvas) {
    console.debug("No dashboard chart canvases found; skipping chart init");
    return false;
  }

  // Completion Rate by Region Chart
  if (completionCanvas) {
    const completionCtx = completionCanvas.getContext("2d");
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
  }

  // Forms Completed Over Time Chart
  if (timelineCanvas) {
    const timelineCtx = timelineCanvas.getContext("2d");
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
  }

  // Form Workflow Status Chart
  if (workflowCanvas) {
    const workflowCtx = workflowCanvas.getContext("2d");
    workflowChart = new Chart(workflowCtx, {
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
              "#cde1f1",
              "#f0f7ff",
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

  return true;
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
  if (!completionChart || !data || !data.regions || !data.completion_rates) {
    console.warn('Unable to update completion chart: chart or data not available');
    return;
  }
  completionChart.data.labels = data.regions;
  completionChart.data.datasets[0].data = data.completion_rates;
  completionChart.update();
}

function updateTimelineChart(data) {
  if (!timelineChart || !data || !data.dates || !data.counts) {
    console.warn('Unable to update timeline chart: chart or data not available');
    return;
  }
  timelineChart.data.labels = data.dates;
  timelineChart.data.datasets[0].data = data.counts;
  timelineChart.update();
}

function updateWorkflowChart(data) {
  if (!workflowChart || !data || !data.labels || !data.values) {
    console.warn('Unable to update workflow chart: chart or data not available');
    return;
  }
  workflowChart.data.labels = data.labels;
  workflowChart.data.datasets[0].data = data.values;
  workflowChart.update();
}
