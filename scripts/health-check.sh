#!/bin/bash
# Health check script for EdSight services

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    local service=$1
    local url=$2
    
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $service is unhealthy"
        return 1
    fi
}

echo "Checking EdSight services health..."

# Check Django
check_service "Django" "http://localhost:8000/health" || check_service "Django" "http://localhost:8000/"

# Check FastAPI
check_service "FastAPI" "http://localhost:9000/health"

# Check Nginx
check_service "Nginx" "http://localhost:8082/health" || check_service "Nginx" "http://localhost:8082/"

# Check MySQL (if mysql client is available)
if command -v mysql &> /dev/null; then
    if mysql -h localhost -P 3307 -u edsight -pedsight_pass -e "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MySQL is healthy"
    else
        echo -e "${RED}✗${NC} MySQL is unhealthy"
    fi
fi

# Check Redis (if redis-cli is available)
if command -v redis-cli &> /dev/null; then
    if redis-cli -h localhost -p 6380 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is healthy"
    else
        echo -e "${RED}✗${NC} Redis is unhealthy"
    fi
fi

echo "Health check complete!"

