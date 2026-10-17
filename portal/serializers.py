from rest_framework import serializers

from .models import (
    Answer,
    AuditLog,
    Exam,
    ExamAttempt,
    Incident,
    Option,
    Question,
    User,
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'phone',
        ]


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'order']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'marks', 'negative_mark', 'order', 'options']


class ExamSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    eligible_students = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id',
            'title',
            'description',
            'subject',
            'duration_minutes',
            'max_suspicious_activity',
            'start_time',
            'end_time',
            'status',
            'total_marks',
            'negative_marking',
            'created_by',
            'eligible_students',
            'questions',
        ]


class OptionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['text', 'is_correct', 'order']


class QuestionWriteSerializer(serializers.ModelSerializer):
    options = OptionWriteSerializer(many=True)

    class Meta:
        model = Question
        fields = ['text', 'marks', 'negative_mark', 'order', 'options']


class ExamWriteSerializer(serializers.ModelSerializer):
    questions = QuestionWriteSerializer(many=True)
    eligible_students = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.filter(role='student'),
        required=False,
    )

    class Meta:
        model = Exam
        fields = [
            'title',
            'description',
            'subject',
            'duration_minutes',
            'max_suspicious_activity',
            'start_time',
            'end_time',
            'status',
            'total_marks',
            'negative_marking',
            'eligible_students',
            'questions',
        ]

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', [])
        eligible_students = validated_data.pop('eligible_students', [])
        exam = Exam.objects.create(created_by=self.context['request'].user, **validated_data)
        exam.eligible_students.set(eligible_students)

        for question_data in questions_data:
            options_data = question_data.pop('options', [])
            question = Question.objects.create(exam=exam, **question_data)
            for option_data in options_data:
                Option.objects.create(question=question, **option_data)
        return exam


class AnswerSerializer(serializers.ModelSerializer):
    selected_option = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Answer
        fields = ['id', 'question', 'selected_option', 'marked_for_review']


class ExamAttemptSerializer(serializers.ModelSerializer):
    exam = ExamSerializer(read_only=True)
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = ExamAttempt
        fields = ['id', 'exam', 'student', 'status', 'score', 'started_at', 'submitted_at', 'answers']


class IncidentSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)
    exam = ExamSerializer(read_only=True)

    class Meta:
        model = Incident
        fields = [
            'id',
            'student',
            'exam',
            'attempt',
            'category',
            'severity',
            'source',
            'details',
            'review_status',
            'reviewer_notes',
            'created_at',
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'actor', 'action', 'model_name', 'target_id', 'details', 'created_at']

