# EdSight - Educational Data Management System

A comprehensive Docker-based educational data management system built with Django and FastAPI, designed to handle large-scale educational assessments and analytics for up to 90,000 users.

## 🏗️ Architecture

EdSight is a microservices-based application with the following components:

- **Django Frontend**: Main web application with user interface
- **FastAPI Backend**: High-performance API for data processing
- **MariaDB Database**: Primary data storage with optimized indexing
- **Redis**: Caching and session management
- **Celery**: Asynchronous task processing
- **Nginx**: Reverse proxy and static file serving

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/isaackcz/Edsight.git
   cd EdSight
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.docker .env
   # Edit .env with your configuration
   ```

3. **Build and start the application**:
   ```bash
   docker compose up -d --build
   ```

4. **Create a superuser**:
   ```bash
   docker compose exec django python manage.py createsuperuser
   ```

5. **Access the application**:
   - Main Application: http://localhost
   - Django Admin: http://localhost/admin
   - API Gateway: http://localhost/api-gw/

## 📋 Services

| Service | Port | Description |
|---------|------|-------------|
| Nginx | 80 | Reverse proxy and static files |
| Django | 8000 | Main web application |
| FastAPI | 9000 | API services |
| MariaDB | 3307 | Database |
| Redis | 6379 | Cache and message broker |

## 🔧 Development

### Local Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f django

# Run Django commands
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic

# Stop services
docker compose down -v
```

### Database Management

```bash
# Access MariaDB
docker compose exec db mysql -u edsight -p edsight

# Run migrations
docker compose exec django python manage.py migrate

# Create superuser
docker compose exec django python manage.py createsuperuser
```

## 🏗️ Production Deployment

### Security Configuration

1. **Update environment variables** in `.env`:
   ```env
   SECRET_KEY=your-secure-secret-key
   DEBUG=False
   ALLOWED_HOSTS=your-domain.com
   MYSQL_ROOT_PASSWORD=secure-root-password
   MYSQL_PASSWORD=secure-user-password
   ```

2. **Configure SSL/TLS** with proper certificates

3. **Set up monitoring** and logging

### Scaling for 90k Users

The system is designed to handle high loads with:

- **Horizontal scaling**: Stateless design with load balancers
- **Database optimization**: Connection pooling, read replicas, indexing
- **Caching strategy**: Redis for sessions and API responses
- **Asynchronous processing**: Celery workers for background tasks
- **CDN integration**: For static file delivery

## 📊 Features

- **User Management**: Multi-level user hierarchy (Admin, School, Teacher, Student)
- **Form Management**: Dynamic form creation and distribution
- **Data Analytics**: Comprehensive reporting and analytics
- **Security**: Two-factor authentication, encryption, audit logging
- **Performance**: Optimized for 90,000+ concurrent users
- **Monitoring**: Health checks, logging, and alerting

## 🛠️ Technology Stack

- **Backend**: Django 4.2, FastAPI 0.104
- **Database**: MariaDB 10.11
- **Cache**: Redis 7
- **Task Queue**: Celery 5.3
- **Web Server**: Nginx 1.27
- **Containerization**: Docker, Docker Compose

## 📝 API Documentation

- **FastAPI Docs**: http://localhost/api-gw/docs
- **Django Admin**: http://localhost/admin

## 🔒 Security Features

- Environment-based secrets management
- Database security with restricted user permissions
- Input validation and output escaping
- HTTPS enforcement with HSTS
- Content Security Policy (CSP)
- Audit logging for all security events

## 📈 Performance Optimizations

- Database query optimization with `select_related()` and `prefetch_related()`
- Redis caching for frequently accessed data
- Asynchronous task processing
- Static file optimization with CDN support
- Connection pooling and read replicas

## 🧪 Testing

```bash
# Run tests
docker compose exec django python manage.py test

# Run with coverage
docker compose exec django coverage run --source='.' manage.py test
docker compose exec django coverage report
```

## 📚 Documentation

- [Docker Setup Guide](README_DOCKER.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guidelines](docs/security.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` directory
- Review the troubleshooting section below

## 🔧 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 80, 8000, 9000, 3307, and 6379 are available
2. **Permission issues**: Run `docker compose down -v` and rebuild
3. **Database connection**: Check MariaDB health with `docker compose ps`

### Health Checks

- Django: http://localhost:8000/health
- FastAPI: http://localhost:9000/health
- Database: `docker compose exec db mysqladmin ping -h 127.0.0.1 -P 3307`

## 📊 Monitoring

The system includes comprehensive monitoring:
- Application health checks
- Database performance metrics
- Redis cache statistics
- Celery worker status
- HTTP request logging

---

**Built with ❤️ for educational excellence**
