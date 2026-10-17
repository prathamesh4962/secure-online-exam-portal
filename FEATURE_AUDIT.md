# Feature Audit - Secure Online Examination Portal

This audit was performed by inspecting the existing code, running backend tests, validating API behavior, and checking the live browser state. No code was modified during this audit.

## Summary table

| Requirement | Status | Evidence or Issue | Next Action |
|---|---|---|---|
| 1. Camera access and live webcam preview | Partially Working | The frontend requests camera access with `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` and renders a `<video>` element in [frontend/src/App.jsx](frontend/src/App.jsx). This is implemented in code, but actual camera permission and live-device behavior were not fully validated in this environment because the live exam UI is not currently stable. | Validate in a real browser with device permission granted and confirm the preview remains active during exam start. |
| 2. Real-time face detection using webcam frames | Partially Working | [portal/proctoring_service.py](portal/proctoring_service.py) decodes webcam frames and runs OpenCV Haar cascade detection. The API route in [portal/views.py](portal/views.py) calls this service. However, the live exam route is currently unstable, and no end-to-end webcam test was completed in-browser. | Test the webcam flow in a real browser and confirm live frame analysis returns stable `face_detected` and `face_confidence` data. |
| 3. Tab-switching and window-focus event detection | Partially Working | The exam room registers `visibilitychange` and `window.blur` listeners in [frontend/src/App.jsx](frontend/src/App.jsx). The code is present and logically correct, but the actual exam route crashes in the browser when `exam.questions` is undefined, so the live event detection path cannot be fully trusted without fixing that runtime issue. | Fix the exam-room runtime error and verify incidents are created when tab/window focus changes during an active exam. |
| 4. Copy/paste event detection and logging | Partially Working | The exam room blocks `copy`, `paste`, `cut`, and keyboard shortcuts using DOM listeners in [frontend/src/App.jsx](frontend/src/App.jsx), and sends incidents to `/api/incidents/create/`. This logic exists but was not fully validated in a live exam session because the exam room is unstable and we did not verify a real event-triggered incident in the live UI. | Reproduce the exam room flow, trigger a copy/paste event, and confirm the incident is logged and visible in the review queue. |
| 5. Database persistence of exam answers and incidents | Working | The data model includes `ExamAttempt`, `Answer`, and `Incident` in [portal/models.py](portal/models.py). The backend stores answers in `save_answer_view`, calculates exam results in `submit_exam_view`, and creates incidents in `create_incident_view` in [portal/views.py](portal/views.py). Verified by real Django-backed database execution: `ANSWER_COUNT 1`, `SCORE 5.0`, `STATUS submitted`, `ATTEMPTS 1`. | Continue to keep persistence checks in place and add end-to-end tests for more complex exam flows. |
| 6. Backend security and unauthorized API access prevention | Working | Sensitive endpoints require authenticated users and role-based checks in [portal/views.py](portal/views.py). Unauthenticated access to `/api/exams/` returned `{"detail":"Authentication credentials were not provided."}`. Role checks are enforced for faculty/admin-only operations and student-only exam actions. | Keep authorization checks and expand coverage for permission edge cases in tests. |
| 7. Exam timer, auto-save, submission, and marks calculation | Partially Working | The exam UI includes a countdown timer and `saveAnswer()` logic in [frontend/src/App.jsx](frontend/src/App.jsx), and the backend computes student marks in `submit_exam_view` in [portal/views.py](portal/views.py). The actual exam flow is not stable because the browser route crashed (`TypeError: Cannot read properties of undefined (reading 'map')` in `ExamRoomPage`), so the timer and scoring path are not reliably operational in the live UI. | Fix the exam-room data flow and verify timer expiry, auto-save, and score persistence end-to-end. |
| 8. Faculty dashboard for reviewing and resolving flagged incidents | Working | `incident_review_view` in [portal/views.py](portal/views.py) only allows faculty/admin, and the review payload updates `review_status`, `severity`, and `reviewer_notes`. The test `test_faculty_can_review_incident` passed successfully. The UI review page exists in [frontend/src/App.jsx](frontend/src/App.jsx). | Keep this approved workflow covered by automated tests and verify the UI review flow end-to-end. |

## Working features

The following features are currently validated and in working condition:

- Role-based auth and user creation
- Backend security and unauthorized access prevention
- Database persistence for exam attempts, answers, and incidents
- Server-side marks calculation on submission
- Faculty/admin incident review and severity update flow
- Django regression tests for auth and review behavior passed successfully

## Bugs and reliability issues

The following issues were observed during audit and validation:

- Runtime crash in `ExamRoomPage`: `TypeError: Cannot read properties of undefined (reading 'map')` when the exam route tries to render `exam.questions`. This indicates the exam room is not reliably receiving a complete exam object.
- The live exam UI is not stable enough to trust browser-side proctoring detection in a real session.
- The create-exam flow appears implemented, but the live exam route is still affected by incomplete state handling.
- Camera/live verification was not confirmed with a real browser permission grant in this environment.
- Browser event detection code exists, but it is not yet proven in an actual active exam session.

## Missing or incomplete features

The following areas are not fully proven to work in live operation:

- Real webcam permission success and live preview validation
- Real-time face detection in the browser-backend loop
- End-to-end tab-switch/copy-paste incident creation during a running exam
- Full browser-level exam timer and auto-save validation in the live exam UI
- End-to-end faculty review flow through the browser interface rather than only backend/API validation

## Conclusion

The portal has a solid backend foundation and several key features are already working. However, the live proctoring and exam-room experience is not yet stable enough to claim full compliance with all eight requirements. The biggest risk is the runtime exam-page crash, which prevents the actual browser monitoring flow from being trusted in its current state.

The project is therefore best described as: 
- functional backend foundation = yes
- fully reliable live exam/proctoring flow = not yet
- ready for next implementation cycle after bug-fix and validation = yes
