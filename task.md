You are an expert Django + FastAPI architect. I am building an advanced analytics and reporting system for a large database (up to 60k rows, 40k schools, 4k questions/sub-questions). I need a complete design plan before implementation.

Goal

Create a flexible, interactive, and transparent analytics system where users can search, filter, analyze, and export data dynamically. The system must be scalable, accurate, and easy to extend.

1. Advanced Search + Filtering

Search Bar:

Global search that works across all data points (school name, region, division, district, answers, form status).

Instant results with server-side filtering (optimized for large datasets).

Advanced Filters:

Multiple selectable filters that can be combined:

Region, Division, District, School

Category, Subsection, Topic, Question, Sub-question

Date range (submission date, last updated date)

Completion status (complete, partial, not started)

Submission status (early, on time, late)

Results must dynamically affect all statistics, analytics, and reports on the page.

Support saving and loading filter presets.

2. School Completion Statistics

Completion Rate Calculation:

For each school, calculate the % of form questions answered.

Show a progress bar per school.

Allow filtering by Region/Division/District/School.

Highlighting:

Mark schools with low completion % (e.g., <50%) in red.

Mark schools with high completion % (e.g., >90%) in green.

Allow user to set threshold dynamically.

Display Options:

Table view with sortable columns (school name, completion %, total answered, total required).

Option to group by district, division, or region and see aggregated completion rates.

3. Smart Category/Subsection/Topic Analytics

Flexible Drill-down:

User can choose any level of granularity:

Whole form → Category → Subsection → Topic → Question → Sub-question

Dynamically generate analytics at the chosen level.

Metrics to Generate:

Count of responses

Percentage distribution (for multiple choice)

Average, median, min, max (for numeric answers)

Frequency distribution (for text or choice answers)

Comparison between regions/divisions/districts/schools

Visualization:

Automatically choose best graph type based on data (bar, pie, histogram, line chart).

Allow exporting the table + chart.

4. Submission Status Tracking

Late/Early/On-Time Submission:

Compare submission timestamp with deadline.

Categorize each school submission as early, on-time, or late.

Highlighting:

Color code submissions (e.g., green = early, yellow = on-time, red = late).

Allow filtering schools by submission status.

Aggregation:

Show counts and percentages per region/division/district/school.

Show trend over time (when submissions are happening).

5. Transparency & Auditability

Explainable Metrics:

For each statistic, show how it was calculated (formula, contributing rows).

Allow drilling down to raw data that contributed to the result.

Data Provenance:

Show timestamps, user IDs, and form IDs for every answer.

Provide a way to export raw filtered data for auditing.

6. Export Options

Available Formats:

CSV, Excel, PDF

Export Scope:

Export entire report, current filter view, or raw data.

Include metadata (filters used, date generated).

7. Performance & Scalability

Use optimized database queries and indexing for filtering and aggregation.

Consider pre-aggregated tables or materialized views for heavy statistics.

Use async endpoints in FastAPI to handle concurrent requests.

8. User Experience Considerations

Clean, dashboard-like interface with cards and charts.

Search + filters always visible and easy to adjust.

Real-time updates when filters change.

Mobile-friendly layout.

Deliverable for Cursor

Generate:

A complete design document describing how each feature should work together.

A data flow plan: how filtering impacts analytics queries and results.

Recommended database indexes and structure for performance.

Suggested API endpoints for search, filtering, analytics, and export (describe input/output structure, not code).

Recommendations for visualization layout (tables, charts, drill-downs).

Consider future scalability and maintenance.