# 🚀 Getting Started with EdSight

## Welcome to EdSight! 

This guide will help you get up and running quickly.

## 📋 What You Need

Before you start, make sure you have:
- ✅ **XAMPP** installed
- ✅ **Docker Desktop** installed  
- ✅ **Git** installed
- ✅ Internet connection

## 🎯 Quick Start (5 Minutes)

### Step 1: Clone the Project
```bash
git clone https://github.com/yourusername/EdSight.git
cd EdSight
```

### Step 2: Check Your Setup
```bash
check_setup.bat
```

### Step 3: Start XAMPP
1. Open XAMPP Control Panel as Administrator
2. Start MySQL and Apache services
3. Keep XAMPP running

### Step 4: Start the Application
```bash
start_docker.bat
```

### Step 5: Open Your Browser
Visit: http://localhost:8000

## 🎉 Success!

If everything worked, you should see the EdSight login page!

## 📚 Need More Help?

- **Detailed Setup**: See [README.md](README.md)
- **Quick Setup**: See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)  
- **Docker Help**: See [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)

## 🆘 Troubleshooting

### Common Issues:
- **"This site can't be reached"** → Check XAMPP MySQL/Apache are running
- **"Access denied"** → Make sure XAMPP MySQL is running on port 3306
- **Containers won't start** → Check Docker Desktop is running

### Quick Fixes:
```bash
# If containers won't start
docker-compose down
start_docker.bat

# If you need a fresh start
reset_docker.bat
start_docker.bat
```

## 🎯 What's Next?

Once you have EdSight running:
1. Explore the admin panel at http://localhost:8000/admin/
2. Check the API documentation at http://localhost:9000/docs
3. Access phpMyAdmin at http://localhost/phpmyadmin
4. Start developing your features!

---

**Happy coding! 🚀**
