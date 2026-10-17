from django.urls import path

from . import views

urlpatterns = [
    path('csrf/', views.csrf, name='csrf'),
    path('auth/register/', views.register_view, name='register'),
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.me_view, name='me'),
    path('users/', views.user_management_list_view, name='user-list'),
    path('users/create/', views.user_management_create_view, name='user-create'),
    path('users/<int:user_id>/delete/', views.user_management_delete_view, name='user-delete'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('exams/', views.exam_list_view, name='exam-list'),
    path('exams/create/', views.create_exam_view, name='exam-create'),
    path('exams/<int:exam_id>/', views.exam_detail_view, name='exam-detail'),
    path('exams/<int:exam_id>/start/', views.start_exam_view, name='exam-start'),
    path('attempts/', views.my_attempts_view, name='attempts'),
    path('attempts/<int:attempt_id>/save-answer/', views.save_answer_view, name='save-answer'),
    path('attempts/<int:attempt_id>/submit/', views.submit_exam_view, name='submit-exam'),
    path('incidents/', views.incident_list_view, name='incident-list'),
    path('incidents/<int:incident_id>/review/', views.incident_review_view, name='incident-review'),
    path('incidents/create/', views.incident_create_view, name='incident-create'),
    path('proctoring/analyze/', views.proctoring_analysis_view, name='proctoring-analyze'),
    path('proctoring/summary/', views.proctoring_summary_view, name='proctoring-summary'),
    path('audit-logs/', views.audit_logs_view, name='audit-logs'),
]
