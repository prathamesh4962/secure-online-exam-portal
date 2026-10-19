from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_STUDENT = 'student'
    ROLE_FACULTY = 'faculty'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [
        (ROLE_STUDENT, 'Student'),
        (ROLE_FACULTY, 'Faculty'),
        (ROLE_ADMIN, 'Administrator'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    phone = models.CharField(max_length=20, blank=True, default='')

    def __str__(self):
        return f'{self.username} ({self.role})'


class Exam(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_PUBLISHED = 'published'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PUBLISHED, 'Published'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=100, default='General')
    duration_minutes = models.PositiveIntegerField(default=60)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    total_marks = models.PositiveIntegerField(default=100)
    negative_marking = models.DecimalField(max_digits=4, decimal_places=2, default=0.00)
    max_suspicious_activity = models.PositiveIntegerField(default=3, help_text='Max camera/microphone suspicious events allowed before the attempt is flagged.')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_exams')
    eligible_students = models.ManyToManyField(User, related_name='eligible_exams', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Question(models.Model):
    QUESTION_TYPE_MCQ = 'mcq'
    QUESTION_TYPE_CHOICES = [(QUESTION_TYPE_MCQ, 'Multiple choice')]

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    marks = models.FloatField(default=1)
    negative_mark = models.FloatField(default=0)
    order = models.PositiveIntegerField(default=1)
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, default=QUESTION_TYPE_MCQ)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.exam.title} - Q{self.order}'


class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.text


class ExamAttempt(models.Model):
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_SUBMITTED = 'submitted'
    STATUS_FLAGGED = 'flagged'
    SUBMISSION_MANUAL = 'MANUAL'
    SUBMISSION_MAX_WARNINGS_REACHED = 'MAX_WARNINGS_REACHED'
    SUBMISSION_TIME_EXPIRED = 'TIME_EXPIRED'
    STATUS_CHOICES = [
        (STATUS_IN_PROGRESS, 'In progress'),
        (STATUS_SUBMITTED, 'Submitted'),
        (STATUS_FLAGGED, 'Flagged'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exam_attempts')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='attempts')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    score = models.FloatField(default=0)
    warning_count = models.PositiveSmallIntegerField(default=0)
    submission_reason = models.CharField(max_length=32, blank=True, default='')
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        unique_together = ('student', 'exam')

    def __str__(self):
        return f'{self.student.username} - {self.exam.title}'


class Answer(models.Model):
    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(Option, on_delete=models.SET_NULL, null=True, blank=True)
    marked_for_review = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('attempt', 'question')


class Incident(models.Model):
    CATEGORY_TAB_SWITCH = 'tab_switch'
    CATEGORY_COPY_PASTE = 'copy_paste'
    CATEGORY_FACE_MISSING = 'face_missing'
    CATEGORY_FACE_MOVEMENT = 'face_movement'
    CATEGORY_MULTIPLE_FACES = 'multiple_faces'
    CATEGORY_CAMERA_ERROR = 'camera_error'
    CATEGORY_MICROPHONE_ACTIVITY = 'microphone_activity'
    CATEGORY_POLICY = 'policy_violation'
    CATEGORY_TECHNICAL = 'technical_failure'
    CATEGORY_CHOICES = [
        (CATEGORY_TAB_SWITCH, 'Tab switch'),
        (CATEGORY_COPY_PASTE, 'Copy/paste'),
        (CATEGORY_FACE_MISSING, 'Face missing'),
        (CATEGORY_FACE_MOVEMENT, 'Face movement'),
        (CATEGORY_MULTIPLE_FACES, 'Multiple faces'),
        (CATEGORY_CAMERA_ERROR, 'Camera error'),
        (CATEGORY_MICROPHONE_ACTIVITY, 'Microphone activity'),
        (CATEGORY_POLICY, 'Policy violation'),
        (CATEGORY_TECHNICAL, 'Technical failure'),
    ]

    SEVERITY_LOW = 'low'
    SEVERITY_MEDIUM = 'medium'
    SEVERITY_HIGH = 'high'
    SEVERITY_CRITICAL = 'critical'
    SEVERITY_CHOICES = [
        (SEVERITY_LOW, 'Low'),
        (SEVERITY_MEDIUM, 'Medium'),
        (SEVERITY_HIGH, 'High'),
        (SEVERITY_CRITICAL, 'Critical'),
    ]

    REVIEW_PENDING = 'pending'
    REVIEW_REVIEWED = 'reviewed'
    REVIEW_DISMISSED = 'dismissed'
    REVIEW_STATUS_CHOICES = [
        (REVIEW_PENDING, 'Pending'),
        (REVIEW_REVIEWED, 'Reviewed'),
        (REVIEW_DISMISSED, 'Dismissed'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incidents')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='incidents')
    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name='incidents', null=True, blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default=SEVERITY_MEDIUM)
    source = models.CharField(max_length=50, default='browser')
    details = models.JSONField(default=dict, blank=True)
    event_id = models.CharField(max_length=64, blank=True, null=True, unique=True)
    review_status = models.CharField(max_length=20, choices=REVIEW_STATUS_CHOICES, default=REVIEW_PENDING)
    reviewer_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if (
            self.attempt is not None
            and self.attempt.status not in {'submitted', 'flagged'}
            and self.severity in {'high', 'critical'}
        ):
            self.attempt.status = 'flagged'
            self.attempt.save(update_fields=['status'])


class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='audit_logs', null=True, blank=True)
    action = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    target_id = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.action} - {self.model_name}'
