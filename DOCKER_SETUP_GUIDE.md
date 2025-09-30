# 🐳 EdSight Docker Setup - Single Solution

## 🎯 **What This Does**

This Docker setup **uses your existing XAMPP MySQL data** instead of creating a separate database. This means:
- ✅ **Your existing data is preserved**
- ✅ **No data migration needed**
- ✅ **Works on any device**
- ✅ **Single solution - no switching between environments**

## 🚀 **Quick Start**

### **Step 1: Start XAMPP**
1. Open XAMPP Control Panel as Administrator
2. Start **MySQL** service
3. Start **Apache** service
4. Keep XAMPP running (don't close it)

### **Step 2: Start Docker**
```bash
# Double-click this file:
start_docker.bat
```

### **Step 3: Access Your App**
- **Main App**: http://localhost:8000
- **FastAPI**: http://localhost:9000
- **Load Balancer**: http://localhost:8082
- **phpMyAdmin**: http://localhost/phpmyadmin

### **Step 4: Stop When Done**
```bash
# Double-click this file:
stop_docker.bat
```

### **Step 5: Cleanup (Optional)**
```bash
# Quick cleanup (daily use):
quick_clean.bat

# Full cleanup (weekly use):
clean_docker.bat

# Complete reset (when needed):
reset_docker.bat
```

## 🔧 **How It Works**

### **Architecture:**
```
┌─────────────────┐    ┌──────────────────┐
│   Your Device   │    │   Docker Host    │
│                 │    │                  │
│  XAMPP MySQL    │◄───┤  Django App      │
│  (Port 3306)    │    │  (Port 8000)     │
│                 │    │                  │
│  XAMPP Apache   │    │  FastAPI App     │
│  (Port 80)      │    │  (Port 9000)     │
│                 │    │                  │
│  XAMPP phpMyAdmin│   │  Nginx LB        │
│  (Port 80)      │    │  (Port 8082)     │
└─────────────────┘    └──────────────────┘
```

### **Key Changes:**
- **Database**: Uses XAMPP MySQL (host.docker.internal:3306)
- **No separate MariaDB container**
- **Your existing data is accessible**
- **phpMyAdmin**: Use XAMPP's version (http://localhost/phpmyadmin)

## 🌐 **Access URLs**

| Service | URL | Description |
|---------|-----|-------------|
| **Django App** | http://localhost:8000 | Main application |
| **FastAPI API** | http://localhost:9000 | API endpoints |
| **Nginx LB** | http://localhost:8082 | Load balancer |
| **XAMPP phpMyAdmin** | http://localhost/phpmyadmin | Database management |

## 📊 **Monitoring Commands**

```bash
# Check container status
docker-compose ps

# View real-time logs
docker-compose logs -f

# Stop all services
docker-compose down

# Restart services
docker-compose restart
```

## 🧹 **Docker Cleanup Scripts**

### **Quick Cleanup (Daily Use)**
```bash
quick_clean.bat
```
**What it does:**
- Removes stopped containers
- Removes unused images
- Removes build cache
- **Safe**: Preserves running containers and data

### **Full Cleanup (Weekly Use)**
```bash
clean_docker.bat
```
**What it does:**
- Stops all containers first
- Removes all stopped containers
- Removes all unused images
- Removes all unused volumes
- Removes build cache
- Removes unused networks
- **Safe**: Your data is preserved

### **Complete Reset (When Needed)**
```bash
reset_docker.bat
```
**What it does:**
- **NUCLEAR OPTION** - Removes everything
- All containers, images, volumes, networks
- Complete fresh start
- **Warning**: You'll need to rebuild everything
- **Safe**: Your XAMPP data is never touched

## ⚠️ **Important Notes**

### **Prerequisites:**
- ✅ XAMPP MySQL must be running
- ✅ XAMPP Apache must be running
- ✅ Docker Desktop must be installed

### **Data Safety:**
- ✅ Your XAMPP MySQL data is **never touched**
- ✅ Docker containers only **read from** XAMPP MySQL
- ✅ All your existing users, forms, and data are preserved

### **Troubleshooting:**
- **"Can't connect to database"**: Make sure XAMPP MySQL is running
- **"Site can't be reached"**: Check if Docker containers are running
- **Port conflicts**: Make sure XAMPP Apache is using port 80

## 🔄 **Workflow**

### **Daily Development:**
1. Start XAMPP (MySQL + Apache)
2. Run `start_docker.bat`
3. Develop your app
4. Run `stop_docker.bat` when done

### **Sharing with Team:**
1. Share the entire project folder
2. Team members install XAMPP and Docker
3. They run `start_docker.bat`
4. Everyone uses the same setup

## 🎯 **Benefits**

- ✅ **Single solution** - no more switching environments
- ✅ **Uses existing data** - no data loss
- ✅ **Team-friendly** - works on any device
- ✅ **Production-ready** - proper containerization
- ✅ **Easy deployment** - just share the project folder

---

## 🆘 **Need Help?**

If you encounter issues:
1. Make sure XAMPP MySQL and Apache are running
2. Check Docker Desktop is running
3. Run `docker-compose ps` to see container status
4. Run `docker-compose logs` to see error messages
