#!/bin/bash
# Quick deployment script for Hostinger VPS
# Usage: ./deploy_to_vps.sh

set -e

echo "================================================"
echo "   EdSight VPS Deployment Script"
echo "================================================"
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or use sudo"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose not found. Installing..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Check for port conflicts
echo "Checking for port conflicts..."
PORTS=(80 443 8000 9000 8082 3307 6380)
for port in "${PORTS[@]}"; do
    if lsof -i :$port &> /dev/null; then
        echo "⚠️  WARNING: Port $port is already in use!"
        echo "   You may need to change ports in docker-compose.yml"
    fi
done
echo

# Create directory if it doesn't exist
PROJECT_DIR="/var/www/edsight"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Creating project directory: $PROJECT_DIR"
    mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "⚠️  .env.production not found!"
    echo "   Please create it from .env.production.example"
    echo "   Then run this script again"
    exit 1
fi

# Build images
echo "Building Docker images..."
echo "   This may take 25-35 minutes on first build..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start services
echo "Starting services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Run migrations
echo "Running database migrations..."
docker-compose exec -T django python manage.py migrate --noinput || echo "Migrations may have failed, check logs"

# Collect static files
echo "Collecting static files..."
docker-compose exec -T django python manage.py collectstatic --noinput || echo "Static collection may have failed, check logs"

# Show status
echo
echo "================================================"
echo "   Deployment Complete!"
echo "================================================"
echo
docker-compose ps
echo
echo "Access your application at:"
echo "   http://72.61.140.217:8082"
echo "   or configure reverse proxy for domain access"
echo
echo "View logs: cd $PROJECT_DIR && docker-compose logs -f"
echo

