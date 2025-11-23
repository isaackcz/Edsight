# Deployment Guide: Multiple Websites on Same VPS

## Your Setup
- **VPS IP**: 72.61.140.217
- **SSH User**: root
- **Existing**: 1 website already running
- **New**: EdSight application

## Important Considerations

### 1. Port Conflicts

Since you already have a website, check what ports are in use:

```bash
# SSH into your VPS
ssh root@72.61.140.217

# Check what's using ports 80, 443, 8000, 9000
netstat -tulpn | grep -E ':(80|443|8000|9000|8082)'
# or
ss -tulpn | grep -E ':(80|443|8000|9000|8082)'
```

### 2. Directory Structure

Recommended structure for multiple sites:

```
/var/www/
├── existing-site/          # Your current website
└── edsight/                # New EdSight application
    ├── docker-compose.yml
    ├── docker-compose.prod.yml
    ├── .env.production
    └── ... (all EdSight files)
```

### 3. Port Configuration

Since port 80/443 may be used by existing site, you have options:

**Option A: Use Different Ports (Easiest)**
- EdSight Nginx: Port 8082 (already configured)
- Access via: `http://your-domain:8082` or `http://72.61.140.217:8082`

**Option B: Use Reverse Proxy (Recommended)**
- Configure existing Nginx/Apache as reverse proxy
- Route subdomain to EdSight: `edsight.yourdomain.com` → `localhost:8082`

**Option C: Use Different Domain**
- Point new domain to same IP
- Configure Nginx virtual hosts

## Step-by-Step Deployment

### Step 1: Connect to VPS

```bash
ssh root@72.61.140.217
```

### Step 2: Check Existing Setup

```bash
# Check what web server is running
systemctl status nginx
systemctl status apache2

# Check what's using port 80
lsof -i :80
# or
netstat -tulpn | grep :80

# Check Docker (if installed)
docker --version
docker-compose --version
```

### Step 3: Install Docker (if not installed)

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 4: Create Project Directory

```bash
# Create directory for EdSight
mkdir -p /var/www/edsight
cd /var/www/edsight
```

### Step 5: Upload Your Code

**Option A: Using Git (Recommended)**
```bash
# If your code is in Git
git clone https://your-repo-url.git /var/www/edsight
cd /var/www/edsight
```

**Option B: Using SCP (from your Windows machine)**
```bash
# On Windows, in PowerShell or CMD
scp -r D:\xampp\htdocs\EdSight\* root@72.61.140.217:/var/www/edsight/
```

**Option C: Using SFTP Client**
- Use FileZilla, WinSCP, or similar
- Connect to: `sftp://root@72.61.140.217`
- Upload files to `/var/www/edsight/`

### Step 6: Configure Environment

```bash
cd /var/www/edsight

# Copy production environment template
cp .env.production.example .env.production

# Edit environment file
nano .env.production
```

**Important settings for `.env.production`:**
```env
# Django Settings
SECRET_KEY=your-very-secure-secret-key-here-min-50-chars
DEBUG=False
ALLOWED_HOSTS=your-domain.com,72.61.140.217,edsight.your-domain.com

# Database (will be containerized)
DB_HOST=mysql
DB_PORT=3306
DB_NAME=edsight_prod
DB_USER=edsight_prod
DB_PASSWORD=strong-password-here

# MySQL (for docker-compose)
MYSQL_ROOT_PASSWORD=strong-root-password-here
MYSQL_DATABASE=edsight_prod
MYSQL_USER=edsight_prod
MYSQL_PASSWORD=strong-password-here

# Ports (use different ports to avoid conflicts)
DJANGO_PORT=8000
FASTAPI_PORT=9000
NGINX_PORT=8082
MYSQL_PORT=3307
REDIS_PORT=6380
```

### Step 7: Update docker-compose.yml for Port Conflicts

If port 8000, 9000, or 3307 are in use, update `docker-compose.yml`:

```yaml
# In docker-compose.yml, change external ports:
services:
  django:
    ports:
      - "8001:8000"  # Changed from 8000:8000
      
  fastapi:
    ports:
      - "9001:9000"  # Changed from 9000:9000
    
  mysql:
    ports:
      - "3308:3306"  # Changed from 3307:3306
    
  redis:
    ports:
      - "6381:6379"  # Changed from 6380:6379
    
  nginx:
    ports:
      - "8082:80"    # Keep 8082 or change if needed
```

### Step 8: Build and Start

```bash
cd /var/www/edsight

# Build images (first time: 25-35 minutes)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 9: Configure Reverse Proxy (Optional but Recommended)

If you want to access EdSight via a domain/subdomain:

**For Nginx (if existing site uses Nginx):**

```bash
# Create Nginx config for EdSight
nano /etc/nginx/sites-available/edsight
```

Add configuration:
```nginx
server {
    listen 80;
    server_name edsight.yourdomain.com;  # or your-domain.com/edsight

    location / {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/edsight /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl reload nginx
```

**For Apache (if existing site uses Apache):**

```bash
# Create Apache config
nano /etc/apache2/sites-available/edsight.conf
```

Add configuration:
```apache
<VirtualHost *:80>
    ServerName edsight.yourdomain.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:8082/
    ProxyPassReverse / http://localhost:8082/
    
    <Proxy *>
        Order allow,deny
        Allow from all
    </Proxy>
</VirtualHost>
```

Enable site:
```bash
a2enmod proxy proxy_http
a2ensite edsight
systemctl reload apache2
```

### Step 10: Firewall Configuration

```bash
# Allow necessary ports
ufw allow 8082/tcp  # EdSight Nginx
ufw allow 22/tcp    # SSH (if not already allowed)
ufw allow 80/tcp    # HTTP (if not already allowed)
ufw allow 443/tcp   # HTTPS (if not already allowed)

# Check firewall status
ufw status
```

### Step 11: SSL Certificate (For Production)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx  # For Nginx
# or
apt install certbot python3-certbot-apache  # For Apache

# Get SSL certificate
certbot --nginx -d edsight.yourdomain.com
# or
certbot --apache -d edsight.yourdomain.com
```

## Access Your Application

After deployment, access EdSight via:

1. **Direct IP and Port**: `http://72.61.140.217:8082`
2. **Domain/Subdomain**: `http://edsight.yourdomain.com` (if reverse proxy configured)
3. **With SSL**: `https://edsight.yourdomain.com` (if SSL configured)

## Managing Multiple Sites

### View All Running Containers

```bash
# See all Docker containers
docker ps

# See only EdSight containers
cd /var/www/edsight
docker-compose ps
```

### Start/Stop EdSight

```bash
cd /var/www/edsight

# Stop EdSight (existing site continues running)
docker-compose down

# Start EdSight
docker-compose up -d

# Restart EdSight
docker-compose restart
```

### View Logs

```bash
cd /var/www/edsight

# All services
docker-compose logs -f

# Specific service
docker-compose logs -f django
docker-compose logs -f nginx
```

## Resource Management

### Check Resource Usage

```bash
# Docker resource usage
docker stats

# System resources
htop
# or
top

# Disk space
df -h
```

### Limit Resources (if needed)

Edit `docker-compose.prod.yml` to adjust resource limits if VPS is constrained.

## Troubleshooting

### Port Already in Use

```bash
# Find what's using a port
lsof -i :8082
# or
netstat -tulpn | grep 8082

# Kill process if needed (be careful!)
kill -9 <PID>
```

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Check Docker status
systemctl status docker

# Restart Docker
systemctl restart docker
```

### Database Connection Issues

```bash
# Check MySQL container
docker-compose ps mysql
docker-compose logs mysql

# Test connection
docker-compose exec django python manage.py dbshell
```

## Security Recommendations

1. **Change SSH Port** (if not already done):
   ```bash
   nano /etc/ssh/sshd_config
   # Change Port 22 to something else
   systemctl restart sshd
   ```

2. **Use Non-Root User**:
   ```bash
   # Create user for EdSight
   adduser edsight
   usermod -aG docker edsight
   ```

3. **Firewall Rules**:
   ```bash
   ufw enable
   ufw default deny incoming
   ufw default allow outgoing
   ```

4. **Regular Updates**:
   ```bash
   apt update && apt upgrade -y
   ```

## Quick Reference Commands

```bash
# Navigate to EdSight
cd /var/www/edsight

# Build images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Run migrations
docker-compose exec django python manage.py migrate

# Create superuser
docker-compose exec django python manage.py createsuperuser

# Backup database
docker-compose exec mysql mysqldump -u root -p edsight_prod > backup.sql
```

## Next Steps

1. ✅ Deploy EdSight to `/var/www/edsight`
2. ✅ Configure environment variables
3. ✅ Build and start containers
4. ✅ Set up reverse proxy (optional)
5. ✅ Configure SSL certificate
6. ✅ Test application access
7. ✅ Set up automated backups
8. ✅ Monitor logs and resources

