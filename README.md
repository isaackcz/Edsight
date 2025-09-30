# 🎓 EdSight - Educational Data Management System

A comprehensive Django + FastAPI application for educational data collection and analysis, containerized with Docker for easy deployment across different environments.

## 🚀 Quick Start

### Prerequisites

Before cloning this project, ensure you have the following installed:

1. **XAMPP** - [Download here](https://www.apachefriends.org/download.html)
2. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
3. **Git** - [Download here](https://git-scm.com/downloads)

### Installation Steps

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/EdSight.git
cd EdSight
```

#### 2. Validate Your Setup (Optional but Recommended)
```bash
# Run this to check if everything is properly installed
check_setup.bat
```

> 📋 **Quick Setup**: If you prefer a simpler guide, see [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)

#### 3. Start XAMPP Services
1. Open **XAMPP Control Panel** as Administrator
2. Start **MySQL** service (should show green "Running" status)
3. Start **Apache** service (should show green "Running" status)
4. Keep XAMPP Control Panel open (don't close it)

#### 4. Start the Application
```bash
# Double-click this file or run in terminal:
start_docker.bat
```

#### 5. Access the Application
- **Main Application**: http://localhost:8000
- **API Endpoints**: http://localhost:9000
- **Load Balancer**: http://localhost:8082
- **Database Management**: http://localhost/phpmyadmin

## 🏗️ Project Architecture

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

## 📁 Project Structure

```
EdSight/
├── app/                    # Django application
│   ├── models.py          # Database models
│   ├── views.py           # Django views
│   ├── urls.py            # URL routing
│   └── static/            # Static files (CSS, JS, images)
├── backend/               # FastAPI application
│   └── main.py            # FastAPI main application
├── config/                # Django settings
│   └── settings.py        # Configuration settings
├── templates/             # HTML templates
├── docker-compose.yml     # Docker services configuration
├── Dockerfile.django      # Django container configuration
├── Dockerfile.fastapi     # FastAPI container configuration
├── start_docker.bat       # Start application script
├── stop_docker.bat        # Stop application script
├── clean_docker.bat       # Cleanup Docker resources
└── README.md              # This file
```

## 🛠️ Development Workflow

### Daily Development
```bash
# 1. Start XAMPP (MySQL + Apache)
# 2. Start the application
start_docker.bat

# 3. Develop your features
# 4. When done, stop the application
stop_docker.bat
```

### Docker Management
```bash
# Quick cleanup (daily use)
quick_clean.bat

# Full cleanup (weekly use)  
clean_docker.bat

# Complete reset (when needed)
reset_docker.bat
```

### Monitoring Commands
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

## 🔧 Configuration

### Database Configuration
The application uses XAMPP MySQL with the following default settings:
- **Host**: localhost (from Docker: host.docker.internal)
- **Port**: 3306
- **Database**: edsight
- **User**: root
- **Password**: (empty - XAMPP default)

### Environment Variables
The application uses these environment variables (with defaults):
```bash
DB_NAME=edsight
DB_USER=root
DB_PASSWORD=
SECRET_KEY=change-me-please-use-a-real-secret-key-in-production
DEBUG=True
ALLOWED_HOSTS=*
```

## 🌐 API Endpoints

### Django Endpoints
- `GET /` - Home page
- `GET /auth/login/` - Login page
- `POST /auth/login/` - Authentication
- `GET /user-dashboard/` - User dashboard
- `GET /admin/` - Admin interface

### FastAPI Endpoints
- `GET /` - API root
- `GET /health` - Health check
- `POST /api/auth/login` - API authentication
- `GET /api/dashboard/stats` - Dashboard statistics
- `POST /api/forms/submit` - Form submission

## 🚨 Troubleshooting

### Common Issues

#### "This site can't be reached" Error
**Problem**: Browser shows connection refused
**Solution**: 
1. Ensure XAMPP MySQL and Apache are running
2. Run `docker-compose ps` to check container status
3. Check logs with `docker-compose logs django`

#### Database Connection Error
**Problem**: "Access denied for user" or "Can't connect to server"
**Solution**:
1. Verify XAMPP MySQL is running on port 3306
2. Check XAMPP MySQL user is `root` with no password
3. Ensure database `edsight` exists in XAMPP

#### Port Conflicts
**Problem**: Services won't start due to port conflicts
**Solution**:
1. Stop conflicting services (other web servers, databases)
2. Use `netstat -ano | findstr :8000` to check port usage
3. Restart Docker and XAMPP services

#### Docker Containers Not Starting
**Problem**: Containers fail to start or show unhealthy status
**Solution**:
1. Check Docker Desktop is running
2. Run `docker-compose down` then `start_docker.bat`
3. Check logs: `docker-compose logs [service-name]`

### Reset Everything
If you encounter persistent issues:
```bash
# Complete reset
reset_docker.bat

# Then restart
start_docker.bat
```

## 📊 System Requirements

### Minimum Requirements
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: 4GB (8GB recommended)
- **Storage**: 2GB free space
- **Network**: Internet connection for initial setup

### Software Requirements
- **XAMPP**: 3.3.0 or later
- **Docker Desktop**: 4.0 or later
- **Git**: 2.30 or later

## 🔒 Security Notes

### Development Environment
- Default credentials are used for development
- Database uses root user with no password
- DEBUG mode is enabled by default

### Production Deployment
Before deploying to production:
1. Change `SECRET_KEY` in settings
2. Set `DEBUG=False`
3. Configure proper database credentials
4. Set up HTTPS/SSL certificates
5. Configure proper user authentication

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test with the provided Docker setup
5. Commit your changes: `git commit -m "Add feature"`
6. Push to your branch: `git push origin feature-name`
7. Submit a pull request

### Code Style
- Follow PEP 8 for Python code
- Use meaningful variable and function names
- Add comments for complex logic
- Update documentation for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
1. Check the troubleshooting section above
2. Review the [DOCKER_SETUP_GUIDE.md](DOCKER_SETUP_GUIDE.md)
3. Check existing issues on GitHub
4. Create a new issue with detailed error information

### Reporting Issues
When reporting issues, please include:
- Operating system and version
- XAMPP version
- Docker Desktop version
- Complete error messages
- Steps to reproduce the issue

## 🎯 Features

- **User Authentication**: Secure login system
- **Form Management**: Dynamic form creation and submission
- **Data Analytics**: Built-in analytics and reporting
- **Admin Panel**: Comprehensive administration interface
- **API Integration**: RESTful API for external integrations
- **Responsive Design**: Mobile-friendly interface
- **Data Export**: CSV and PDF export capabilities

## 🔄 Updates

### Keeping Up to Date
```bash
# Pull latest changes
git pull origin main

# Rebuild Docker containers
reset_docker.bat
start_docker.bat
```

---

## 🎉 Success!

If you've followed these instructions correctly, you should now have:
- ✅ EdSight application running on http://localhost:8000
- ✅ FastAPI backend on http://localhost:9000
- ✅ XAMPP phpMyAdmin on http://localhost/phpmyadmin
- ✅ All services containerized and working together

**Happy coding! 🚀**