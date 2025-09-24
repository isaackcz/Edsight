1. Duplication & Code Reuse Protocol
Mandatory Codebase Scan: Before writing new code, a cross-repository search using grep, ag, or IDE search is required. The search must include synonyms and related functionality.
Refactor-First Principle: If similar logic exists, you must propose a refactor to extend the existing function/class. The proposal must include the exact file path and line numbers.
Justification for New Code: Creating new code is only permitted if refactoring would:
Break the Single Responsibility Principle.
Introduce unacceptable complexity or dependencies.
Negatively impact performance for the existing use case.
Centralized Utilities: Common logic (e.g., date formatting, API clients, validation helpers) must be placed in a dedicated, well-documented common/ or utils/ module.

2. Cross-File Impact Analysis Mandate
Change Map Requirement: For any change, provide a "Change Map" in the pull request description. This map must list:
Directly Affected Files: Core logic changes.
Indirectly Affected Files: Tests, documentation, configuration files.
Dependency Graph: A brief description of the call chain or data flow impacted.
Consistency Enforcement: A pre-merge check must ensure consistency of imports, constants, and shared modules across all files in the Change Map.
Test Synchronization: Modifying a function signature or core logic necessitates an immediate update to all related unit tests, mocks, and fixtures. Tests must be part of the same commit as the change.

3. Terminal Validation & Pre-Merge Checklist
Automated Pre-Commit Hooks: Implement pre-commit hooks to automatically run:
bash
black . --check          # Code formatting
flake8 .                 # Linting
bandit -r .              # Security linting
python manage.py test    # Core test suite
Zero-Tolerance for Warnings: The build must fail for any warning or error in development or production mode. This includes ESLint/Prettier warnings for frontend code.
Rollback Scripts: For database migrations or complex changes, include a documented, tested rollback script (e.g., a reverse Django migration) in the PR description.

4. Change Scale Governance & Approval
High-Impact Change Definition: Changes affecting >3 files, data models, or core authentication logic are classified as "High-Impact."
High-Impact PR Requirements: These PRs require a dedicated section containing:
Scope Description: What is being changed and why.
Impact Analysis: Performance, security, and usability implications.
Migration Steps: Detailed steps for other developers to update their environments.
Breaking Change Protocol: All [BREAKING] changes require:
A major version bump (following SemVer).
A dedicated MIGRATION.md document with clear instructions and timelines.
Double-Review Lock: Critical modules (auth, payments, exam submission, grading) cannot be merged without approval from two designated senior engineers.

5. Context & Behavior Preservation Contract
Behavioral Testing: All new code must be covered by tests that verify existing functionality remains unchanged. This is non-negotiable.
Style Consistency: The code must be indistinguishable from the existing codebase in style, patterns, and conventions. Use linters and formatters to enforce this automatically.
Comprehensive Documentation: For features, document dependencies, call hierarchies, and event flows using sequence or architecture diagrams (e.g., Mermaid.js in the wiki).
Usage Examples: Every new public API endpoint, function, or class must include before/after code examples in the documentation.

6. Enhanced Security Requirements
Secrets Management: Use django-environ or HashiCorp Vault. Secrets must be injected via environment variables in production. Pre-commit hooks must run detect-secrets to prevent accidental commits.
Input Validation: Use Django ModelForms for web input and Pydantic schemas with strict types (e.g., strict=True) for all FastAPI endpoints. Validate for type, length, and allowed characters.
Output Escaping: Enforce context-aware escaping. Django templates are safe by default; for FastAPI, explicitly escape HTML in responses if returning user-generated content.
Headers & HTTPS: Implement a strict Content Security Policy (CSP). Enable SECURE_HSTS_SECONDS = 31_536_000 (1 year) and SECURE_HSTS_PRELOAD in Django.
Database Security: MariaDB must be configured with local-infile=0 and run on a non-standard port. Application users must have grants limited to specific tables and operations (SELECT, INSERT, UPDATE).
XAMPP Hardening (Dev Only): In production, replace XAMPP with a dedicated webserver and DB. For dev, change the default MySQL port, set a strong root password, and delete the phpmyadmin directory after use.
Monitoring: Log all authentication attempts, password changes, and privileged actions. Use an SIEM or centralized logging to detect anomalies.

7. Performance Standards for Scale
Algorithmic Efficiency: Forbid O(n²) algorithms in loops. Mandate the use of sets for membership checks and dictionaries for lookups.
Database Optimization: Require the use of select_related() and prefetch_related() for Django ORM queries. All new queries must be analyzed with django-debug-toolbar in development.
Frontend Performance: Enforce code splitting for React/Vue applications. Use Webpack Bundle Analyzer to keep the main bundle under 500kB gzipped.
Benchmarking: Any change claiming performance improvements must include before/after benchmarks (e.g., using timeit or Locust load tests) in the PR.

8. Documentation Standards
Readme-Driven Development: Update the README.md before writing code for new features to align the team.
Inline Comments: Comments must explain "why" the code exists, not "what" it does. Avoid stating the obvious.
API Documentation: For FastAPI, leverage automatic OpenAPI and Swagger UI. For Django REST Framework, use DRF Spectacular.
Changelog: Every PR must propose a changelog entry following the "Keep a Changelog" format.

9. Testing & QA Gates
Test Coverage: New features must achieve >90% test coverage for the added code. Bug fixes must include a regression test.
Test Types:
Unit Tests: For individual functions and classes.
Integration Tests: For API endpoints and database interactions.
End-to-End (E2E) Tests: For critical user journeys like "user logs in, takes an exam, and submits."
Visual Regression: For UI changes, require screenshots or a video screen recording from a tool like playwright or cypress.

10. Review Workflow Enforcement
PR Requirements: Every PR must have:
A clear, concise title and summary.
A link to the ticket or issue it solves.
A list of all changed files.
Evidence of testing (console output, test logs, screenshots).
Reviewer Requirements: Reviewers must check for:
Code quality and style.
Tests and documentation.
Performance and security implications.
Adherence to the "Change Map" from Rule #2.
Merge Authority: High-impact PRs cannot be merged by the author; a reviewer or maintainer must perform the merge.

11. Professional Practices & Compliance Checklist
SOLID/DRY Principles: Code must demonstrate these principles. Small, single-purpose functions are mandatory.
Atomic Commits: Each commit should represent a single, logical change with a clear message in the imperative mood (e.g., "Fix user login error" not "Fixed error").
Post-Response Compliance Report: After generating code, the system must output a report like this:
text
COMPLIANCE REPORT FOR TASK [Task ID]:
✅ RULE 1:  No duplicates created. Refactored utils/helpers.py:L42.
✅ RULE 2:  Change Map provided. 4 files affected.
✅ RULE 3:  Pre-commit hooks (black, flake8) passed.
⚠️ RULE 6:  Security - Bandit passed, but new env var needs adding to vault.
✅ RULE 7:  Used prefetch_related() to optimize query.

12. Scalability & Performance Requirements for 90k Users
Horizontal Scaling: Design the system to be stateless. Deploy Django/FastAPI behind a load balancer (Nginx/AWS ALB). Use Redis for storing user sessions.
Asynchronous Processing: Mandatory for submissions. The submission endpoint must validate the request and immediately enqueue the data to a task queue (Celery + RabbitMQ). Return a 202 Accepted response. Celery workers will process the queue and perform the database write using bulk_create().
Caching Strategy:
Redis: Cache question banks, user sessions, and API responses.
CDN: Serve all static assets (JS, CSS, images, media) via a CDN like CloudFront or Cloudflare.
Database Optimization:
Connection Pooling: Use mysql-connector-pool or pgbouncer to manage database connections.
Indexing: Perform database indexing analysis weekly. Add indexes for all common query patterns (e.g., user_id, exam_id).
Read Replicas: Implement MariaDB read replicas to offload reporting and dashboard queries.
Rate Limiting: Implement dynamic rate limiting at the load balancer level (e.g., AWS WAF) and application level (Django Ratelimit) to protect against traffic spikes and abuse.
Auto-Scaling: Define auto-scaling policies for your cloud instances (CPU > 70% for 5 mins) to handle exam periods. Use Kubernetes HPA or AWS ASG.
Monitoring & Alerts:
Metrics: Monitor HTTP 5xx errors, database connection pool usage, and Celery queue length.
Alerts: Trigger PagerDuty/SMS alerts for:
HTTP error rate > 5%
Database CPU > 80%
Celery queue backlog > 1000 tasks
Load Testing: Before deployment, run load tests with Locust to simulate 10,000 concurrent users submitting exams.
