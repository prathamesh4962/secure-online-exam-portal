from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .models import User

DEMO_ACCOUNTS = (
    ('vedant', 'vedant@example.com', 'DemoPass123!', 'student'),
    ('faculty', 'faculty@example.com', 'FacultyPass123!', 'faculty'),
    ('admin', 'admin@example.com', 'AdminPass123!', 'admin'),
)


@receiver(post_migrate)
def ensure_demo_accounts(sender, **kwargs):
    if sender.label != 'portal':
        return

    for username, email, password, role in DEMO_ACCOUNTS:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'role': role},
        )

        if not created:
            user.email = email
            user.role = role

        user.set_password(password)
        user.is_staff = role == 'admin'
        user.is_superuser = role == 'admin'
        user.save(update_fields=['email', 'role', 'password', 'is_staff', 'is_superuser'])
