# Secure Online Examination Portal

A full-stack examination portal with role-based access for students, faculty, and administrators. It includes exam creation, answer saving and scoring, browser event logging, webcam-frame analysis, and faculty incident review.

## Project structure

- `frontend/` — React, Vite, and Tailwind frontend
- `backend/` — Django project settings and API entry points
- `portal/` — exam, user, attempt, answer, and incident models and API logic

## Local development

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:8000`.

Create the initial administrator through Django's `createsuperuser` command, then set that account's portal role to `admin` through the Django shell or Django admin. Public self-registration only creates student accounts; faculty and administrator accounts must be provisioned by an administrator.

## Deploying

The frontend can be deployed to Vercel. Django must be deployed separately to a Python application host, backed by a persistent PostgreSQL database. Do not deploy the local SQLite database or `.env` file.

### Django backend (Render + PostgreSQL)

1. Create a PostgreSQL database and a Python web service connected to this repository.
2. Set the web service root to the repository root.
3. Use `pip install -r requirements.txt` as the build command.
4. Use `python manage.py migrate && python manage.py collectstatic --noinput` as a pre-deploy command, and `gunicorn backend.wsgi:application` as the start command.
5. Configure these environment variables on the backend:
   - `DEBUG=False`
   - `DJANGO_SECRET_KEY` — a newly generated random secret
   - `ALLOWED_HOSTS` — the backend's exact Render hostname
   - `FRONTEND_URLS` — the exact Vercel production origin (include preview origins only if needed)
   - `DATABASE_URL` — Render's internal PostgreSQL connection URL
6. Create the first administrator through a one-off shell/console command; do not enable public administrator registration.

The production settings enable secure cookies and PostgreSQL SSL when `DEBUG=False`. Since the frontend and backend are on separate origins, the Vercel origin must be listed in both `FRONTEND_URLS` and `CSRF_TRUSTED_ORIGINS` (the latter is populated from `FRONTEND_URLS`).

### React frontend (Vercel)

1. Import the GitHub repository into Vercel and set the project root directory to `frontend`.
2. Use `npm run build` as the build command and `dist` as the output directory.
3. Set `VITE_API_BASE_URL` to the backend API origin plus `/api`, for example `https://your-backend.onrender.com/api`.
4. Add the final Vercel origin to the backend's `FRONTEND_URLS` and redeploy the backend.

Browser camera access requires HTTPS, which Vercel provides. Cross-origin session cookies depend on the browser's third-party-cookie policy; for deployments where those cookies are blocked, serve the API through a same-site custom domain or a same-origin reverse proxy.

## Important security and operational notes

- Never commit `.env`, database files, credentials, student records, or generated secrets.
- Use a persistent database and configure backups before using real exam records.
- Review the proctoring privacy, consent, retention, and incident-review policies before real-world use.
- The browser monitoring and frame checks provide signals for human review; they are not proof of misconduct.
- Run backend checks with `python manage.py test` and build the frontend with `npm run build`.
