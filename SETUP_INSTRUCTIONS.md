# 🚀 EdSight Setup Instructions

## Quick Setup Guide for New Users

### Step 1: Install Required Software

#### Install XAMPP
1. Go to [https://www.apachefriends.org/download.html](https://www.apachefriends.org/download.html)
2. Download XAMPP for your operating system
3. Run the installer as Administrator
4. Install with default settings

#### Install Docker Desktop
1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Download Docker Desktop for your operating system
3. Run the installer as Administrator
4. Restart your computer when prompted

### Step 2: Clone and Setup Project

```bash
# Clone the repository
git clone https://github.com/yourusername/EdSight.git
cd EdSight
```

### Step 3: Start XAMPP

1. Open **XAMPP Control Panel** as Administrator
2. Click **Start** next to **Apache**
3. Click **Start** next to **MySQL**
4. Both should show green "Running" status
5. Keep XAMPP Control Panel open

### Step 4: Start the Application

```bash
# Run the start script
start_docker.bat
```

### Step 5: Verify Installation

Open your browser and visit:
- **Main App**: http://localhost:8000
- **API**: http://localhost:9000
- **Database**: http://localhost/phpmyadmin

### Troubleshooting

#### If you see "This site can't be reached":
1. Check XAMPP MySQL and Apache are running (green status)
2. Check Docker Desktop is running
3. Run `docker-compose ps` to see container status

#### If containers won't start:
1. Make sure Docker Desktop is running
2. Run `docker-compose down` then `start_docker.bat` again

#### If database connection fails:
1. Verify XAMPP MySQL is running on port 3306
2. Check phpMyAdmin is accessible at http://localhost/phpmyadmin

### Need Help?

- Check the main [README.md](README.md) for detailed instructions
- Review [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md) for Docker-specific help
- Create an issue on GitHub if you're still having problems

---

**That's it! You should now have EdSight running successfully. 🎉**
