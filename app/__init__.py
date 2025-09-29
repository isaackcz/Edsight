from __future__ import annotations

import os

# Initialize Celery app for Django project (only when running in Docker/with Celery)
try:
    from celery import Celery
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    
    celery_app = Celery('edsight')
    celery_app.config_from_object('django.conf:settings', namespace='CELERY')
    celery_app.autodiscover_tasks()
    
    __all__ = ("celery_app",)
except ImportError:
    # Celery not available (running outside Docker)
    celery_app = None
    __all__ = ()
