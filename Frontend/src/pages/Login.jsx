import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: 'var(--bg)',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '64px',
    position: 'relative',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,106,247,0.18) 0%, transparent 70%)',
    top: '-100px',
    left: '-100px',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)',
    bottom: '50px',
    right: '-50px',
    pointerEvents: 'none',
  },
  logoMark: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '64px',
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '20px',
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    letterSpacing: '0.12em',
    color: 'var(--accent)',
    textTransform: 'uppercase',
    marginBottom: '16px',
  },
  headline: {
    fontFamily: 'var(--font-display)',
    fontSize: '48px',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
    marginBottom: '20px',
  },
  sub: {
    color: 'var(--text-muted)',
    fontSize: '15px',
    lineHeight: 1.7,
    maxWidth: '360px',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '40px',
  },
  feat: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  featDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px',
    borderLeft: '1px solid var(--border)',
    background: 'var(--bg-2)',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    animation: 'fadeIn 0.4s ease both',
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '26px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  cardSub: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    marginBottom: '32px',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: 'var(--bg-3)',
    padding: '4px',
    borderRadius: 'var(--radius)',
    marginBottom: '28px',
  },
  tab: (active) => ({
    flex: 1,
    padding: '8px 16px',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'var(--font-display)',
    background: active ? 'var(--bg-4)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    border: active ? '1px solid var(--border-bright)' : '1px solid transparent',
    transition: 'all 0.2s',
    cursor: 'pointer',
  }),
  field: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    fontFamily: 'var(--font-mono)',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
  },
  roleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '14px',
  },
  roleBtn: (active) => ({
    padding: '10px',
    borderRadius: 'var(--radius)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-glow)' : 'var(--bg-3)',
    color: active ? 'var(--accent-2)' : 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
  }),
  submitBtn: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    color: '#fff',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.02em',
    marginTop: '8px',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  error: {
    background: 'var(--red-dim)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    color: 'var(--red)',
    fontSize: '13px',
    marginBottom: '16px',
  },
}

// ── Helper: parse FastAPI error responses into a readable string ──────────────
function parseApiError(err) {
  const detail = err.response?.data?.detail
  if (!detail) return 'Something went wrong'
  // 422 Unprocessable Entity: detail is an array of validation error objects
  if (Array.isArray(detail)) {
    return detail.map(d => d.msg || JSON.stringify(d)).join(', ')
  }
  // 400 / 401: detail is a plain string
  if (typeof detail === 'string') return detail
  return JSON.stringify(detail)
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.name, form.email, form.password, form.role)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(parseApiError(err))   // ← fixed: never passes an object to React
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />
        <div style={styles.logoMark}>
          <div style={styles.logoIcon}>◈</div>
          <span style={styles.logoText}>Athira</span>
        </div>
        <div style={styles.tagline}>Live Learning Platform</div>
        <h1 style={styles.headline}>
          Where tutoring<br />
          <span style={{ color: 'var(--accent)' }}>becomes</span><br />
          intelligence
        </h1>
        <p style={styles.sub}>
          A real-time collaborative workspace that transforms a standard tutoring session into a high-signal learning environment.
        </p>
        <div style={styles.features}>
          {['Logic Mirror — shared code execution', 'Cognitive Anchor — live knowledge graphs', 'Real-time collaboration', 'AI-powered concept extraction'].map(f => (
            <div key={f} style={styles.feat}><div style={styles.featDot} />{f}</div>
          ))}
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>{mode === 'login' ? 'Welcome back' : 'Get started'}</h2>
          <p style={styles.cardSub}>{mode === 'login' ? 'Sign in to your account' : 'Create your Athira account'}</p>

          <div style={styles.tabs}>
            <button style={styles.tab(mode === 'login')} onClick={() => setMode('login')}>Sign In</button>
            <button style={styles.tab(mode === 'register')} onClick={() => setMode('register')}>Register</button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div style={styles.field}>
                <label style={styles.label}>Full Name</label>
                <input style={styles.input} placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            {mode === 'register' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={styles.label}>I am a</label>
                <div style={styles.roleRow}>
                  <button type="button" style={styles.roleBtn(form.role === 'student')} onClick={() => set('role', 'student')}>🎓 Student</button>
                  <button type="button" style={styles.roleBtn(form.role === 'tutor')} onClick={() => set('role', 'tutor')}>📚 Tutor</button>
                </div>
              </div>
            )}
            <button type="submit" style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
