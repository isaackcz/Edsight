# Deployment to Hostinger VPS Guide

## Do You Need to Build Docker Images?

**Short answer**: Yes, but you have options on **where** to build them.

## Deployment Options

### Option 1: Build on VPS (Recommended for Hostinger)

**Best for**: Direct deployment, simpler setup

**Steps**:
1. Upload your code to Hostinger VPS (via Git, FTP, or SCP)
2. SSH into your VPS
3. Build images directly on the VPS:
   ```bash
   docker-compose build
   # or
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
   ```
4. Start services:
   ```bash
   docker-compose up -d
   ```

**Pros**:
- ✅ Simpler workflow
- ✅ No need for Docker registry
- ✅ Images built for correct architecture (Linux)
- ✅ Works well with Hostinger VPS

**Cons**:
- ⚠️ Build time on VPS (may be slower than local)
- ⚠️ Uses VPS resources during build

---

### Option 2: Build Locally and Push to Registry

**Best for**: CI/CD, faster deployments, multiple environments

**Steps**:
1. Build images locally (Windows):
   ```batch
   build_docker.bat
   ```

2. Tag images for registry:
   ```bash
   docker tag edsight-django:latest your-registry/edsight-django:latest
   docker tag edsight-fastapi:latest your-registry/edsight-fastapi:latest
   docker tag edsight-celery:latest your-registry/edsight-celery:latest
   ```

3. Push to Docker Hub or private registry:
   ```bash
   docker login
   docker push your-registry/edsight-django:latest
   docker push your-registry/edsight-fastapi:latest
   docker push your-registry/edsight-celery:latest
   ```

4. On VPS, pull and run:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

**Pros**:
- ✅ Faster deployments (no build on VPS)
- ✅ Version control for images
- ✅ Can deploy to multiple servers
- ✅ Better for CI/CD pipelines

**Cons**:
- ⚠️ Need Docker registry account
- ⚠️ More complex setup
- ⚠️ Windows-built images may have issues on Linux (use multi-arch builds)

---

### Option 3: Use Docker Hub Automated Builds

**Best for**: Automated deployments, version control

**Steps**:
1. Connect GitHub repo to Docker Hub
2. Docker Hub builds images automatically on push
3. On VPS, pull pre-built images:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

**Pros**:
- ✅ Fully automated
- ✅ Images always up-to-date
- ✅ No local build needed

**Cons**:
- ⚠️ Requires Docker Hub setup
- ⚠️ Public repos free, private repos cost money

---

## Recommended Approach for Hostinger VPS

### For First-Time Deployment:

**Build directly on the VPS** (Option 1) because:
- Hostinger VPS runs Linux (correct architecture)
- Simpler setup, no registry needed
- Direct deployment from your code

### Setup Steps:

1. **Prepare your code**:
   ```bash
   # On your local machine, ensure .env.production is configured
   # Remove sensitive files from Git if needed
   ```

2. **Upload to VPS**:
   ```bash
   # Option A: Using Git (recommended)
   git clone your-repo-url
   cd EdSight
   
   # Option B: Using SCP
   scp -r . user@your-vps-ip:/path/to/edsight
   ```

3. **SSH into Hostinger VPS**:
   ```bash
   ssh user@your-vps-ip
   ```

4. **Install Docker on VPS** (if not installed):
   ```bash
   # For Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

5. **Configure environment**:
   ```bash
   cd /path/to/edsight
   cp .env.production.example .env.production
   nano .env.production  # Edit with production values
   ```

6. **Build and start**:
   ```bash
   # Build images (first time: 25-35 minutes)
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
   
   # Start services
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   
   # Check status
   docker-compose ps
   docker-compose logs -f
   ```

---

## Important Considerations for Hostinger VPS

### 1. Architecture Compatibility

⚠️ **Windows-built images may not work on Linux VPS**

If you build on Windows and deploy to Linux VPS:
- Images built on Windows use Windows containers
- Hostinger VPS runs Linux
- **Solution**: Build on VPS or use multi-arch builds

### 2. Resource Requirements

Ensure your Hostinger VPS has:
- **RAM**: Minimum 2GB (4GB recommended)
- **CPU**: 2+ cores recommended
- **Disk**: 10GB+ free space
- **Docker**: Installed and running

### 3. Network Configuration

- Configure firewall rules for ports:
  - 80 (HTTP)
  - 443 (HTTPS)
  - 3306 (MySQL - internal only)
  - 6379 (Redis - internal only)

### 4. SSL/TLS Setup

For production, set up SSL:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com
```

### 5. Domain Configuration

Point your domain to VPS IP:
- A record: `@` → VPS IP
- A record: `www` → VPS IP

---

## Quick Deployment Script for VPS

Create `deploy.sh` on your VPS:

```bash
#!/bin/bash
set -e

echo "Deploying EdSight to production..."

# Pull latest code (if using Git)
git pull origin main

# Build images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Stop old containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start new containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run migrations
docker-compose exec django python manage.py migrate

# Collect static files
docker-compose exec django python manage.py collectstatic --noinput

echo "Deployment complete!"
docker-compose ps
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run:
```bash
./deploy.sh
```

---

## Summary

**For Hostinger VPS deployment:**

1. ✅ **Build on the VPS** (recommended for first deployment)
2. ✅ Upload your code to VPS
3. ✅ Configure `.env.production`
4. ✅ Build images: `docker-compose build`
5. ✅ Start services: `docker-compose up -d`

**You don't need to build locally** unless:
- You want to test images before deployment
- You're using a Docker registry
- You have a CI/CD pipeline

**Important**: Windows-built Docker images won't work on Linux VPS. Always build on the target platform (Linux VPS) or use multi-arch builds.

---

## Troubleshooting

### Build fails on VPS:
```bash
# Check Docker is running
sudo systemctl status docker

# Check disk space
df -h

# Check Docker logs
docker-compose logs
```

### Images too large:
```bash
# Clean up unused images
docker system prune -a

# Check image sizes
docker images
```

### Port conflicts:
```bash
# Check what's using ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

