# 🔄 Environment Switching Guide

## Overview
This project supports two development environments that must be used **sequentially** (one at a time) to avoid port conflicts.

## 🎯 Quick Switch Commands

### Switch to XAMPP
```bash
# Double-click this file or run in terminal:
switch_to_xampp.bat
```

### Switch to Docker
```bash
# Double-click this file or run in terminal:
switch_to_docker.bat
```

## 📋 Detailed Workflow

### 🔧 Using XAMPP Environment

**Step 1: Switch to XAMPP**
```bash
switch_to_xampp.bat
```

**Step 2: Start XAMPP Services**
1. Open XAMPP Control Panel as Administrator
2. Start Apache
3. Start MySQL
4. Start Tomcat

**Step 3: Access Your Services**
- **Main Site**: http://localhost/
- **phpMyAdmin**: http://localhost/phpmyadmin
- **Tomcat**: http://localhost:8080

**Step 4: When Done**
- Stop all XAMPP services in Control Panel
- Close XAMPP Control Panel

---

### 🐳 Using Docker Environment

**Step 1: Switch to Docker**
```bash
switch_to_docker.bat
```

**Step 2: Access Your Services**
- **Django App**: http://localhost:8000
- **FastAPI App**: http://localhost:9000
- **Docker phpMyAdmin**: http://localhost:8081
- **Nginx Load Balancer**: http://localhost:8082

**Step 3: Monitor Docker**
```bash
# Check container status
docker-compose ps

# View real-time logs
docker-compose logs -f

# Stop all containers
docker-compose down
```

---

## ⚠️ Important Rules

### ❌ NEVER Do This:
- Run XAMPP and Docker simultaneously
- Start Docker while XAMPP services are running
- Start XAMPP while Docker containers are running

### ✅ Always Do This:
- Stop one environment completely before starting the other
- Use the provided batch files for switching
- Run XAMPP Control Panel as Administrator

## 🔍 Troubleshooting

### Port Conflicts
If you get port conflicts:
1. Stop all XAMPP services
2. Run: `docker-compose down --volumes --remove-orphans`
3. Wait 30 seconds
4. Try switching again

### Docker Won't Start
```bash
# Check what's using the ports
netstat -ano | findstr :8000
netstat -ano | findstr :9000
netstat -ano | findstr :8081
netstat -ano | findstr :8082

# Force stop Docker
docker-compose down --volumes --remove-orphans
docker system prune -f
```

### XAMPP Won't Start
1. Close XAMPP Control Panel
2. Run: `docker-compose down`
3. Wait 30 seconds
4. Open XAMPP Control Panel as Administrator
5. Start services one by one

## 📊 Port Reference

| Service | XAMPP Port | Docker Port | Conflict |
|---------|------------|-------------|----------|
| Web Server | 80 | 8082 | ✅ Resolved |
| Tomcat | 8080 | 8081 | ✅ Resolved |
| MySQL | 3306 | 3307 | ✅ Resolved |
| Redis | N/A | 6380 | ✅ Safe |

## 🎯 Best Practices

1. **Use Sequential Mode**: Always stop one environment before starting the other
2. **Use Batch Files**: The provided `.bat` files handle the switching safely
3. **Check Status**: Always verify services are stopped before switching
4. **Admin Rights**: Run XAMPP Control Panel as Administrator
5. **Clean Shutdown**: Always stop services properly (don't force-close)

---

## 🚀 Quick Start Examples

### For XAMPP Development:
```bash
switch_to_xampp.bat
# → Start XAMPP services
# → Work on your XAMPP project
# → Stop XAMPP services when done
```

### For Docker Development:
```bash
switch_to_docker.bat
# → Docker starts automatically
# → Work on your Docker project
# → Run docker-compose down when done
```
