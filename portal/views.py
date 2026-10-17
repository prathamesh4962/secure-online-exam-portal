from collections import Counter

from django.contrib import auth
from django.contrib.auth import authenticate, login, logout
from django.db import models
from django.db.models import Avg
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Answer, AuditLog, Exam, ExamAttempt, Incident, Option, Question, User
from .proctoring_service import analyze_frame


def maybe_flag_attempt(attempt, severity):
    if attempt is None:
        return

    suspicious_categories = {'face_missing', 'camera_error', 'technical_failure'}
    suspicious_sources = {'camera', 'microphone'}
    incident_count = Incident.objects.filter(attempt=attempt).filter(
        models.Q(category__in=suspicious_categories) | models.Q(source__in=suspicious_sources)
    ).count()
    threshold = attempt.exam.max_suspicious_activity if attempt.exam else 3

    if severity in {'high', 'critical'} or incident_count >= threshold:
        if attempt.status != 'flagged':
            attempt.status = 'flagged'
            attempt.save(update_fields=['status'])


def build_proctoring_summary(incidents):
    incidents = list(incidents.order_by('-created_at')[:50])
    category_counts = Counter(item.category for item in incidents)
    severity_counts = Counter(item.severity for item in incidents)
    total = len(incidents)

    score = (
        category_counts.get('tab_switch', 0) * 16 +
        category_counts.get('copy_paste', 0) * 20 +
        category_counts.get('face_missing', 0) * 28 +
        category_counts.get('camera_error', 0) * 25 +
        severity_counts.get('critical', 0) * 25 +
        severity_counts.get('high', 0) * 15 +
        severity_counts.get('medium', 0) * 6 +
        total * 4
    )
    risk_score = min(100, score)

    if risk_score >= 75:
        risk_level = 'High'
    elif risk_score >= 40:
        risk_level = 'Medium'
    else:
        risk_level = 'Low'

    return {
        'total_events': total,
        'risk_score': risk_score,
        'risk_level': risk_level,
        'categories': dict(category_counts),
        'severity': dict(severity_counts),
        'latest_event': incidents[0].created_at.isoformat() if incidents else None,
    }


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def csrf(request):
    return Response({'detail': 'CSRF ready', 'csrf_token': get_token(request)})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    username = (request.data.get('username') or '').strip()
    email = (request.data.get('email') or '').strip()
    password = request.data.get('password') or ''
    role = 'student'

    if not username or not password or not email:
        return Response({'detail': 'Username, email, and password are required.'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'detail': 'Username already exists.'}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({'detail': 'Email already exists.'}, status=400)
    user = User.objects.create_user(username=username, email=email, password=password, role=role)
    login(request, user)
    AuditLog.objects.create(actor=user, action='register', model_name='User', target_id=str(user.id), details={'role': role})
    return Response({'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role}}, status=201)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'detail': 'Invalid credentials.'}, status=401)
    login(request, user)
    AuditLog.objects.create(actor=user, action='login', model_name='User', target_id=str(user.id), details={})
    return Response({'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role}})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': 'Logged out successfully.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    return Response({'user': {'id': request.user.id, 'username': request.user.username, 'email': request.user.email, 'role': request.user.role}})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_management_list_view(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Only administrators can manage users.'}, status=403)

    users = User.objects.all().order_by('username')
    return Response({
        'users': [{
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'phone': user.phone,
        } for user in users]
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def user_management_create_view(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Only administrators can create users.'}, status=403)

    username = (request.data.get('username') or '').strip()
    email = (request.data.get('email') or '').strip()
    password = request.data.get('password') or ''
    role = (request.data.get('role') or 'student').strip()

    if not username or not password or not email:
        return Response({'detail': 'Username, email, and password are required.'}, status=400)
    if role not in {'student', 'faculty', 'admin'}:
        return Response({'detail': 'Invalid role selected.'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'detail': 'Username already exists.'}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({'detail': 'Email already exists.'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password, role=role)
    AuditLog.objects.create(
        actor=request.user,
        action='create_user',
        model_name='User',
        target_id=str(user.id),
        details={'role': role},
    )
    return Response({
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'phone': user.phone,
        }
    }, status=201)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def user_management_delete_view(request, user_id):
    if request.user.role != 'admin':
        return Response({'detail': 'Only administrators can delete users.'}, status=403)

    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return Response({'detail': 'User not found.'}, status=404)
    if user.id == request.user.id:
        return Response({'detail': 'You cannot delete your own administrator account.'}, status=400)

    username = user.username
    user.delete()
    AuditLog.objects.create(
        actor=request.user,
        action='delete_user',
        model_name='User',
        target_id=str(user_id),
        details={'deleted_username': username},
    )
    return Response({'detail': f'User {username} removed.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_view(request):
    if request.user.role == 'student':
        submitted_attempts = ExamAttempt.objects.filter(student=request.user, status='submitted')
        average_score = submitted_attempts.aggregate(avg=Avg('score'))['avg'] or 0
        return Response({
            'role': 'student',
            'stats': {
                'exams_available': Exam.objects.filter(status='published').count(),
                'attempted': ExamAttempt.objects.filter(student=request.user).count(),
                'incidents': Incident.objects.filter(student=request.user).count(),
                'average_score': round(float(average_score), 2),
            },
            'analytics': {
                'score_trend': [
                    {'name': 'Quiz 1', 'score': max(0, min(100, round(float(average_score or 65), 0)))},
                    {'name': 'Quiz 2', 'score': max(0, min(100, round(float(average_score or 70) + 8, 0)))},
                    {'name': 'Quiz 3', 'score': max(0, min(100, round(float(average_score or 75) + 12, 0)))},
                ],
                'outcome_mix': [
                    {'name': 'Passed', 'value': 70},
                    {'name': 'Flagged', 'value': 18},
                    {'name': 'Pending', 'value': 12},
                ],
            },
        })

    if request.user.role == 'faculty':
        attempts = ExamAttempt.objects.filter(exam__created_by=request.user).order_by('-started_at')[:5]
        trend = [{
            'name': 'Attempt ' + str(index + 1),
            'score': round(float(attempt.score or 0), 0),
        } for index, attempt in enumerate(attempts)] or [{'name': 'No data', 'score': 0}]
        incident_counts = Counter(Incident.objects.filter(exam__created_by=request.user).values_list('severity', flat=True))
        mix = [
            {'name': 'Passed', 'value': sum(1 for attempt in attempts if float(attempt.score or 0) >= 60)},
            {'name': 'Flagged', 'value': sum(1 for attempt in attempts if attempt.status == 'flagged')},
            {'name': 'Pending', 'value': max(0, len(attempts) - sum(1 for attempt in attempts if float(attempt.score or 0) >= 60) - sum(1 for attempt in attempts if attempt.status == 'flagged'))},
        ]
        return Response({
            'role': 'faculty',
            'stats': {
                'created_exams': Exam.objects.filter(created_by=request.user).count(),
                'attempts': ExamAttempt.objects.filter(exam__created_by=request.user).count(),
                'incidents': Incident.objects.filter(exam__created_by=request.user).count(),
            },
            'analytics': {
                'score_trend': trend,
                'outcome_mix': mix if attempts else [
                    {'name': 'Passed', 'value': 0},
                    {'name': 'Flagged', 'value': 0},
                    {'name': 'Pending', 'value': 0},
                ],
                'incident_breakdown': [
                    {'name': key.title(), 'value': value} for key, value in sorted(incident_counts.items())
                ],
            },
        })

    attempts = ExamAttempt.objects.all().order_by('-started_at')[:6]
    trend = [{
        'name': str(attempt.student.username[:10]) if attempt.student.username else 'Student',
        'score': round(float(attempt.score or 0), 0),
    } for attempt in attempts] or [{'name': 'No data', 'score': 0}]
    mix = [
        {'name': 'Passed', 'value': ExamAttempt.objects.filter(status='submitted', score__gte=60).count()},
        {'name': 'Flagged', 'value': ExamAttempt.objects.filter(status='flagged').count()},
        {'name': 'Pending', 'value': ExamAttempt.objects.filter(status='in_progress').count()},
    ]
    return Response({
        'role': 'admin',
        'stats': {
            'students': User.objects.filter(role='student').count(),
            'faculty': User.objects.filter(role='faculty').count(),
            'exams': Exam.objects.count(),
            'incidents': Incident.objects.count(),
        },
        'analytics': {
            'score_trend': trend,
            'outcome_mix': mix,
            'incident_breakdown': [
                {'name': category, 'value': count}
                for category, count in Counter(Incident.objects.values_list('category', flat=True)).most_common(5)
            ],
        },
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def exam_list_view(request):
    if request.user.role == 'faculty':
        exams = Exam.objects.filter(created_by=request.user).order_by('-created_at')
    elif request.user.role == 'admin':
        exams = Exam.objects.all().order_by('-created_at')
    else:
        exams = Exam.objects.filter(status='published').order_by('-created_at')

    payload = []
    for exam in exams:
        payload.append({
            'id': exam.id,
            'title': exam.title,
            'description': exam.description,
            'subject': exam.subject,
            'duration_minutes': exam.duration_minutes,
            'max_suspicious_activity': exam.max_suspicious_activity,
            'start_time': exam.start_time.isoformat(),
            'end_time': exam.end_time.isoformat(),
            'status': exam.status,
            'total_marks': exam.total_marks,
            'negative_marking': float(exam.negative_marking),
            'questions': [{
                'id': q.id,
                'text': q.text,
                'marks': q.marks,
                'negative_mark': q.negative_mark,
                'order': q.order,
                'options': [{'id': o.id, 'text': o.text, 'order': o.order, 'is_correct': o.is_correct} for o in q.options.all()],
            } for q in exam.questions.all()],
        })
    return Response(payload)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def exam_detail_view(request, exam_id):
    exam = Exam.objects.get(pk=exam_id)
    if request.user.role == 'student' and exam.status != 'published':
        return Response({'detail': 'Exam is unavailable.'}, status=403)

    questions = []
    for q in exam.questions.all():
        questions.append({
            'id': q.id,
            'text': q.text,
            'marks': q.marks,
            'negative_mark': q.negative_mark,
            'order': q.order,
            'options': [{'id': o.id, 'text': o.text, 'order': o.order} for o in q.options.all()],
        })

    return Response({
        'id': exam.id,
        'title': exam.title,
        'description': exam.description,
        'subject': exam.subject,
        'duration_minutes': exam.duration_minutes,
        'start_time': exam.start_time.isoformat(),
        'end_time': exam.end_time.isoformat(),
        'status': exam.status,
        'total_marks': exam.total_marks,
        'negative_marking': float(exam.negative_marking),
        'questions': questions,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_exam_view(request):
    if request.user.role not in {'faculty', 'admin'}:
        return Response({'detail': 'Only faculty and admins can create exams.'}, status=403)

    title = request.data.get('title')
    description = request.data.get('description', '')
    subject = request.data.get('subject', 'General')
    duration_minutes = int(request.data.get('duration_minutes', 60))
    max_suspicious_activity = int(request.data.get('max_suspicious_activity', 3))
    start_time = request.data.get('start_time')
    end_time = request.data.get('end_time')
    questions = request.data.get('questions', [])

    if not title or not start_time or not end_time:
        return Response({'detail': 'title, start_time, and end_time are required.'}, status=400)
    if max_suspicious_activity < 1:
        return Response({'detail': 'max_suspicious_activity must be at least 1.'}, status=400)

    exam = Exam.objects.create(
        title=title,
        description=description,
        subject=subject,
        duration_minutes=duration_minutes,
        max_suspicious_activity=max_suspicious_activity,
        start_time=start_time,
        end_time=end_time,
        status='published',
        created_by=request.user,
    )

    for idx, question_data in enumerate(questions, start=1):
        question = Question.objects.create(
            exam=exam,
            text=question_data.get('text', ''),
            marks=float(question_data.get('marks', 1)),
            negative_mark=float(question_data.get('negative_mark', 0)),
            order=idx,
        )
        for option_index, option_data in enumerate(question_data.get('options', []), start=1):
            Option.objects.create(
                question=question,
                text=option_data.get('text', ''),
                is_correct=bool(option_data.get('is_correct', False)),
                order=option_index,
            )

    AuditLog.objects.create(
        actor=request.user,
        action='create_exam',
        model_name='Exam',
        target_id=str(exam.id),
        details={'title': title, 'max_suspicious_activity': max_suspicious_activity},
    )
    return Response({'id': exam.id, 'title': exam.title, 'status': exam.status, 'max_suspicious_activity': exam.max_suspicious_activity}, status=201)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_exam_view(request, exam_id):
    if request.user.role != 'student':
        return Response({'detail': 'Only students can start an exam.'}, status=403)

    exam = Exam.objects.get(pk=exam_id)
    if exam.status != 'published':
        return Response({'detail': 'Exam is not published.'}, status=400)
    now = timezone.now()
    if now < exam.start_time or now > exam.end_time:
        return Response({'detail': 'Exam is outside its scheduled window.'}, status=400)
    if exam.eligible_students.exists() and not exam.eligible_students.filter(id=request.user.id).exists():
        return Response({'detail': 'You are not eligible to take this exam.'}, status=403)

    attempt, created = ExamAttempt.objects.get_or_create(student=request.user, exam=exam, defaults={'status': 'in_progress'})
    if not created and attempt.status == 'submitted':
        return Response({'detail': 'You have already submitted this exam.'}, status=400)
    attempt.status = 'in_progress'
    attempt.save(update_fields=['status'])
    return Response({'attempt_id': attempt.id, 'status': attempt.status, 'started_at': attempt.started_at.isoformat()})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def save_answer_view(request, attempt_id):
    if request.user.role != 'student':
        return Response({'detail': 'Only students can answer questions.'}, status=403)
    attempt = ExamAttempt.objects.get(pk=attempt_id, student=request.user)
    question_id = request.data.get('question_id')
    option_id = request.data.get('option_id')
    marked_for_review = bool(request.data.get('marked_for_review'))

    if question_id is None:
        return Response({'detail': 'Question id is required.'}, status=400)

    question = Question.objects.get(pk=question_id, exam=attempt.exam)
    option = None
    if option_id is not None:
        option = Option.objects.get(pk=option_id, question=question)

    answer, _ = Answer.objects.update_or_create(
        attempt=attempt,
        question=question,
        defaults={'selected_option': option, 'marked_for_review': marked_for_review},
    )
    return Response({'id': answer.id, 'question_id': question.id})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_exam_view(request, attempt_id):
    if request.user.role != 'student':
        return Response({'detail': 'Only students can submit exams.'}, status=403)

    attempt = ExamAttempt.objects.get(pk=attempt_id, student=request.user)
    if attempt.status == 'submitted':
        return Response({'detail': 'Exam already submitted.'}, status=400)

    score = 0
    for answer in attempt.answers.select_related('question', 'selected_option'):
        if answer.selected_option is None:
            continue
        if answer.selected_option.is_correct:
            score += float(answer.question.marks)
        else:
            score -= float(answer.question.negative_mark)
    if score < 0:
        score = 0

    attempt.score = score
    attempt.status = 'submitted'
    attempt.submitted_at = timezone.now()
    attempt.save(update_fields=['score', 'status', 'submitted_at'])

    AuditLog.objects.create(actor=request.user, action='submit_exam', model_name='ExamAttempt', target_id=str(attempt.id), details={'score': score})
    return Response({'attempt_id': attempt.id, 'score': round(score, 2), 'status': attempt.status})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_attempts_view(request):
    attempts = ExamAttempt.objects.filter(student=request.user).select_related('exam').order_by('-started_at')
    data = [{
        'id': attempt.id,
        'exam': {'id': attempt.exam.id, 'title': attempt.exam.title},
        'status': attempt.status,
        'score': attempt.score,
        'started_at': attempt.started_at.isoformat(),
        'submitted_at': attempt.submitted_at.isoformat() if attempt.submitted_at else None,
    } for attempt in attempts]
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def incident_list_view(request):
    if request.user.role == 'student':
        incidents = Incident.objects.filter(student=request.user).order_by('-created_at')
    else:
        incidents = Incident.objects.all().order_by('-created_at')
    payload = [{
        'id': incident.id,
        'student': incident.student.username,
        'exam': incident.exam.title,
        'attempt_id': incident.attempt_id,
        'category': incident.category,
        'severity': incident.severity,
        'source': incident.source,
        'details': incident.details,
        'review_status': incident.review_status,
        'reviewer_notes': incident.reviewer_notes,
        'created_at': incident.created_at.isoformat(),
    } for incident in incidents]
    return Response(payload)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def incident_review_view(request, incident_id):
    if request.user.role not in {'faculty', 'admin'}:
        return Response({'detail': 'Only faculty and admins can review incidents.'}, status=403)

    incident = Incident.objects.get(pk=incident_id)
    review_status = request.data.get('review_status')
    reviewer_notes = request.data.get('reviewer_notes', incident.reviewer_notes)
    severity = request.data.get('severity', incident.severity)

    if review_status in {choice[0] for choice in Incident.REVIEW_STATUS_CHOICES}:
        incident.review_status = review_status
    if severity in {choice[0] for choice in Incident.SEVERITY_CHOICES}:
        incident.severity = severity
    incident.reviewer_notes = reviewer_notes
    incident.save(update_fields=['review_status', 'reviewer_notes', 'severity'])

    AuditLog.objects.create(
        actor=request.user,
        action='review_incident',
        model_name='Incident',
        target_id=str(incident.id),
        details={'status': incident.review_status, 'severity': incident.severity},
    )
    return Response({'status': 'updated', 'review_status': incident.review_status, 'severity': incident.severity})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def incident_create_view(request):
    if request.user.role != 'student':
        return Response({'detail': 'Incidents are created by students during exams.'}, status=403)
    exam_id = request.data.get('exam_id')
    attempt_id = request.data.get('attempt_id')
    category = request.data.get('category', 'policy_violation')
    severity = request.data.get('severity', 'medium')
    source = request.data.get('source', 'browser')
    details = request.data.get('details', {})

    if not exam_id:
        return Response({'detail': 'exam_id is required.'}, status=400)
    exam = Exam.objects.get(pk=exam_id)
    attempt = None
    if attempt_id:
        attempt = ExamAttempt.objects.filter(pk=attempt_id, student=request.user).first()

    incident = Incident.objects.create(
        student=request.user,
        exam=exam,
        attempt=attempt,
        category=category,
        severity=severity,
        source=source,
        details=details,
    )
    maybe_flag_attempt(attempt, incident.severity)
    return Response({'id': incident.id, 'status': 'created'}, status=201)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def proctoring_analysis_view(request):
    if request.user.role != 'student':
        return Response({'detail': 'Only students can analyze proctoring frames.'}, status=403)

    payload = request.data or {}
    image_data = payload.get('image') or payload.get('image_data') or payload.get('frame')
    if not image_data:
        return Response({'detail': 'A webcam frame is required.'}, status=400)

    result = analyze_frame(image_data)
    if result.get('status') == 'warning':
        exam_id = payload.get('exam_id')
        attempt_id = payload.get('attempt_id')
        exam = Exam.objects.filter(pk=exam_id).first() if exam_id else None
        attempt = None
        if attempt_id:
            attempt = ExamAttempt.objects.filter(pk=attempt_id, student=request.user).first()
        if exam:
            severity = 'high' if not result.get('face_detected') else 'medium'
            incident = Incident.objects.create(
                student=request.user,
                exam=exam,
                attempt=attempt,
                category='face_missing' if not result.get('face_detected') else 'technical_failure',
                severity=severity,
                source='camera',
                details=result,
            )
            maybe_flag_attempt(attempt, incident.severity)

    return Response(result)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def proctoring_summary_view(request):
    attempt_id = request.query_params.get('attempt_id')
    if request.user.role == 'student':
        incidents = Incident.objects.filter(student=request.user)
    else:
        incidents = Incident.objects.all()

    if attempt_id:
        incidents = incidents.filter(attempt_id=attempt_id)

    return Response(build_proctoring_summary(incidents))


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def audit_logs_view(request):
    if request.user.role not in {'faculty', 'admin'}:
        return Response({'detail': 'Only faculty/admin can access audit logs.'}, status=403)
    logs = AuditLog.objects.order_by('-created_at')[:50]
    payload = [{
        'id': log.id,
        'actor': log.actor.username if log.actor else 'system',
        'action': log.action,
        'model_name': log.model_name,
        'target_id': log.target_id,
        'details': log.details,
        'created_at': log.created_at.isoformat(),
    } for log in logs]
    return Response(payload)
