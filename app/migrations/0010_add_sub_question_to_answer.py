# Generated manually for sub-question support

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0009_auto_20250814_0953'),
    ]

    operations = [
        migrations.AddField(
            model_name='answer',
            name='sub_question',
            field=models.ForeignKey(blank=True, db_column='sub_question_id', null=True, on_delete=django.db.models.deletion.CASCADE, to='app.subquestion'),
        ),
        migrations.AddIndex(
            model_name='answer',
            index=models.Index(fields=['sub_question'], name='idx_answers_sub_question'),
        ),
    ]