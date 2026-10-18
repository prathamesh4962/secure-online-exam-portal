from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portal', '0002_exam_max_suspicious_activity'),
    ]

    operations = [
        migrations.AddField(
            model_name='examattempt',
            name='warning_count',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='examattempt',
            name='submission_reason',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='incident',
            name='event_id',
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
    ]