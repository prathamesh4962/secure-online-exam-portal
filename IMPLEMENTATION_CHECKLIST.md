# Implementation Checklist

## Core project setup
- [x] Initialize the Django backend and configure project settings.
- [x] Initialize the Vite React frontend and required dependencies.
- [x] Create environment example file for secrets and configuration values.
- [x] Create a custom `User` model with student/faculty/admin roles.

## Secure backend functionality
- [x] Add session-authenticated API endpoints for registration and login.
- [x] Enforce server-side role checks for exam creation, submissions, and audit log access.
- [x] Add exam listing, exam detail, attempt, and incident APIs.
- [x] Add audit log recording for significant events.
- [x] Configure CORS and CSRF-friendly API settings for local frontend development.

## Frontend portal UX
- [x] Landing page with product positioning and call-to-action flow.
- [x] Role-aware login/register flow.
- [x] Student, faculty, and admin dashboards.
- [x] Exam instructions and pre-check workflow.
- [x] Active exam interface with question navigation, timer, and warnings.
- [x] Incident and results review screens.

## Proctoring features
- [x] Browser webcam permission and stream handling hooks.
- [x] Basic monitoring for tab switches, copy/paste, blur/focus, and keyboard shortcuts.
- [x] Incident creation endpoint for policy events.
- [x] UI warning state for suspicious exam activity.
- [ ] Connect a live OpenCV/MediaPipe pipeline to the browser in a production-ready secure environment.

## Testing and validation
- [x] Run Django system checks.
- [x] Run React production build.
- [ ] Add additional automated API and frontend tests for regression coverage.

## Production readiness
- [ ] Move from SQLite to MySQL for multi-user deployment.
- [ ] Add stronger deployment secrets management and HTTPS enforcement.
- [ ] Extend admin analytics, reporting, and automated exam moderation workflows.
