from django.contrib import admin

from .models import Answer, AuditLog, Exam, ExamAttempt, Incident, Option, Question, User

admin.site.register(User)
admin.site.register(Exam)
admin.site.register(Question)
admin.site.register(Option)
admin.site.register(ExamAttempt)
admin.site.register(Answer)
admin.site.register(Incident)
admin.site.register(AuditLog)
