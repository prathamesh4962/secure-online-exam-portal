from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from .models import Exam, ExamAttempt, Incident, Option, Question, User


class AuthFlowTests(TestCase):
    def test_user_can_be_created_with_role(self):
        user = User.objects.create_user(username='student01', email='student01@example.com', password='SecurePass123', role='student')
        self.assertEqual(user.role, 'student')
        self.assertTrue(user.check_password('SecurePass123'))

    def test_public_registration_cannot_assign_privileged_roles(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'self_promoted',
                'email': 'self_promoted@example.com',
                'password': 'SecurePass123',
                'role': 'admin',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['user']['role'], 'student')

    def test_student_cannot_manage_users(self):
        student = User.objects.create_user(username='student_user_admin', email='student_user_admin@example.com', password='SecurePass123', role='student')
        self.client.force_login(student)

        list_response = self.client.get('/api/users/')
        create_response = self.client.post(
            '/api/users/create/',
            {'username': 'blocked_user', 'email': 'blocked_user@example.com', 'password': 'SecurePass123', 'role': 'faculty'},
            content_type='application/json',
        )

        self.assertEqual(list_response.status_code, 403)
        self.assertEqual(create_response.status_code, 403)
        self.assertFalse(User.objects.filter(username='blocked_user').exists())

    def test_faculty_can_review_incident(self):
        faculty = User.objects.create_user(username='faculty01', email='faculty01@example.com', password='SecurePass123', role='faculty')
        student = User.objects.create_user(username='student02', email='student02@example.com', password='SecurePass123', role='student')
        exam = Exam.objects.create(
            title='Test Exam',
            description='Exam for review',
            subject='Cybersecurity',
            duration_minutes=30,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=30),
            created_by=faculty,
        )
        attempt = ExamAttempt.objects.create(student=student, exam=exam, status='in_progress')
        incident = Incident.objects.create(
            student=student,
            exam=exam,
            attempt=attempt,
            category='face_missing',
            severity='medium',
            source='camera',
            details={'detail': 'No face detected'},
        )

        self.client.force_login(faculty)
        response = self.client.patch(
            f'/api/incidents/{incident.id}/review/',
            {'review_status': 'reviewed', 'severity': 'high', 'reviewer_notes': 'Camera issue reviewed.'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        incident.refresh_from_db()
        self.assertEqual(incident.review_status, 'reviewed')
        self.assertEqual(incident.severity, 'high')

    def test_suspicious_incident_flags_attempt(self):
        faculty = User.objects.create_user(username='faculty02', email='faculty02@example.com', password='SecurePass123', role='faculty')
        student = User.objects.create_user(username='student03', email='student03@example.com', password='SecurePass123', role='student')
        exam = Exam.objects.create(
            title='Flagged Exam',
            description='Exam with suspicious behavior',
            subject='Cybersecurity',
            duration_minutes=30,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=30),
            created_by=faculty,
        )
        attempt = ExamAttempt.objects.create(student=student, exam=exam, status='in_progress')

        Incident.objects.create(
            student=student,
            exam=exam,
            attempt=attempt,
            category='face_missing',
            severity='high',
            source='camera',
            details={'detail': 'Repeated absent face'},
        )

        attempt.refresh_from_db()
        self.assertEqual(attempt.status, 'flagged')

    def test_exam_flags_after_max_suspicious_activity_limit(self):
        faculty = User.objects.create_user(username='faculty03', email='faculty03@example.com', password='SecurePass123', role='faculty')
        student = User.objects.create_user(username='student04', email='student04@example.com', password='SecurePass123', role='student')
        exam = Exam.objects.create(
            title='Limited Suspicion Exam',
            description='Only three suspicious camera events allowed',
            subject='Cybersecurity',
            duration_minutes=30,
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(minutes=30),
            max_suspicious_activity=3,
            created_by=faculty,
        )
        attempt = ExamAttempt.objects.create(student=student, exam=exam, status='in_progress')

        for index in range(3):
            Incident.objects.create(
                student=student,
                exam=exam,
                attempt=attempt,
                category='camera_error' if index % 2 == 0 else 'face_missing',
                severity='medium',
                source='camera',
                details={'detail': f'Camera issue {index + 1}'},
            )

        attempt.refresh_from_db()
        self.assertEqual(attempt.status, 'flagged')

    def test_admin_can_manage_users(self):
        admin = User.objects.create_user(username='admin01', email='admin01@example.com', password='SecurePass123', role='admin')
        self.client.force_login(admin)

        response = self.client.post(
            '/api/users/create/',
            {'username': 'faculty_new', 'email': 'faculty_new@example.com', 'password': 'SecurePass123', 'role': 'faculty'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)

        created_id = response.json()['user']['id']
        self.assertTrue(User.objects.filter(pk=created_id, role='faculty').exists())

        list_response = self.client.get('/api/users/')
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(any(user['username'] == 'faculty_new' for user in list_response.json()['users']))

        delete_response = self.client.delete(f'/api/users/{created_id}/delete/')
        self.assertEqual(delete_response.status_code, 200)
        self.assertFalse(User.objects.filter(pk=created_id).exists())

    def test_student_can_start_save_answers_and_submit_exam(self):
        faculty = User.objects.create_user(username='faculty_submit', email='faculty_submit@example.com', password='SecurePass123', role='faculty')
        student = User.objects.create_user(username='student_submit', email='student_submit@example.com', password='SecurePass123', role='student')
        exam = Exam.objects.create(
            title='Submission Test Exam',
            duration_minutes=30,
            start_time=timezone.now() - timedelta(minutes=1),
            end_time=timezone.now() + timedelta(minutes=30),
            status='published',
            created_by=faculty,
        )
        question = Question.objects.create(exam=exam, text='Test question', marks=5, negative_mark=1, order=1)
        correct_option = Option.objects.create(question=question, text='Correct answer', is_correct=True, order=1)

        self.client.force_login(student)
        start_response = self.client.post(f'/api/exams/{exam.id}/start/')
        self.assertEqual(start_response.status_code, 200)
        attempt_id = start_response.json()['attempt_id']

        answer_response = self.client.post(
            f'/api/attempts/{attempt_id}/save-answer/',
            {'question_id': question.id, 'option_id': correct_option.id},
            content_type='application/json',
        )
        self.assertEqual(answer_response.status_code, 200)

        submit_response = self.client.post(f'/api/attempts/{attempt_id}/submit/')
        self.assertEqual(submit_response.status_code, 200)
        self.assertEqual(submit_response.json()['status'], 'submitted')
        self.assertEqual(submit_response.json()['score'], 5)

        attempt = ExamAttempt.objects.get(pk=attempt_id)
        self.assertEqual(attempt.status, 'submitted')
        self.assertEqual(attempt.score, 5)
        self.assertIsNotNone(attempt.submitted_at)
