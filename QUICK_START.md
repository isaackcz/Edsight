# 🚀 EdSight - Quick Start Guide

## 📋 **PREREQUISITES**

- **Docker Desktop** (Windows/Mac/Linux)
- **Git** (for cloning)
- **4GB RAM** minimum (8GB recommended)

## ⚡ **QUICK START (5 Minutes)**

### 1. **Clone the Repository**
```bash
git clone https://github.com/isaackcz/Edsight.git
cd Edsight
```

### 2. **Start the Application**
```bash
# Windows
start_docker.bat

# Linux/Mac
docker-compose up -d
```

### 3. **Access the Application**
- **Main App**: http://localhost:8000
- **API**: http://localhost:9000
- **Load Balancer**: http://localhost:8082
- **Database**: localhost:3307

## 🔧 **MANUAL SETUP**

### Development Mode
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Mode
```bash
# Start with production settings
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🗄️ **DATABASE SETUP**

The application will automatically:
- Create the MySQL database
- Run Django migrations
- Set up initial data

**Manual database access:**
```bash
# Access MySQL container
docker-compose exec mysql mysql -u root -p

# Run migrations manually
docker-compose exec django python manage.py migrate

# Create superuser
docker-compose exec django python manage.py createsuperuser
```

## 🌐 **SERVICES OVERVIEW**

| Service | Port | Description |
|---------|------|-------------|
| Django | 8000 | Main web application |
| FastAPI | 9000 | API backend |
| MySQL | 3307 | Database |
| Redis | 6380 | Cache & sessions |
| Nginx | 8082 | Load balancer |

## 🔍 **TROUBLESHOOTING**

### Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :8000

# Stop existing containers
docker-compose down
```

### Database Connection Issues
```bash
# Check MySQL status
docker-compose exec mysql mysqladmin ping

# Restart database
docker-compose restart mysql
```

### Memory Issues
```bash
# Check resource usage
docker stats

# Restart services
docker-compose restart
```

## 📚 **DOCUMENTATION**

- **Full Docker Guide**: [README_DOCKER_100.md](README_DOCKER_100.md)
- **Main README**: [README.md](README.md)

## 🆘 **NEED HELP?**

1. Check the logs: `docker-compose logs -f`
2. Verify all services: `docker-compose ps`
3. Check resource usage: `docker stats`
4. Restart if needed: `docker-compose restart`

## ✅ **SUCCESS INDICATORS**

You'll know it's working when:
- ✅ All containers show "healthy" status
- ✅ http://localhost:8000 loads the login page
- ✅ http://localhost:9000/health returns "ok"
- ✅ No error messages in logs

**Welcome to EdSight - Your fully containerized education management system!** 🎉
