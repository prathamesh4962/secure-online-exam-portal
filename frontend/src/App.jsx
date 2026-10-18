import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  LogOut,
  Monitor,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import './App.css'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

const MAX_EXAM_WARNINGS = 3
const MIC_AUDIO_THRESHOLD = Number(import.meta.env.VITE_MIC_AUDIO_THRESHOLD || 0.08)
const MIC_SUSTAINED_MS = Number(import.meta.env.VITE_MIC_SUSTAINED_MS || 1500)
const MIC_COOLDOWN_MS = Number(import.meta.env.VITE_MIC_COOLDOWN_MS || 10000)

const defaultStats = {
  student: { exams_available: 7, attempted: 4, incidents: 1, average_score: 83 },
  faculty: { created_exams: 5, attempts: 120, incidents: 3 },
  admin: { students: 246, faculty: 18, exams: 31, incidents: 9 },
}

const now = new Date()
const startMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
const endMinutesAhead = new Date(now.getTime() + 35 * 60 * 1000)

const examSeed = {
  id: 1,
  title: 'Applied Security and AI Proctoring Quiz',
  description: 'Answer objective questions covering secure exam workflows, privacy standards, and monitoring controls.',
  subject: 'Cybersecurity',
  duration_minutes: 25,
  max_suspicious_activity: 3,
  start_time: startMinutesAgo.toISOString(),
  end_time: endMinutesAhead.toISOString(),
  status: 'published',
  total_marks: 20,
  negative_marking: 0.25,
  questions: [
    {
      id: 1,
      text: 'Which browser API is used to request webcam access during an exam?',
      options: [
        { id: 101, text: 'navigator.mediaDevices.getUserMedia()', is_correct: true },
        { id: 102, text: 'navigator.camera.startPreview()', is_correct: false },
        { id: 103, text: 'window.requestCameraPermission()', is_correct: false },
        { id: 104, text: 'document.captureWebcam()', is_correct: false },
      ],
    },
    {
      id: 2,
      text: 'Why is server-side validation critical for exam timing?',
      options: [
        { id: 201, text: 'It prevents a user from bypassing start/end restrictions via client code.', is_correct: true },
        { id: 202, text: 'It makes timers run faster.', is_correct: false },
        { id: 203, text: 'It turns off browser warnings.', is_correct: false },
        { id: 204, text: 'It hides all question data.', is_correct: false },
      ],
    },
    {
      id: 3,
      text: 'Which event is used to detect tab or window loss during online assessments?',
      options: [
        { id: 301, text: 'visibilitychange', is_correct: true },
        { id: 302, text: 'load', is_correct: false },
        { id: 303, text: 'beforeunload', is_correct: false },
        { id: 304, text: 'dblclick', is_correct: false },
      ],
    },
  ],
}

const scoreChart = [
  { name: 'Quiz 1', score: 78 },
  { name: 'Quiz 2', score: 82 },
  { name: 'Quiz 3', score: 91 },
  { name: 'Quiz 4', score: 87 },
]

const pieData = [
  { name: 'Passed', value: 68 },
  { name: 'Flagged', value: 16 },
  { name: 'Pending', value: 16 },
]

const defaultAnalytics = {
  score_trend: scoreChart,
  outcome_mix: pieData,
}

const COLORS = ['#14b8a6', '#f59e0b', '#0f172a']

function App() {
  const [user, setUser] = useState(null)
  const [dashboard, setDashboard] = useState(defaultStats)
  const [analytics, setAnalytics] = useState(defaultAnalytics)
  const [exams, setExams] = useState([examSeed])
  const [users, setUsers] = useState([])
  const [isReady, setIsReady] = useState(false)

  const refreshCsrf = async () => {
    try {
      const { data } = await API.get('/csrf/')
      API.defaults.headers.common['X-CSRFToken'] = data.csrf_token
    } catch {
      // Ignore CSRF bootstrap errors in local development.
    }
  }

  const fetchMe = async () => {
    try {
      const { data } = await API.get('/auth/me/')
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setIsReady(true)
    }
  }

  const fetchDashboard = async () => {
    try {
      const { data } = await API.get('/dashboard/')
      setDashboard((prev) => ({ ...prev, [data.role]: data.stats }))
      setAnalytics(data.analytics || defaultAnalytics)
    } catch {
      setDashboard(defaultStats)
      setAnalytics(defaultAnalytics)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data } = await API.get('/users/')
      setUsers(data.users || [])
    } catch {
      setUsers([])
    }
  }

  const fetchExams = async () => {
    try {
      const { data } = await API.get('/exams/')
      if (Array.isArray(data) && data.length > 0) setExams(data)
    } catch {
      setExams([examSeed])
    }
  }

  useEffect(() => {
    refreshCsrf()
    fetchMe()
    fetchDashboard()
    fetchUsers()
    fetchExams()
  }, [])

  const handleLogin = async (payload) => {
    await refreshCsrf()
    await API.post('/auth/login/', payload)
    await fetchMe()
    await fetchDashboard()
    await fetchUsers()
    await fetchExams()
  }

  const handleRegister = async (payload) => {
    await refreshCsrf()
    await API.post('/auth/register/', payload)
    await fetchMe()
    await fetchDashboard()
    await fetchUsers()
    await fetchExams()
  }

  const handleLogout = async () => {
    try {
      await API.post('/auth/logout/')
    } finally {
      setUser(null)
      setUsers([])
    }
  }

  const handleCreateUser = async (payload) => {
    await refreshCsrf()
    await API.post('/users/create/', payload)
    await fetchUsers()
  }

  const handleDeleteUser = async (userId) => {
    await refreshCsrf()
    await API.delete(`/users/${userId}/delete/`)
    await fetchUsers()
  }

  const handleCreateExam = async (payload) => {
    await refreshCsrf()
    await API.post('/exams/create/', payload)
    await fetchExams()
  }

  if (!isReady) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">Loading portal...</div>
  }

  return (
    <BrowserRouter>
      <AppShell
        user={user}
        onLogout={handleLogout}
        dashboard={dashboard}
        analytics={analytics}
        exams={exams}
        users={users}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onCreateExam={handleCreateExam}
        onCreateUser={handleCreateUser}
        onDeleteUser={handleDeleteUser}
      />
    </BrowserRouter>
  )
}

function AppShell({ user, onLogout, dashboard, analytics, exams, users, onLogin, onRegister, onCreateExam, onCreateUser, onDeleteUser }) {
  const links = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/exams', label: 'Exams' },
    { to: '/results', label: 'Results' },
    ...(user && user.role !== 'student' ? [{ to: '/incidents', label: 'Incidents' }] : []),
  ]

  return (
    <div className="app-shell">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 text-lg font-bold text-slate-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25">
              <ShieldCheck size={20} />
            </div>
            SecureExam Pro
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `text-sm font-medium ${isActive ? 'text-teal-600' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 sm:inline-block">
                  {user.username} • {user.role}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Login
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<LandingPage user={user} />} />
          <Route path="/login" element={<AuthPage user={user} onLogin={onLogin} onRegister={onRegister} />} />
          <Route path="/dashboard" element={<ProtectedRoute user={user}><DashboardPage user={user} dashboard={dashboard} analytics={analytics} exams={exams} users={users} onCreateUser={onCreateUser} onDeleteUser={onDeleteUser} /></ProtectedRoute>} />
          <Route path="/exams" element={<ProtectedRoute user={user}><ExamCatalogPage user={user} exams={exams} onCreateExam={onCreateExam} /></ProtectedRoute>} />
          <Route path="/exams/:examId/instructions" element={<ProtectedRoute user={user}><ExamInstructionsPage exams={exams} /></ProtectedRoute>} />
          <Route path="/exam/:examId" element={<ProtectedRoute user={user}><ExamRoomPage exams={exams} /></ProtectedRoute>} />
          <Route path="/results" element={<ProtectedRoute user={user}><ResultsPage user={user} /></ProtectedRoute>} />
          <Route path="/incidents" element={<ProtectedRoute user={user}><IncidentReviewPage user={user} /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

function LandingPage({ user }) {
  const featureCards = [
    { icon: Camera, title: 'Live webcam checks', text: 'Request actual camera access and monitor video stream readiness before the exam starts.' },
    { icon: ClipboardCheck, title: 'Policy safeguards', text: 'Detect copy, paste, tab switches, and risky browser behaviors with recorded warnings.' },
    { icon: Monitor, title: 'AI-assisted review', text: 'Display proctoring health and make incident review workflows transparent for faculty.' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid-pattern panel overflow-hidden px-6 py-10 sm:px-10 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-10">
        <div>
          <span className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700">Secure Online Examination Portal</span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">AI-powered assessments with secure proctoring built in.</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            Manage exams, monitor behavior, protect integrity, and deliver trusted digital assessments for students, faculty, and administrators.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-medium text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500">
                Open dashboard
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-medium text-white shadow-lg shadow-teal-500/25 hover:bg-teal-500">
                Start now
                <ArrowRight size={18} />
              </Link>
            )}
            <Link to="/exams" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:border-slate-400">
              Explore exams
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600">
            <div><span className="font-bold text-slate-900">99.8%</span> exam availability</div>
            <div><span className="font-bold text-slate-900">24/7</span> monitoring</div>
            <div><span className="font-bold text-slate-900">3</span> access roles</div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-teal-100 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-2xl lg:mt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-teal-200">Live proctoring snapshot</p>
              <h2 className="mt-2 text-2xl font-bold">Session health</h2>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">Stable</span>
          </div>
          <div className="mt-8 space-y-5">
            {[
              ['Camera', 'Live'],
              ['Face detection', 'Nominal'],
              ['Clipboard', 'Protected'],
              ['Tab switch Watch', 'Enabled'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-slate-200">{label}</span>
                <span className="font-medium text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Built for secure assessment workflows</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map(({ icon: Icon, title, text }) => (
            <motion.article key={title} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="panel p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-teal-100 p-3 text-teal-700">
                <Icon size={22} />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-slate-900">{title}</h3>
              <p className="text-slate-600">{text}</p>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  )
}

function AuthPage({ user, onLogin, onRegister }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    const payload = { username: form.username, password: form.password }
    if (mode === 'register') payload.email = form.email

    try {
      if (mode === 'login') await onLogin(payload)
      else await onRegister(payload)
      navigate('/dashboard')
    } catch (error) {
      const contentType = error.response?.headers?.['content-type'] || ''
      setAuthError(!error.response || contentType.includes('text/html')
        ? 'The exam API is not connected yet. Please try again after backend deployment is complete.'
        : error.response?.data?.detail || 'Authentication failed.')
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="panel grid w-full max-w-5xl overflow-hidden lg:grid-cols-2">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 p-10 text-white">
          <h2 className="text-3xl font-bold">Welcome to SecureExam Pro</h2>
          <p className="mt-4 text-slate-200">A secure assessment platform built for fairness, privacy, and proctoring accuracy.</p>
          <div className="mt-10 space-y-5">
            {['Real-time proctoring', 'Role-specific access', 'Incident tracking'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 size={18} className="text-teal-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1">
            {['login', 'register'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {value === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none ring-0 transition focus:border-teal-500" required />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-teal-500" required />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-teal-500" required />
            </div>

            {mode === 'register' && <p className="text-sm text-slate-500">New accounts are registered as students. Faculty and administrator accounts are created by an administrator.</p>}

            {authError && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {authError}
              </p>
            )}

            <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-slate-800">
              {mode === 'login' ? 'Login to portal' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function DashboardPage({ user, dashboard, analytics, exams, users, onCreateUser, onDeleteUser }) {
  const role = user?.role || 'student'
  const stats = dashboard[role] || defaultStats[role]
  const scoreTrend = analytics?.score_trend || scoreChart
  const outcomeMix = analytics?.outcome_mix || pieData
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', role: 'student' })
  const [userMessage, setUserMessage] = useState('')

  const cards = {
    student: [
      { label: 'Exams available', value: stats.exams_available },
      { label: 'Attempts', value: stats.attempted },
      { label: 'Incidents', value: stats.incidents },
      { label: 'Average score', value: `${stats.average_score}%` },
    ],
    faculty: [
      { label: 'Created exams', value: stats.created_exams },
      { label: 'Attempts', value: stats.attempts },
      { label: 'Incidents', value: stats.incidents },
    ],
    admin: [
      { label: 'Students', value: stats.students },
      { label: 'Faculty', value: stats.faculty },
      { label: 'Exams', value: stats.exams },
      { label: 'Incidents', value: stats.incidents },
    ],
  }[role]

  const handleCreateUser = async (event) => {
    event.preventDefault()
    try {
      await onCreateUser(userForm)
      setUserForm({ username: '', email: '', password: '', role: 'student' })
      setUserMessage('User created successfully.')
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Unable to create the user.')
    }
  }

  const handleDeleteUser = async (targetId) => {
    try {
      await onDeleteUser(targetId)
      setUserMessage('User removed successfully.')
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Unable to delete the user.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Overview</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{role === 'student' ? 'Student dashboard' : role === 'faculty' ? 'Faculty dashboard' : 'Admin dashboard'}</h1>
        </div>
        <div className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
          {user?.username}
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <div key={card.label} className="panel p-5">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Assessment trend</h2>
            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700">Live</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="score" fill="#14b8a6" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="text-xl font-semibold text-slate-900">Outcome mix</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={outcomeMix} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45} paddingAngle={5}>
                  {outcomeMix.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {role === 'admin' && (
        <div className="mt-8 panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Administration</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">User management</h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                <input value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white">Add user</button>
              {userMessage && <p className="text-sm text-slate-600">{userMessage}</p>}
            </form>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Current accounts</h3>
              <div className="space-y-3">
                {users.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No users found.</p>
                ) : (
                  users.map((account) => (
                    <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="font-medium text-slate-900">{account.username}</p>
                        <p className="text-sm text-slate-500">{account.email} • {account.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(account.id)}
                        disabled={account.id === user.id}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${account.id === user.id ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                      >
                        {account.id === user.id ? 'Self' : 'Delete'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Upcoming examinations</h2>
          <Link to="/exams" className="text-sm font-medium text-teal-600">View all</Link>
        </div>
        <div className="exam-cards">
          {exams.slice(0, 3).map((exam) => (
            <div key={exam.id} className="panel p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{exam.subject}</span>
                <span className="text-xs font-medium text-teal-600">{exam.status}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{exam.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{exam.description}</p>
              <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
                <span>{new Date(exam.start_time).toLocaleDateString()}</span>
                <span>{exam.duration_minutes} min</span>
              </div>
              <Link to={`/exams/${exam.id}/instructions`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                Review instructions <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExamCatalogPage({ user, exams, onCreateExam }) {
  const emptyQuestion = () => ({
    text: '',
    marks: 1,
    negative_mark: 0,
    options: [
      { text: '', is_correct: true },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ],
  })

  const initialForm = {
    title: '',
    description: '',
    subject: 'Cybersecurity',
    duration_minutes: 30,
    max_suspicious_activity: 3,
    start_time: '',
    end_time: '',
    questions: [emptyQuestion()],
  }

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState(initialForm)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateQuestion = (questionIndex, field, value) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, idx) =>
        idx === questionIndex ? { ...question, [field]: value } : question,
      ),
    }))
  }

  const updateQuestionOption = (questionIndex, optionIndex, field, value) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, idx) => {
        if (idx !== questionIndex) return question
        return {
          ...question,
          options: question.options.map((option, optIdx) =>
            optIdx === optionIndex ? { ...option, [field]: value } : option,
          ),
        }
      }),
    }))
  }

  const addQuestion = () => {
    setForm((current) => ({
      ...current,
      questions: [...current.questions, emptyQuestion()],
    }))
  }

  const removeQuestion = (questionIndex) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.length > 1
        ? current.questions.filter((_, idx) => idx !== questionIndex)
        : current.questions,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const cleanedQuestions = form.questions
      .map((question) => {
        const cleanedOptions = question.options
          .filter((option) => option.text && option.text.trim())
          .map((option) => ({
            text: option.text.trim(),
            is_correct: Boolean(option.is_correct),
          }))

        if (!question.text || !question.text.trim() || cleanedOptions.length < 2) {
          return null
        }

        return {
          text: question.text.trim(),
          marks: Number(question.marks || 1),
          negative_mark: Number(question.negative_mark || 0),
          options: cleanedOptions,
        }
      })
      .filter(Boolean)

    if (!form.title.trim() || !form.start_time || !form.end_time || cleanedQuestions.length === 0) {
      alert('Please fill in title, dates, and at least one valid question with two options.')
      return
    }

    const maxSuspiciousActivity = Math.max(1, Number(form.max_suspicious_activity) || 3)

    try {
      await onCreateExam({
        ...form,
        max_suspicious_activity: maxSuspiciousActivity,
        title: form.title.trim(),
        description: form.description.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        questions: cleanedQuestions,
      })
      setIsFormOpen(false)
      setForm(initialForm)
    } catch (error) {
      alert(error.response?.data?.detail || 'Unable to create the exam.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Assessments</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Exam listing and scheduling</h1>
        </div>
        {user?.role !== 'student' && (
          <button type="button" onClick={() => setIsFormOpen((current) => !current)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            {isFormOpen ? 'Close form' : 'Create exam'}
          </button>
        )}
      </div>

      {isFormOpen && user?.role !== 'student' && (
        <div className="panel mb-8 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Create a new exam</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Exam title</span>
                <input value={form.title} onChange={(event) => updateField('title', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Final assessment" required />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Subject</span>
                <input value={form.subject} onChange={(event) => updateField('subject', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Cybersecurity" required />
              </label>
            </div>

            <label className="block space-y-2 text-sm text-slate-700">
              <span>Description</span>
              <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Describe the assessment objectives" />
            </label>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Duration (minutes)</span>
                <input type="number" min="10" value={form.duration_minutes} onChange={(event) => updateField('duration_minutes', Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" required />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Max suspicious activity</span>
                <input type="number" min="1" max="10" value={form.max_suspicious_activity} onChange={(event) => updateField('max_suspicious_activity', Number(event.target.value) || 3)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" required />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Start time</span>
                <input type="datetime-local" value={form.start_time} onChange={(event) => updateField('start_time', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" required />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>End time</span>
                <input type="datetime-local" value={form.end_time} onChange={(event) => updateField('end_time', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" required />
              </label>
            </div>
            <p className="text-xs text-slate-500">Camera and microphone suspicious events are allowed up to {form.max_suspicious_activity} times before an attempt is flagged.</p>

            <div className="space-y-5">
              {form.questions.map((question, questionIndex) => (
                <div key={`question-${questionIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">Question {questionIndex + 1}</h3>
                    {form.questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(questionIndex)} className="text-sm font-medium text-rose-600">Remove</button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block space-y-2 text-sm text-slate-700">
                      <span>Question text</span>
                      <textarea value={question.text} onChange={(event) => updateQuestion(questionIndex, 'text', event.target.value)} className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Type your question" required />
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Marks</span>
                        <input type="number" min="1" value={question.marks} onChange={(event) => updateQuestion(questionIndex, 'marks', Number(event.target.value) || 1)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Negative mark</span>
                        <input type="number" min="0" step="0.25" value={question.negative_mark} onChange={(event) => updateQuestion(questionIndex, 'negative_mark', Number(event.target.value) || 0)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <label key={`option-${questionIndex}-${optionIndex}`} className="space-y-2 text-sm text-slate-700">
                          <span>Option {optionIndex + 1}</span>
                          <div className="flex items-center gap-2">
                            <input value={option.text} onChange={(event) => updateQuestionOption(questionIndex, optionIndex, 'text', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder={`Option ${optionIndex + 1}`} />
                            <label className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs text-slate-600">
                              <input type="radio" checked={Boolean(option.is_correct)} onChange={() => {
                                setForm((current) => ({
                                  ...current,
                                  questions: current.questions.map((q, idx) => {
                                    if (idx !== questionIndex) return q
                                    return {
                                      ...q,
                                      options: q.options.map((opt, optIdx) => ({
                                        ...opt,
                                        is_correct: optIdx === optionIndex,
                                      })),
                                    }
                                  }),
                                }))
                              }} />
                              Correct
                            </label>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button type="button" onClick={addQuestion} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Add question</button>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setIsFormOpen(false); setForm(initialForm) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500">Publish exam</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="exam-cards">
        {exams.map((exam) => (
          <div key={exam.id} className="panel p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700">{exam.subject}</span>
              <span className="text-xs font-medium text-slate-500">{exam.status}</span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">{exam.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{exam.description}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li>Starts: {new Date(exam.start_time).toLocaleString()}</li>
              <li>Ends: {new Date(exam.end_time).toLocaleString()}</li>
              <li>Duration: {exam.duration_minutes} minutes</li>
              <li>Marks: {exam.total_marks}</li>
              <li>Suspicious activity limit: {exam.max_suspicious_activity ?? 3}</li>
            </ul>
            <Link to={`/exams/${exam.id}/instructions`} className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Open exam
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExamInstructionsPage({ exams }) {
  const { examId } = useParams()
  const exam = exams.find((item) => String(item.id) === examId) || examSeed

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="panel p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Before you begin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{exam.title}</h1>
        <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
          <p>{exam.description}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            'Use the assigned device only for the duration of the exam.',
            'Keep your camera and microphone enabled throughout the assessment.',
            'Avoid switching tabs, copying, or pasting from external sources.',
            'Do not use external references or communicate with other students.',
            'If your webcam disconnects, raise a technical issue before continuing.',
            'All proctoring events are logged and reviewed by faculty.',
          ].map((rule) => (
            <div key={rule} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <CheckCircle2 size={18} className="mt-0.5 text-teal-600" />
              <span className="text-slate-700">{rule}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between gap-4 border-t border-slate-200 pt-6">
          <Link to="/exams" className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700">Back</Link>
          <Link to={`/exam/${exam.id}`} className="rounded-xl bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-500">Continue to pre-check</Link>
        </div>
      </div>
    </div>
  )
}

function ExamRoomPage({ exams }) {
  const { examId } = useParams()
  const exam = exams.find((item) => String(item.id) === examId) || examSeed
  const questions = Array.isArray(exam?.questions) ? exam.questions : []
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const microphoneStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const monitoringCleanupRef = useRef(null)
  const submittedRef = useRef(false)
  const tabAwayRef = useRef(false)
  const [attemptId, setAttemptId] = useState(null)
  const submitExamRef = useRef(null)
  const submissionLockRef = useRef(false)
  const pendingEventCountRef = useRef(0)
  const warningQueueRef = useRef(Promise.resolve())
  const microphoneStartedAtRef = useRef(null)
  const microphoneLatchedRef = useRef(false)
  const microphoneCooldownUntilRef = useRef(0)
  const cameraViolationLatchedRef = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [finalWarningPending, setFinalWarningPending] = useState(false)
  const [submittedAt, setSubmittedAt] = useState(null)
  const [submittedScore, setSubmittedScore] = useState(null)
  const [submissionReason, setSubmissionReason] = useState('')
  const [monitoringActive, setMonitoringActive] = useState(false)
  const [examMessage, setExamMessage] = useState('')
  const [warningNotice, setWarningNotice] = useState('')
  const finalWarningPendingRef = useRef(false)
  const [cameraStatus, setCameraStatus] = useState('checking')
  const [microphoneStatus, setMicrophoneStatus] = useState('not connected')
  const [faceStatus, setFaceStatus] = useState('Checking face presence...')
  const [warningCount, setWarningCount] = useState(0)
  const warningCountRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState((exam?.duration_minutes ?? 0) * 60)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState({})
  const [warnings, setWarnings] = useState([])
  const [riskSummary, setRiskSummary] = useState({ total_events: 0, risk_score: 12, risk_level: 'Low', categories: {}, severity: {} })
  const navigate = useNavigate()

  const stopMediaResources = () => {
    monitoringCleanupRef.current?.()
    monitoringCleanupRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }
    audioContextRef.current = null
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    microphoneStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setMonitoringActive(false)
    setCameraStatus('stopped')
    setMicrophoneStatus('stopped')
  }

  useEffect(() => () => stopMediaResources(), [])

  useEffect(() => {
    let cancelled = false
    API.get(`/exams/${exam.id}/attempt/`).then(({ data }) => {
      if (cancelled || !data.attempt_id) return
      setAttemptId(data.attempt_id)
      setTimeLeft(data.time_remaining_seconds ?? (exam.duration_minutes * 60))
      warningCountRef.current = data.warning_count ?? 0
      setWarningCount(warningCountRef.current)
      setWarnings((data.warnings || []).map((warning) => ({
        id: warning.id,
        category: warning.category,
        message: warning.details?.message || warning.category.replaceAll('_', ' '),
        time: new Date(warning.created_at).toLocaleTimeString(),
        count: warning.details?.warning_number,
      })))
      const lastMicrophoneWarning = (data.warnings || []).filter((warning) => warning.category === 'microphone_activity').at(-1)
      if (lastMicrophoneWarning) {
        microphoneCooldownUntilRef.current = new Date(lastMicrophoneWarning.created_at).getTime() + MIC_COOLDOWN_MS
        microphoneLatchedRef.current = Date.now() < microphoneCooldownUntilRef.current
      }
      setSelectedOption(Object.fromEntries((data.answers || []).filter((answer) => answer.option_id).map((answer) => [answer.question_id, answer.option_id])))
      if (data.status === 'submitted') {
        submittedRef.current = true
        setIsSubmitted(true)
        setSubmittedAt(data.submitted_at)
        setSubmittedScore(data.score)
        setSubmissionReason(data.submission_reason || '')
        setExamMessage(data.submission_reason === 'MAX_WARNINGS_REACHED'
          ? 'Maximum warnings reached. Your exam has been automatically submitted.'
          : 'This exam has already been submitted.')
      }
    }).catch((error) => {
      if (!cancelled) {
        setExamMessage(error.response?.data?.detail || 'Unable to restore your exam attempt. Check your connection and retry.')
      }
    })
    return () => { cancelled = true }
  }, [exam.duration_minutes, exam.id])

  const fetchProctoringSummary = useCallback(async (currentAttemptId = attemptId) => {
    if (!currentAttemptId) return
    try {
      const { data } = await API.get('/proctoring/summary/', { params: { attempt_id: currentAttemptId } })
      setRiskSummary(data)
    } catch {
      setRiskSummary((current) => ({ ...current, total_events: Math.max(current.total_events, warnings.length) }))
    }
  }, [attemptId, warnings.length])

  useEffect(() => {
    if (attemptId) {
      fetchProctoringSummary(attemptId)
    }
  }, [attemptId, fetchProctoringSummary])

  useEffect(() => {
    if (!attemptId || !monitoringActive || isSubmitting || isSubmitted) return undefined

    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0]
    const microphoneTrack = microphoneStreamRef.current?.getAudioTracks()[0]

    const sendViolation = async (category, message, source) => {
      if (submittedRef.current || submissionLockRef.current) return
      const eventId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const answers = Object.entries(selectedOption).map(([questionId, optionId]) => ({
        question_id: Number(questionId),
        option_id: optionId,
        marked_for_review: false,
      }))
      let response
      let lastError
      for (let retry = 0; retry < 3; retry += 1) {
        try {
          response = await API.post('/incidents/create/', {
            exam_id: exam.id,
            attempt_id: attemptId,
            event_id: eventId,
            category,
            severity: 'medium',
            source,
            details: { message },
            answers,
          })
          break
        } catch (error) {
          lastError = error
          if (retry < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (retry + 1)))
        }
      }
      if (!response) {
        setExamMessage(lastError?.response?.data?.detail || 'A monitoring warning could not be saved. Check your connection before continuing.')
        if (warningCountRef.current + Math.max(0, pendingEventCountRef.current - 1) < MAX_EXAM_WARNINGS) {
          finalWarningPendingRef.current = false
          setFinalWarningPending(false)
        }
        return
      }

      const { data } = response
      warningCountRef.current = data.warning_count ?? warningCountRef.current
      setWarningCount(warningCountRef.current)
      setWarnings((current) => [{
        id: data.id || eventId,
        category,
        message,
        time: new Date().toLocaleTimeString(),
        count: data.warning_count,
      }, ...current].slice(0, 6))
      void fetchProctoringSummary(attemptId)
      if (data.auto_submitted || data.status === 'submitted') {
        submittedRef.current = true
        submissionLockRef.current = true
        setIsSubmitted(true)
        setSubmittedAt(data.submitted_at)
        setSubmittedScore(data.score)
        setSubmissionReason(data.submission_reason || '')
        setIsSubmitting(false)
        setExamMessage('Maximum warnings reached. Your exam has been automatically submitted.')
        stopMediaResources()
      } else {
        setWarningNotice(`Warning ${data.warning_count}/${MAX_EXAM_WARNINGS}: ${message} Further qualifying violations will automatically submit your exam.`)
        if (warningCountRef.current + Math.max(0, pendingEventCountRef.current - 1) < MAX_EXAM_WARNINGS) {
          finalWarningPendingRef.current = false
          setFinalWarningPending(false)
        }
      }
    }
    const reportViolation = (category, message, source) => {
      pendingEventCountRef.current += 1
      if (warningCountRef.current + pendingEventCountRef.current >= MAX_EXAM_WARNINGS) {
        finalWarningPendingRef.current = true
        setFinalWarningPending(true)
        setWarningNotice('Final warning detected. Answer selection is locked while the event is saved and the exam is submitted.')
      }
      const queued = warningQueueRef.current.then(() => sendViolation(category, message, source))
      warningQueueRef.current = queued.catch(() => {}).finally(() => {
        pendingEventCountRef.current = Math.max(0, pendingEventCountRef.current - 1)
      })
      return queued
    }

    const handleVisibility = () => {
      if (document.hidden) {
        tabAwayRef.current = true
      } else if (tabAwayRef.current) {
        tabAwayRef.current = false
        void reportViolation('tab_switch', 'The exam page was hidden or the window lost focus.', 'browser')
      }
    }
    const handleBlur = () => { tabAwayRef.current = true }
    const handleFocus = () => {
      if (!document.hidden && tabAwayRef.current) {
        tabAwayRef.current = false
        void reportViolation('tab_switch', 'The browser window lost focus during the exam.', 'browser')
      }
    }

    const handleCopy = (event) => {
      event.preventDefault()
      void API.post('/incidents/create/', { exam_id: exam.id, attempt_id: attemptId, category: 'copy_paste', source: 'browser', details: { message: 'Copy action blocked in exam mode.' } })
    }
    const handlePaste = (event) => {
      event.preventDefault()
      void API.post('/incidents/create/', { exam_id: exam.id, attempt_id: attemptId, category: 'copy_paste', source: 'browser', details: { message: 'Paste action blocked in exam mode.' } })
    }
    const handleCut = (event) => {
      event.preventDefault()
      void API.post('/incidents/create/', { exam_id: exam.id, attempt_id: attemptId, category: 'copy_paste', source: 'browser', details: { message: 'Cut action blocked in exam mode.' } })
    }
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x'].includes(event.key.toLowerCase())) {
        event.preventDefault()
      }
    }

    const checkCamera = () => {
      if (!cameraTrack || cameraViolationLatchedRef.current) return
      if (cameraTrack.readyState === 'ended' || !cameraTrack.enabled || cameraTrack.muted) {
        cameraViolationLatchedRef.current = true
        setCameraStatus(cameraTrack.readyState === 'ended' || cameraTrack.muted ? 'disconnected' : 'turned off')
        setFaceStatus('Camera is unavailable. This camera violation has been recorded.')
        void reportViolation('camera_error', 'Camera was disconnected or turned off during the exam.', 'camera')
      }
    }
    const cameraCheckInterval = setInterval(checkCamera, 750)
    const analyzeCameraFrame = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || cameraViolationLatchedRef.current) return
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      try {
        const { data } = await API.post('/proctoring/analyze/', {
          exam_id: exam.id,
          attempt_id: attemptId,
          image: canvas.toDataURL('image/jpeg', 0.75),
        })
        setFaceStatus(data.face_detected
          ? `Face detected with ${data.face_confidence}% confidence.`
          : 'Face not detected; please reposition in front of the camera.')
      } catch {
        setFaceStatus('Camera analysis is temporarily unavailable; retrying in a moment.')
      }
    }
    const faceAnalysisInterval = setInterval(() => { void analyzeCameraFrame() }, 5000)

    let audioCheckInterval
    let audioSource
    if (microphoneTrack && audioContextRef.current) {
      const audioContext = audioContextRef.current
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      audioSource = audioContext.createMediaStreamSource(microphoneStreamRef.current)
      audioSource.connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      audioCheckInterval = setInterval(() => {
        if (microphoneTrack.readyState === 'ended' || !microphoneTrack.enabled) {
          setMicrophoneStatus('unavailable')
          return
        }
        analyser.getFloatTimeDomainData(samples)
        let energy = 0
        for (const sample of samples) energy += sample * sample
        const audioLevel = Math.sqrt(energy / samples.length)
        const now = Date.now()
        if (audioLevel >= MIC_AUDIO_THRESHOLD) {
          if (microphoneStartedAtRef.current === null) microphoneStartedAtRef.current = now
          if (!microphoneLatchedRef.current && now - microphoneStartedAtRef.current >= MIC_SUSTAINED_MS && now >= microphoneCooldownUntilRef.current) {
            microphoneLatchedRef.current = true
            microphoneCooldownUntilRef.current = now + MIC_COOLDOWN_MS
            void reportViolation('microphone_activity', 'Sustained audio activity exceeded the local monitoring threshold.', 'microphone')
          }
        } else {
          microphoneStartedAtRef.current = null
          microphoneLatchedRef.current = false
        }
      }, 100)
    } else {
      setMicrophoneStatus('unavailable')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('cut', handleCut)
    document.addEventListener('keydown', handleKeyDown)
    monitoringCleanupRef.current = () => {
      clearInterval(cameraCheckInterval)
      clearInterval(faceAnalysisInterval)
      if (audioCheckInterval) clearInterval(audioCheckInterval)
      audioSource?.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('keydown', handleKeyDown)
    }

    return () => {
      monitoringCleanupRef.current?.()
      monitoringCleanupRef.current = null
    }
  }, [attemptId, exam.id, fetchProctoringSummary, isSubmitted, isSubmitting, monitoringActive, selectedOption])

  useEffect(() => {
    if (!attemptId || isSubmitted) return undefined

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer)
          void submitExamRef.current?.('TIME_EXPIRED')
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [attemptId, isSubmitted])

  const handleStartExam = async () => {
    if (isStarting || monitoringActive || isSubmitted) return
    setIsStarting(true)
    let requestingDevice = 'camera'
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support camera and microphone access.')
      }
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true })
      cameraStreamRef.current = cameraStream
      setCameraStatus('live')
      if (videoRef.current) videoRef.current.srcObject = cameraStream
      requestingDevice = 'microphone'
      const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      microphoneStreamRef.current = microphoneStream
      if (!globalThis.AudioContext) {
        throw new Error('This browser does not support local microphone monitoring.')
      }
      audioContextRef.current = new AudioContext()
      await audioContextRef.current.resume()
      setMicrophoneStatus('permission granted')

      const { data } = await API.post(`/exams/${exam.id}/start/`)
      const activeAttemptId = data.attempt_id
      setAttemptId(activeAttemptId)
      setTimeLeft(data.time_remaining_seconds ?? (exam.duration_minutes * 60))
      warningCountRef.current = data.warning_count ?? 0
      setWarningCount(warningCountRef.current)
      setWarnings((data.warnings || []).map((warning) => ({
        id: warning.id,
        category: warning.category,
        message: warning.details?.message || warning.category.replaceAll('_', ' '),
        time: new Date(warning.created_at).toLocaleTimeString(),
        count: warning.details?.warning_number,
      })))
      setSelectedOption(Object.fromEntries((data.answers || []).filter((answer) => answer.option_id).map((answer) => [answer.question_id, answer.option_id])))
      const lastMicrophoneWarning = (data.warnings || []).filter((warning) => warning.category === 'microphone_activity').at(-1)
      if (lastMicrophoneWarning) {
        microphoneCooldownUntilRef.current = new Date(lastMicrophoneWarning.created_at).getTime() + MIC_COOLDOWN_MS
        microphoneLatchedRef.current = Date.now() < microphoneCooldownUntilRef.current
      }
      if (!activeAttemptId) throw new Error('The server did not create an exam attempt.')
      setExamMessage('')
      setWarningNotice('')
      submittedRef.current = false
      setMonitoringActive(true)
    } catch (error) {
      stopMediaResources()
      const permissionDenied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
      if (permissionDenied && requestingDevice === 'camera') setCameraStatus('permission denied')
      if (permissionDenied && requestingDevice === 'microphone') setMicrophoneStatus('permission denied')
      setExamMessage(error.response?.data?.detail || error.message || 'Unable to start the exam.')
    } finally {
      setIsStarting(false)
    }
  }

  const handleSubmitExam = useCallback(async (reason = 'MANUAL') => {
    if (!attemptId) {
      setExamMessage('Start the exam before submitting. Your answers cannot be submitted until an attempt has started.')
      return
    }
    if (
      isSubmitting
      || submissionLockRef.current
      || (reason !== 'TIME_EXPIRED' && pendingEventCountRef.current > 0)
      || submittedRef.current
    ) return

    submissionLockRef.current = true
    setIsSubmitting(true)
    setExamMessage('')
    try {
      const { data } = await API.post(`/attempts/${attemptId}/submit/`, {
        reason,
        answers: Object.entries(selectedOption).map(([questionId, optionId]) => ({
          question_id: Number(questionId),
          option_id: optionId,
          marked_for_review: false,
        })),
      })
      if (data.status !== 'submitted') {
        throw new Error('The server did not confirm exam submission.')
      }
      submittedRef.current = true
      setIsSubmitted(true)
      setSubmittedAt(data.submitted_at)
      setSubmittedScore(data.score)
      setSubmissionReason(data.submission_reason || reason)
      stopMediaResources()
      if (data.submission_reason === 'MAX_WARNINGS_REACHED') {
        setExamMessage('Maximum warnings reached. Your exam has been automatically submitted.')
      } else {
        navigate('/results')
      }
    } catch (error) {
      setExamMessage(error.response?.data?.detail || error.message || 'Submission failed. Please try again.')
      setIsSubmitting(false)
      submissionLockRef.current = false
    }
  }, [attemptId, isSubmitting, navigate, selectedOption])

  useEffect(() => {
    submitExamRef.current = handleSubmitExam
  }, [handleSubmitExam])

  const saveAnswer = async (questionId, optionId) => {
    if (!attemptId) {
      setExamMessage('Start the exam before selecting answers.')
      return
    }
    setExamMessage('')
    try {
      await API.post(`/attempts/${attemptId}/save-answer/`, {
        question_id: questionId,
        option_id: optionId,
        marked_for_review: false,
      })
    } catch (error) {
      setExamMessage(error.response?.data?.detail || 'Your answer could not be saved. Please try selecting it again.')
    }
  }

  if (!isSubmitted && (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="panel p-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Assessment unavailable</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">This exam could not be loaded.</h1>
          <p className="mt-4 text-slate-600">The selected exam is missing or incomplete. Please return to the exam list and try again.</p>
          <Link to="/exams" className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white">Back to exams</Link>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="panel p-10">
          <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
          <p className="mt-5 text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">Exam submitted</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Your exam has been submitted.</h1>
          <p className="mt-3 text-slate-600">{exam.title}</p>
          {submissionReason === 'MAX_WARNINGS_REACHED' && (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The third qualifying monitoring warning automatically submitted your saved answers.
            </p>
          )}
          <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-5 text-left sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final status</p>
              <p className="mt-1 font-semibold text-slate-900">Submitted</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
              <p className="mt-1 font-semibold text-slate-900">{submittedScore ?? 'Processing'}</p>
            </div>
            {submittedAt && (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted at</p>
                <p className="mt-1 font-semibold text-slate-900">{new Date(submittedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
          <Link to="/results" className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-800">
            View my results
          </Link>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[selectedIndex] ?? questions[0]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Live assessment</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{exam.title}</h1>
        </div>
        <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{formatSeconds(timeLeft)}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Camera and microphone monitoring</h2>
                <p className="mt-1 text-sm text-slate-600">Microphone audio levels are analyzed locally. Audio is not recorded or stored.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cameraStatus === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {cameraStatus}
              </span>
            </div>
            <video ref={videoRef} autoPlay playsInline muted />
            <p className="mt-3 text-sm text-slate-600">{faceStatus}</p>
            <p className="mt-3 text-sm text-slate-600" role="status">
              Microphone: {monitoringActive ? 'active; audio processed locally' : microphoneStatus}
            </p>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Shared warning count: <strong>{warningCount}/{MAX_EXAM_WARNINGS}</strong>. The third warning automatically submits this exam. Tab and focus monitoring can be imperfect and does not prevent switching.
            </p>
            {warningNotice && (
              <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                {warningNotice}
              </p>
            )}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">AI integrity score</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskSummary.risk_level === 'High' ? 'bg-rose-100 text-rose-700' : riskSummary.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {riskSummary.risk_level}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{riskSummary.risk_score}%</p>
                  <p className="text-xs text-slate-500">{riskSummary.total_events} logged events</p>
                </div>
                <div className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${riskSummary.risk_level === 'High' ? 'bg-rose-500' : riskSummary.risk_level === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(riskSummary.risk_score, 100)}%` }} />
                </div>
              </div>
            </div>
            {!monitoringActive && !isSubmitted && (
              <button type="button" onClick={handleStartExam} disabled={isStarting} className="mt-4 w-full rounded-xl bg-teal-600 px-4 py-3 font-medium text-white hover:bg-teal-500 disabled:cursor-wait disabled:opacity-60">
                {isStarting ? 'Requesting permissions…' : attemptId ? 'Resume exam monitoring' : 'Grant permissions and start exam'}
              </button>
            )}
            {examMessage && (
              <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {examMessage}
              </p>
            )}
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-900">Proctoring warnings ({warningCount}/{MAX_EXAM_WARNINGS})</h2>
            <div className="mt-4 space-y-3">
              {warnings.length === 0 ? (
                <p className="text-sm text-slate-500">No integrity warnings detected.</p>
              ) : (
                warnings.map((warning) => (
                  <div key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold uppercase tracking-wide">{warning.count ? `Warning ${warning.count}: ` : ''}{warning.category.replaceAll('_', ' ')}</span>
                      <span>{warning.time}</span>
                    </div>
                    <p className="mt-1">{warning.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Question navigator</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{selectedIndex + 1}/{questions.length}</span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {questions.map((question, index) => (
              <button
                key={question.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${selectedIndex === index ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Question {selectedIndex + 1}</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{currentQuestion.text}</h3>

            <div className="mt-5 space-y-3">
              {currentQuestion.options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => {
                    if (finalWarningPendingRef.current) return
                    setSelectedOption((prev) => ({ ...prev, [currentQuestion.id]: option.id }))
                    void saveAnswer(currentQuestion.id, option.id)
                  }}
                  disabled={!monitoringActive || isSubmitting || isSubmitted || finalWarningPending}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${selectedOption[currentQuestion.id] === option.id ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-700'}`}
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold">{String.fromCharCode(65 + currentQuestion.options.indexOf(option))}</span>
                  <span>{option.text}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setSelectedIndex((prev) => Math.max(prev - 1, 0))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700">Previous</button>
            <button type="button" onClick={() => setSelectedIndex((prev) => Math.min(prev + 1, questions.length - 1))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700">Next</button>
            <button
              type="button"
              onClick={() => void handleSubmitExam()}
              disabled={!attemptId || !monitoringActive || isSubmitting || isSubmitted}
              className={`rounded-xl px-5 py-2.5 font-medium text-white ${!attemptId || isSubmitting ? 'cursor-not-allowed bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              {examMessage.includes('Maximum warnings reached') ? 'Automatically submitted' : isSubmitting ? 'Submitting…' : attemptId && monitoringActive ? 'Submit exam' : 'Start monitoring to answer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IncidentReviewPage({ user }) {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchIncidents = async () => {
    try {
      const { data } = await API.get('/incidents/')
      setIncidents(data)
    } catch {
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncidents()
  }, [])

  const updateIncident = async (incidentId, nextStatus, notes, severity) => {
    try {
      await API.patch(`/incidents/${incidentId}/review/`, {
        review_status: nextStatus,
        reviewer_notes: notes,
        severity,
      })
      await fetchIncidents()
    } catch (error) {
      alert(error.response?.data?.detail || 'Unable to review the incident.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Review queue</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Proctoring incident review</h1>
        </div>
        <div className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">{user?.role}</div>
      </div>

      {loading ? (
        <div className="panel p-8 text-slate-600">Loading incident records...</div>
      ) : incidents.length === 0 ? (
        <div className="panel p-8 text-slate-600">No incidents have been logged yet.</div>
      ) : (
        <div className="space-y-5">
          {incidents.map((incident) => (
            <div key={incident.id} className="panel p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{incident.category}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${incident.severity === 'critical' ? 'bg-rose-100 text-rose-700' : incident.severity === 'high' ? 'bg-orange-100 text-orange-700' : incident.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {incident.severity}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{incident.review_status}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-900">{incident.exam}</h2>
                  <p className="mt-2 text-sm text-slate-600">Student: {incident.student}</p>
                  <p className="mt-1 text-sm text-slate-600">Source: {incident.source}</p>
                  <p className="mt-3 text-sm text-slate-700">{JSON.stringify(incident.details || {}, null, 2)}</p>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Review status</label>
                  <select
                    defaultValue={incident.review_status}
                    onChange={(event) => updateIncident(incident.id, event.target.value, incident.reviewer_notes || '', incident.severity)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="dismissed">Dismissed</option>
                  </select>

                  <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Severity</label>
                  <select
                    defaultValue={incident.severity}
                    onChange={(event) => updateIncident(incident.id, incident.review_status, incident.reviewer_notes || '', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>

                  <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notes</label>
                  <textarea
                    defaultValue={incident.reviewer_notes || ''}
                    onBlur={(event) => updateIncident(incident.id, incident.review_status, event.target.value, incident.severity)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500"
                    placeholder="Add reviewer notes..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultsPage({ user }) {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const { data } = await API.get('/attempts/')
        setAttempts(data)
      } catch {
        setAttempts([])
      } finally {
        setLoading(false)
      }
    }

    if (user) fetchAttempts()
  }, [user])

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Results</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Results and exam history</h1>
      </div>

      {loading ? (
        <div className="panel p-8 text-slate-600">Loading exam history...</div>
      ) : attempts.length === 0 ? (
        <div className="panel p-8 text-slate-600">No attempts recorded yet.</div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Exam</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Score</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td className="px-6 py-4 text-sm text-slate-700">{attempt.exam.title}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attempt.status === 'flagged' ? 'bg-rose-100 text-rose-700' : attempt.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {attempt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{attempt.score ?? 0}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{new Date(attempt.started_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default App
