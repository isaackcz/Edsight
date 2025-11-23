# EdSight Docker Documentation

Complete guide for running EdSight in Docker containers.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Services](#services)
- [Health Checks](#health-checks)
- [Backup and Restore](#backup-and-restore)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

## Quick Start

### Development

```bash
# Build images (Windows)
build_docker.bat

# Or build manually
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Production

```bash
# Build and start with production settings
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Fast Build (Windows)

For fastest builds on Windows, use the optimized build script:

```batch
# Fast build with all optimizations
build_docker_fast.bat

# Or build specific service only
build_docker.bat django

# Build without cache (fresh build)
build_docker.bat --no-cache
```

## Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose 2.0+
- At least 4GB RAM available (8GB recommended)
- 10GB free disk space (5GB minimum for build, 10GB recommended for production)
- Stable internet connection for first build (downloads ~1.2GB of base images)

### Build Time Estimates
- **First build**: 25-35 minutes (average hardware)
- **Subsequent builds**: 1-5 minutes (with cache)
- **Total image size**: ~2.5 GB

See [DOCKER_BUILD_ESTIMATES.md](DOCKER_BUILD_ESTIMATES.md) for detailed build time and size information.

### Deployment to VPS (Hostinger, etc.)

**Important**: If deploying to a Linux VPS (like Hostinger), you should **build images on the VPS**, not on Windows. Windows-built images use Windows containers and won't work on Linux.

See [DEPLOYMENT_HOSTINGER.md](DEPLOYMENT_HOSTINGER.md) for complete VPS deployment guide.

## Development Setup

### 1. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.docker
```

Edit `.env.docker` with your development settings.

### 2. Start Services

```bash
# Start with development overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Or use the default compose file
docker-compose up -d
```

### 3. Access Services

- **Django App**: http://localhost:8000
- **FastAPI API**: http://localhost:9000
- **Nginx Load Balancer**: http://localhost:8082
- **MySQL Database**: localhost:3307
- **Redis Cache**: localhost:6380

### 4. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f django
docker-compose logs -f fastapi
docker-compose logs -f celery
```

### 5. Run Migrations

Migrations run automatically on container start. To run manually:

```bash
docker-compose exec django python manage.py migrate
```

### 6. Create Superuser

```bash
docker-compose exec django python manage.py createsuperuser
```

## Production Deployment

### 1. Environment Configuration

Copy the production example:

```bash
cp .env.production.example .env.production
```

**IMPORTANT**: Update all values in `.env.production` with secure production values:
- Generate a strong `SECRET_KEY` (minimum 50 characters)
- Use strong database passwords
- Set `DEBUG=False`
- Configure `ALLOWED_HOSTS` with your domain

### 2. Docker Secrets (Recommended)

For sensitive data, use Docker secrets:

1. Create secrets directory:
```bash
mkdir -p secrets
```

2. Create secret files:
```bash
echo "your-secure-mysql-root-password" > secrets/mysql_root_password.txt
echo "your-secure-mysql-password" > secrets/mysql_password.txt
echo "your-secure-django-secret-key" > secrets/django_secret_key.txt
echo "your-secure-redis-password" > secrets/redis_password.txt
```

3. Uncomment secrets section in `docker-compose.prod.yml`

4. Set proper permissions:
```bash
chmod 600 secrets/*.txt
```

### 3. Build and Deploy

```bash
# Build images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d

# Verify services are running
docker-compose ps
```

### 4. SSL/TLS Configuration

For production, configure SSL certificates:

1. Place certificates in `./ssl/` directory:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key
   - `chain.pem` - Certificate chain (optional)

2. Update `nginx.prod.conf` with certificate paths

3. Use production nginx config:
```bash
# In docker-compose.prod.yml, change nginx volumes:
volumes:
  - ./nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
  - ./ssl:/etc/nginx/ssl:ro
```

## Environment Variables

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | `change-me-in-production` |
| `DEBUG` | Debug mode | `False` |
| `ALLOWED_HOSTS` | Allowed hostnames | `*` |
| `DB_HOST` | Database host | `mysql` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Database name | `edsight` |
| `DB_USER` | Database user | `edsight` |
| `DB_PASSWORD` | Database password | `edsight_pass` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis host | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `GUNICORN_WORKERS` | Gunicorn worker count | `3` |
| `CELERY_LOG_LEVEL` | Celery log level | `info` |
| `CELERY_CONCURRENCY` | Celery worker concurrency | `4` |

See `.env.example` for complete list.

## Services

### Django

- **Container**: `edsight_django`
- **Port**: `8000`
- **Health Check**: `http://localhost:8000/`
- **Logs**: `docker-compose logs django`

### FastAPI

- **Container**: `edsight_fastapi`
- **Port**: `9000`
- **Health Check**: `http://localhost:9000/health`
- **Logs**: `docker-compose logs fastapi`

### Celery Worker

- **Container**: `edsight_celery`
- **Purpose**: Background task processing
- **Logs**: `docker-compose logs celery`

### Celery Beat

- **Container**: `edsight_celery_beat`
- **Purpose**: Scheduled task execution
- **Logs**: `docker-compose logs celery-beat`

### MySQL

- **Container**: `edsight_mysql`
- **Port**: `3307` (external), `3306` (internal)
- **Data Volume**: `edsight_mysql_data`
- **Logs**: `docker-compose logs mysql`

### Redis

- **Container**: `edsight_redis`
- **Port**: `6380` (external), `6379` (internal)
- **Data Volume**: `edsight_redis_data`
- **Logs**: `docker-compose logs redis`

### Nginx

- **Container**: `edsight_nginx`
- **Port**: `8082`
- **Purpose**: Reverse proxy and load balancer
- **Logs**: `docker-compose logs nginx`

## Health Checks

### Manual Health Check

Run the health check script:

```bash
bash scripts/health-check.sh
```

### Service Health Checks

All services have built-in health checks:

```bash
# Check service status
docker-compose ps

# View health check logs
docker inspect edsight_django | grep -A 10 Health
```

## Backup and Restore

### Backup Database

```bash
# Using the backup script
bash scripts/backup-db.sh

# Manual backup
docker exec edsight_mysql mysqldump -u root -p edsight > backup.sql
```

### Restore Database

```bash
# Using the restore script
bash scripts/restore-db.sh backups/edsight_backup_YYYYMMDD_HHMMSS.sql.gz

# Manual restore
docker exec -i edsight_mysql mysql -u root -p edsight < backup.sql
```

## Troubleshooting

### Services Won't Start

1. Check Docker is running:
```bash
docker info
```

2. Check for port conflicts:
```bash
netstat -an | grep -E "8000|9000|3307|6380|8082"
```

3. View service logs:
```bash
docker-compose logs [service_name]
```

### Database Connection Issues

1. Verify MySQL is healthy:
```bash
docker-compose ps mysql
docker-compose logs mysql
```

2. Check database credentials in `.env.docker`

3. Test connection:
```bash
docker-compose exec django python manage.py dbshell
```

### Static Files Not Loading

1. Collect static files:
```bash
docker-compose exec django python manage.py collectstatic --noinput
```

2. Check volume mounts:
```bash
docker-compose exec nginx ls -la /vol/static
```

### Celery Tasks Not Running

1. Check Celery worker logs:
```bash
docker-compose logs celery
```

2. Verify Redis connection:
```bash
docker-compose exec celery python -c "import redis; r = redis.Redis(host='redis'); r.ping()"
```

3. Check Celery status:
```bash
docker-compose exec celery celery -A app inspect active
```

### Permission Issues

If you encounter permission errors:

```bash
# Fix file permissions
docker-compose exec django chown -R appuser:appuser /app
```

### Out of Memory

If containers are being killed:

1. Increase Docker memory limit in Docker Desktop settings
2. Reduce resource limits in `docker-compose.yml`
3. Scale down services if needed

### Clean Start

To completely reset:

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove images (optional)
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

## Security Best Practices

### 1. Use Strong Secrets

- Generate secure random strings for `SECRET_KEY`
- Use strong, unique passwords for database and Redis
- Never commit secrets to version control

### 2. Use Docker Secrets in Production

Enable Docker secrets in `docker-compose.prod.yml` for sensitive data.

### 3. Keep Images Updated

Regularly update base images and dependencies:

```bash
docker-compose build --no-cache
docker-compose up -d
```

### 4. Network Security

- Services communicate on internal Docker network
- Only expose necessary ports
- Use firewall rules to restrict access

### 5. SSL/TLS

Always use HTTPS in production:
- Configure SSL certificates
- Use `nginx.prod.conf` with SSL settings
- Enable HSTS headers

### 6. Regular Backups

Set up automated backups:

```bash
# Add to crontab
0 2 * * * /path/to/scripts/backup-db.sh
```

### 7. Monitor Logs

Regularly review logs for security issues:

```bash
docker-compose logs | grep -i error
docker-compose logs | grep -i "unauthorized"
```

### 8. Limit Resources

Resource limits are configured in `docker-compose.yml` to prevent resource exhaustion attacks.

### 9. Non-Root Users

All containers run as non-root users (`appuser`) for security.

### 10. Read-Only Filesystems

Production containers use read-only root filesystems where possible (see `docker-compose.prod.yml`).

## Build Scripts

### Windows Build Scripts

Two batch files are provided for building Docker images:

1. **`build_docker.bat`** - Full-featured build script with options
   - Enables BuildKit automatically
   - Supports parallel builds
   - Can build specific services
   - Shows build tips and progress
   - Example: `build_docker.bat django`

2. **`build_docker_fast.bat`** - Quick build script
   - Maximum speed optimizations
   - Parallel builds enabled
   - Minimal output
   - Example: `build_docker_fast.bat`

### Build Options

```batch
# Build all services (default)
build_docker.bat

# Build specific service (faster)
build_docker.bat django
build_docker.bat fastapi
build_docker.bat celery

# Build without cache (fresh build)
build_docker.bat --no-cache

# Build sequentially (if parallel causes issues)
build_docker.bat --no-parallel

# Show help
build_docker.bat --help
```

### Speed Tips

- **First build**: 25-35 minutes (downloading base images)
- **Subsequent builds**: 1-5 minutes (using cache)
- **Build specific service**: Much faster (only rebuilds what changed)
- **Use BuildKit**: Enabled by default in build scripts
- **Parallel builds**: Enabled by default for faster completion

See [DOCKER_BUILD_ESTIMATES.md](DOCKER_BUILD_ESTIMATES.md) for detailed build time and size information.

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review service logs
3. Check GitHub issues
4. Contact the development team

