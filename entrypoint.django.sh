#!/usr/bin/env bash
set -euo pipefail

# Apply database migrations
python manage.py migrate --noinput

# If DEBUG is set to a truthy value, run the Django development server so code
# and templates reload automatically inside the container. Otherwise use
# collectstatic + gunicorn for production behavior.
if [ "${DEBUG:-False}" = "True" ] || [ "${DEBUG:-False}" = "true" ] || [ "${DEBUG:-1}" = "1" ]; then
	echo "DEBUG mode detected: starting Django development server (autoreload)"
	# Don't collect static files for dev; let runserver serve from app/static
	exec python manage.py runserver 0.0.0.0:8000
else
	# Collect static files to the shared static volume (best-effort)
	python manage.py collectstatic --noinput || true
	exec gunicorn app.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3}
fi

