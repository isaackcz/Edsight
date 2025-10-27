from celery import shared_task
import redis
import json
from django.conf import settings
from django.db import connection

r = redis.Redis(
    host=getattr(settings, 'REDIS_HOST', 'localhost'),
    port=getattr(settings, 'REDIS_PORT', 6379),
    db=getattr(settings, 'REDIS_DB', 0)
)

@shared_task
def flush_forms():
    count = 0
    while True:
        form_json = r.lpop('form_submissions')
        if not form_json:
            break
        form_data = json.loads(form_json)
        # Save form_data to MariaDB
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO forms (school_id, status) VALUES (%s, %s)",
                [form_data['school_id'], form_data['status']]
            )
            form_id = cursor.lastrowid
            for answer in form_data['answers']:
                cursor.execute(
                    "INSERT INTO answers (form_id, question_id, response) VALUES (%s, %s, %s)",
                    [form_id, answer['question_id'], answer['response']]
                )
        count += 1
    return {'forms_flushed': count} 