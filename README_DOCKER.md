## Run EdSight with Docker

1. Copy env template and adjust:
```bash
cp .env.docker .env
```

2. Build and start:
```bash
docker compose up -d --build
```

3. Services:
- Nginx (front): http://localhost:80 -> proxies Django/FastAPI, serves /static
- Django: http://localhost:8000 (internal, prefer nginx)
- FastAPI: http://localhost:9000 (internal, prefer nginx /api-gw/)
- MariaDB: localhost:3307
- Redis: localhost:6379
- Celery worker: background service

4. Common commands:
```bash
docker compose logs -f django
 docker compose exec django python manage.py createsuperuser
 docker compose down -v
```

5. Healthchecks:
- Django: http://localhost:8000/health (via compose healthcheck)
- FastAPI: http://localhost:9000/health

6. Notes:
- Static files are collected to /vol/static and served by nginx.
- For dev code reloading, containers mount the repo as a bind volume.
- Update .env secrets before deploying.

