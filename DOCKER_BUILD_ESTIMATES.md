# Docker Build Time and Size Estimates

## Overview
This document provides estimates for building and running the EdSight Docker containers.

## Base Image Sizes

| Image | Size | Notes |
|-------|------|-------|
| `python:3.11-slim` | ~50-60 MB | Base for Django, FastAPI, Celery |
| `mysql:8.0` | ~1.07 GB | Database server |
| `redis:7-alpine` | ~60.7 MB | Cache and message broker |
| `nginx:1.27-alpine` | ~73.6 MB | Reverse proxy |

## Application Image Size Estimates

### Django Image (`edsight-django`)
- **Base**: python:3.11-slim (~55 MB)
- **Build dependencies**: build-essential, mysqlclient-dev (~150 MB, discarded in final)
- **Python packages** (from requirements.txt): ~200-300 MB
  - Django + dependencies: ~50 MB
  - FastAPI + uvicorn: ~30 MB
  - Celery: ~20 MB
  - mysqlclient: ~10 MB
  - Other packages: ~100-200 MB
- **Runtime dependencies**: default-libmysqlclient-dev, curl (~50 MB)
- **Application code**: ~10-50 MB (depends on project size)
- **Final estimated size**: **~350-450 MB**

### FastAPI Image (`edsight-fastapi`)
- **Base**: python:3.11-slim (~55 MB)
- **Build dependencies**: Same as Django (~150 MB, discarded)
- **Python packages**: Same as Django (~200-300 MB)
- **Runtime dependencies**: Same as Django (~50 MB)
- **Application code**: ~10-50 MB
- **Final estimated size**: **~350-450 MB**

### Celery Image (`edsight-celery`)
- **Base**: python:3.11-slim (~55 MB)
- **Dependencies**: Same as Django
- **Final estimated size**: **~350-450 MB**

### Total Application Images
- **Combined size**: ~1.05-1.35 GB (3 images)
- **Note**: Multi-stage builds ensure build dependencies are not included in final images

## Total System Size

| Component | Size | Notes |
|-----------|------|-------|
| Application images (3x) | ~1.05-1.35 GB | Django, FastAPI, Celery |
| MySQL | ~1.07 GB | Database |
| Redis | ~60.7 MB | Cache |
| Nginx | ~73.6 MB | Proxy |
| **Total (images)** | **~2.25-2.55 GB** | All images combined |
| **Runtime overhead** | ~500 MB | Container overhead, volumes |
| **Total disk space needed** | **~2.75-3.05 GB** | For full deployment |

## Build Time Estimates

### First Build (No Cache)

| Stage | Time | Notes |
|-------|------|-------|
| **Download base images** | 2-5 minutes | Depends on internet speed |
| - python:3.11-slim | 30-60 seconds | |
| - mysql:8.0 | 1-2 minutes | Largest image |
| - redis:7-alpine | 10-20 seconds | |
| - nginx:1.27-alpine | 10-20 seconds | |
| **Build Django image** | 5-10 minutes | |
| - Install build deps | 1-2 minutes | |
| - Install Python packages | 3-6 minutes | mysqlclient compilation takes time |
| - Copy files & finalize | 30-60 seconds | |
| **Build FastAPI image** | 5-10 minutes | Similar to Django |
| **Build Celery image** | 5-10 minutes | Similar to Django |
| **Total first build** | **17-35 minutes** | Depends on CPU and internet |

### Subsequent Builds (With Cache)

| Scenario | Time | Notes |
|----------|------|-------|
| **No code changes** | 10-30 seconds | Just verify images exist |
| **Code changes only** | 1-3 minutes | Rebuild final layers |
| **requirements.txt changed** | 5-10 minutes | Reinstall Python packages |
| **Dockerfile changed** | 5-15 minutes | Rebuild from changed layer |

### Build Time Factors

1. **CPU Performance**: 
   - Modern CPU (4+ cores): 15-25 minutes first build
   - Older CPU (2 cores): 25-40 minutes first build

2. **Internet Speed**:
   - Fast (100+ Mbps): 2-3 minutes for base images
   - Slow (10-20 Mbps): 5-10 minutes for base images

3. **Disk Speed**:
   - SSD: Faster layer caching
   - HDD: Slower, especially for large operations

4. **Docker BuildKit**:
   - Enabled: 10-20% faster builds
   - Disabled: Standard build times

## Disk Space Requirements

### During Build
- **Temporary build cache**: ~500 MB - 1 GB
- **Build context**: ~50-200 MB (project files)
- **Intermediate layers**: ~1-2 GB (discarded after build)
- **Total during build**: ~2-3.5 GB

### After Build
- **Final images**: ~2.25-2.55 GB
- **Container runtime**: ~500 MB
- **Volumes (data)**: Variable (depends on database size)
- **Logs**: ~100-500 MB (with rotation)
- **Total**: ~3-4 GB minimum

### Production Deployment
- **Images**: ~2.5 GB
- **Database volume**: 1-10 GB+ (grows with data)
- **Static files volume**: 50-500 MB
- **Logs**: 500 MB - 2 GB (with rotation)
- **Backups**: Variable (depends on retention)
- **Recommended minimum**: **10 GB** free space

## Optimization Tips

### Reduce Build Time

1. **Use BuildKit** (faster builds):
   ```bash
   export DOCKER_BUILDKIT=1
   docker-compose build
   ```

2. **Parallel builds**:
   ```bash
   docker-compose build --parallel
   ```

3. **Use cache mounts** (Docker BuildKit):
   ```dockerfile
   RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
   ```

4. **Build only what changed**:
   ```bash
   docker-compose build django  # Build only Django
   ```

### Reduce Image Size

1. **Multi-stage builds**: Already implemented ✓
2. **Remove build dependencies**: Already done ✓
3. **Use .dockerignore**: Already optimized ✓
4. **Minimize layers**: Already optimized ✓

## Network Bandwidth

### First Pull (Downloading Images)
- **Total download**: ~1.2-1.3 GB
- **Time estimate**:
  - Fast connection (100 Mbps): 2-3 minutes
  - Medium connection (50 Mbps): 4-6 minutes
  - Slow connection (10 Mbps): 15-20 minutes

### Subsequent Pulls
- Only changed layers are downloaded
- Typically 10-100 MB per update

## Memory Requirements During Build

| Operation | RAM Usage | Notes |
|-----------|-----------|-------|
| Building one image | 1-2 GB | Compiling Python packages |
| Building all images | 2-4 GB | If building in parallel |
| Running containers | 1-3 GB | All services running |
| **Recommended RAM** | **4-8 GB** | For comfortable building and running |

## Quick Reference

### Fast Build (Good Hardware + Fast Internet)
- **First build**: 15-20 minutes
- **Subsequent builds**: 1-3 minutes (code changes)
- **Total size**: ~2.5 GB

### Average Build (Standard Hardware)
- **First build**: 25-35 minutes
- **Subsequent builds**: 2-5 minutes (code changes)
- **Total size**: ~2.5 GB

### Slow Build (Older Hardware + Slow Internet)
- **First build**: 40-60 minutes
- **Subsequent builds**: 5-10 minutes (code changes)
- **Total size**: ~2.5 GB

## Monitoring Build Progress

```bash
# Watch build progress
docker-compose build --progress=plain

# Check image sizes after build
docker images | grep edsight

# Check disk usage
docker system df
```

## Recommendations

1. **First build**: Allow 30-40 minutes on average hardware
2. **Disk space**: Ensure at least 5 GB free before building
3. **RAM**: Have at least 4 GB available
4. **Internet**: Stable connection for first build (downloading base images)
5. **Subsequent builds**: Should be much faster (1-5 minutes) due to caching

## Notes

- All estimates are approximate and depend on:
  - Hardware specifications
  - Internet connection speed
  - System load
  - Docker version and configuration
  - Project size and dependencies

- Multi-stage builds significantly reduce final image sizes
- Docker layer caching makes subsequent builds much faster
- Build times can vary ±30% based on system conditions

