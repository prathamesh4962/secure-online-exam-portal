# Exam portal frontend

This React 19 application uses Vite and communicates with the Django REST API.

## Local development

```powershell
npm ci
npm run dev
```

The Vite development server proxies `/api` to `http://localhost:8000`. Set
`VITE_API_BASE_URL` in a local `frontend/.env.local` only when using a separate
backend origin; its value must include `/api`.

## Production build and Vercel

```powershell
npm ci
npm run build
```

Configure Vercel with `frontend` as the project root, `npm run build` as the
build command, and `dist` as the output directory. Set
`VITE_API_BASE_URL=https://<your-backend-host>/api` in the Vercel project's
environment variables. Django and its persistent database are deployed
separately; do not put backend secrets in Vite variables.

The camera and microphone require a secure browser context (HTTPS). Microphone
levels are processed locally and audio is never recorded or uploaded. The
optional `VITE_MIC_AUDIO_THRESHOLD`, `VITE_MIC_SUSTAINED_MS`, and
`VITE_MIC_COOLDOWN_MS` variables tune the local activity detector; defaults
are `0.08`, `1500`, and `10000` respectively.
