from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from .models import AuditLog, Exam, ExamAttempt, Incident, Option, Question, User


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

        repeated_submit = self.client.post(f'/api/attempts/{attempt_id}/submit/')
        self.assertEqual(repeated_submit.status_code, 200)
        self.assertTrue(repeated_submit.json()['already_submitted'])
        self.assertEqual(AuditLog.objects.filter(action='submit_exam', target_id=str(attempt_id)).count(), 1)


class CombinedWarningTests(TestCase):
    def setUp(self):
        faculty = User.objects.create_user(username='faculty_warnings', email='faculty_warnings@example.com', password='SecurePass123', role='faculty')
        self.student = User.objects.create_user(username='student_warnings', email='student_warnings@example.com', password='SecurePass123', role='student')
        self.exam = Exam.objects.create(
            title='Combined Warning Exam',
            duration_minutes=30,
            start_time=timezone.now() - timedelta(minutes=1),
            end_time=timezone.now() + timedelta(minutes=30),
            status='published',
            max_suspicious_activity=1,
            created_by=faculty,
        )
        self.question = Question.objects.create(exam=self.exam, text='Saved answer?', marks=5, order=1)
        self.option = Option.objects.create(question=self.question, text='Yes', is_correct=True, order=1)
        self.client.force_login(self.student)
        start = self.client.post(f'/api/exams/{self.exam.id}/start/')
        self.assertEqual(start.status_code, 200)
        self.attempt_id = start.json()['attempt_id']

    def report_warning(self, category, event_id, answers=None):
        return self.client.post(
            '/api/incidents/create/',
            {
                'exam_id': self.exam.id,
                'attempt_id': self.attempt_id,
                'event_id': event_id,
                'category': category,
                'severity': 'medium',
                'source': 'camera' if category == 'camera_error' else 'microphone' if category == 'microphone_activity' else 'browser',
                'details': {'message': f'{category} observed'},
                'answers': answers or [],
            },
            content_type='application/json',
        )

    def assert_warning_sequence_submits(self, categories):
        for index, category in enumerate(categories, start=1):
            answer_payload = [{'question_id': self.question.id, 'option_id': self.option.id}] if index == 3 else []
            response = self.report_warning(category, f'event-{index}', answer_payload)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()['warning_count'], index)
            self.assertEqual(response.json()['auto_submitted'], index == 3)

        attempt = ExamAttempt.objects.get(pk=self.attempt_id)
        self.assertEqual(attempt.status, ExamAttempt.STATUS_SUBMITTED)
        self.assertEqual(attempt.warning_count, 3)
        self.assertEqual(attempt.submission_reason, ExamAttempt.SUBMISSION_MAX_WARNINGS_REACHED)
        self.assertIsNotNone(attempt.submitted_at)
        self.assertEqual(attempt.answers.get(question=self.question).selected_option, self.option)
        self.assertEqual(Incident.objects.filter(attempt=attempt).count(), 3)
        self.assertEqual(AuditLog.objects.filter(action='submit_exam', target_id=str(attempt.id)).count(), 1)

    def test_camera_then_two_tab_switches_auto_submits(self):
        self.assert_warning_sequence_submits(['camera_error', 'tab_switch', 'tab_switch'])

    def test_microphone_camera_tab_switch_share_counter(self):
        self.assert_warning_sequence_submits(['microphone_activity', 'camera_error', 'tab_switch'])

    def test_three_separate_microphone_events_auto_submit(self):
        self.assert_warning_sequence_submits(['microphone_activity'] * 3)

    def test_duplicate_event_does_not_increment_and_refresh_restores_count(self):
        first = self.report_warning('tab_switch', 'stable-event-id')
        self.assertEqual(first.status_code, 201)
        second = self.report_warning('tab_switch', 'stable-event-id')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()['status'], 'duplicate')
        self.assertEqual(second.json()['warning_count'], 1)

        state = self.client.get(f'/api/exams/{self.exam.id}/attempt/')
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()['warning_count'], 1)
        self.assertEqual(len(state.json()['warnings']), 1)

    def test_warning_limit_is_three_even_when_exam_legacy_limit_differs(self):
        self.assertEqual(self.exam.max_suspicious_activity, 1)
        first = self.report_warning('camera_error', 'camera-1')
        second = self.report_warning('tab_switch', 'tab-2')
        self.assertEqual(first.json()['warning_count'], 1)
        self.assertEqual(second.json()['warning_count'], 2)
        self.assertEqual(ExamAttempt.objects.get(pk=self.attempt_id).status, ExamAttempt.STATUS_IN_PROGRESS)
