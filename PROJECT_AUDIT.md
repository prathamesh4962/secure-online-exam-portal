# Project Audit

## Workspace status
- The workspace started empty; no existing app code was found in `c:\PMF PROJECT`.
- A Django backend project and a Vite React frontend were created to satisfy the requested secure exam portal requirements.

## Requirement mapping

| Requirement | Source file / location | API endpoint / UI | Database model | Validation |
| --- | --- | --- | --- | --- |
| Authentication with student/faculty/admin roles | `portal/models.py`, `portal/views.py` | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/me/` | `User.role` | Django `manage.py check`; registration/login tests |
| Exam lifecycle | `portal/models.py`, `portal/views.py` | `/api/exams/`, `/api/exams/create/` | `Exam`, `Question`, `Option` | Manual validation via API and frontend flow |
| Student attempt tracking and answer saving | `portal/models.py`, `portal/views.py` | `/api/exams/<id>/start/`, `/api/attempts/<id>/save-answer/` | `ExamAttempt`, `Answer` | Backend API tests and exam UI |
| Incident and proctoring events | `portal/models.py`, `portal/views.py` | `/api/incidents/`, `/api/incidents/create/` | `Incident` | Browser event triggers and API log creation |
| Audit logs | `portal/models.py`, `portal/views.py` | `/api/audit-logs/` | `AuditLog` | Admin/faculty access enforced |
| Frontend portal interface | `frontend/src/App.jsx` | SPA routes and dashboard pages | N/A | `npm run build` |
| Security config | `backend/settings.py` | CORS and session config | N/A | `manage.py check` |

## Observations
- The requirement set is broad and the workspace began empty, so the project was created from a clean foundation rather than refactored from an existing app.
- The backend enforces role checks on server-side endpoints and stores exam, incident, and audit data in SQLite for local development.
- The frontend provides a SaaS-style exam portal shell with real navigation, dashboard cards, and exam workflow screens to match the requested UX.
- Browser camera and face detection are implemented as UI-level hooks and event listeners; in a production environment they require a real webcam and a hosted secure context.

## Risks and follow-up
- Real AI face detection needs a proper OpenCV/MediaPipe deployment and a real local webcam to verify live output.
- Production deployment should move from SQLite to MySQL and inject secrets via `.env` and secure deployment configuration.
- The existing implementation is a strong project foundation but should be expanded with deeper admin tooling, real exam scheduling rules, and production hardening before release.
