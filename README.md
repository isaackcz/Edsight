# EdSight - Educational Data Management System

EdSight is a comprehensive educational data management system built with Django and FastAPI, designed to handle educational assessments, analytics, and reporting for educational institutions.

## 🚀 Features

- **User Management**: Multi-level user hierarchy with role-based access control
- **Form Management**: Dynamic form creation and data collection
- **Analytics Dashboard**: Comprehensive data analysis and reporting
- **Security**: Enhanced security features with 2FA and audit logging
- **API Integration**: RESTful APIs for data access and integration
- **Progressive Web App**: Offline capabilities and mobile-friendly interface

## 🏗️ Architecture

- **Backend**: Django + FastAPI hybrid architecture
- **Database**: MariaDB/MySQL with optimized queries
- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Authentication**: JWT-based authentication with 2FA
- **Caching**: Redis for session management and caching
- **Security**: Comprehensive audit logging and security monitoring

## 📁 Project Structure

```
EdSight/
├── app/                    # Main Django application
│   ├── models.py          # Database models
│   ├── views.py           # Django views
│   ├── urls.py            # URL routing
│   ├── static/            # Static files (CSS, JS, images)
│   ├── templates/         # HTML templates
│   └── migrations/        # Database migrations
├── backend/               # FastAPI backend
│   └── main.py           # FastAPI application
├── config/               # Django settings
├── database_updates/     # Database migration scripts
├── frontend/             # Frontend assets
└── requirements.txt      # Python dependencies
```

## 🛠️ Installation

### Prerequisites
- Python 3.8+
- MariaDB/MySQL
- Redis (for caching)
- Node.js (for frontend development)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/isaackcz/Edsight.git
   cd EdSight
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure database**
   - Create a MariaDB/MySQL database
   - Update database settings in `config/settings.py`

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start the development server**
   ```bash
   python manage.py runserver
   ```

## 🔧 Configuration

### Environment Variables
Create a `.env` file with the following variables:
```
DATABASE_URL=mysql://user:password@localhost/edsight
SECRET_KEY=your-secret-key
DEBUG=True
REDIS_URL=redis://localhost:6379/0
```

### Database Setup
The system includes comprehensive database migration scripts in the `database_updates/` directory.

## 📊 Features Overview

### User Management
- **Admin Users**: System administrators with full access
- **School Users**: Educational institution administrators
- **Regular Users**: Standard system users
- **Role-based Access Control**: Granular permissions system

### Form Management
- **Dynamic Forms**: Create custom forms for data collection
- **Question Types**: Multiple choice, text, numeric, and more
- **Data Validation**: Comprehensive input validation
- **Sub-questions**: Hierarchical question structures

### Analytics & Reporting
- **Real-time Analytics**: Live data analysis and visualization
- **Custom Reports**: Generate reports based on specific criteria
- **Data Export**: Export data in various formats
- **Statistical Analysis**: Advanced statistical computations

### Security Features
- **Two-Factor Authentication**: Enhanced security for sensitive accounts
- **Audit Logging**: Comprehensive activity tracking
- **Session Management**: Secure session handling
- **Data Encryption**: Sensitive data encryption at rest

## 🚀 Deployment

### Production Setup
1. Configure production database
2. Set up Redis for caching
3. Configure static file serving
4. Set up SSL/TLS certificates
5. Configure load balancing (for high-traffic scenarios)

### Performance Optimization
- Database query optimization
- Redis caching implementation
- Static file CDN integration
- Database connection pooling

## 📝 API Documentation

The system provides RESTful APIs for:
- User authentication and management
- Form data submission and retrieval
- Analytics data access
- Report generation

API documentation is available at `/api/docs/` when running the FastAPI backend.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `database_updates/` directory
- Review the implementation guides in the project files

## 🔄 Recent Updates

- Enhanced security with 2FA implementation
- Improved analytics dashboard
- Optimized database queries
- Added comprehensive audit logging
- Implemented Progressive Web App features

---

**EdSight** - Empowering Education Through Data
