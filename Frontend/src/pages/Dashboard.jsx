import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSessionsApi } from '../hooks/useSessionapi'
import { format } from 'date-fns'

const STATUS_COLORS = {
  pending: { bg: 'var(--amber-dim)', text: 'var(--amber)', border: 'rgba(251,191,36,0.25)' },
  accepted: { bg: 'var(--green-dim)', text: 'var(--green)', border: 'rgba(52,211,153,0.25)' },
  in_progress: { bg: 'rgba(124,106,247,0.12)', text: 'var(--accent-2)', border: 'rgba(124,106,247,0.3)' },
  completed: { bg: 'var(--bg-3)', text: 'var(--text-muted)', border: 'var(--border)' },
  cancelled: { bg: 'var(--red-dim)', text: 'var(--red)', border: 'rgba(248,113,113,0.25)' },
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { fetchSessions, createSession: apiCreate, acceptSession: apiAccept, loading: apiLoading, error: apiError, clearError } = useSessionsApi()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', scheduled_at: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const doFetch = () => {
    setLoading(true)
    fetchSessions()
      .then(data => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { doFetch() }, [])

  const createSession = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await apiCreate({
        subject: form.subject,
        description: form.description || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      })
      setShowCreate(false)
      setForm({ subject: '', description: '', scheduled_at: '' })
      doFetch()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  const acceptSession = async (id) => {
    try {
      await apiAccept(id)
      doFetch()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept')
    }
  }

  const joinRoom = (roomToken) => navigate(`/room/${roomToken}`)
  const isStudent = user?.role === 'student'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '60px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>◈</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>Athira</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{user?.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{user?.role}</div>
          </div>
          <button onClick={logout} style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', background: 'transparent', transition: 'all 0.2s' }}
            onMouseEnter={e => e.target.style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
          >Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '6px' }}>Dashboard</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em' }}>
              {isStudent ? 'Your Sessions' : 'Session Requests'}
            </h1>
          </div>
          {isStudent && (
            <button onClick={() => setShowCreate(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: '#fff', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-display)',
            }}>
              + Request Session
            </button>
          )}
        </div>

        {/* Stats row */}
        {sessions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {[
              { label: 'Total', val: sessions.length, color: 'var(--text)' },
              { label: 'Pending', val: sessions.filter(s => s.status === 'pending').length, color: 'var(--amber)' },
              { label: 'Active', val: sessions.filter(s => ['accepted','in_progress'].includes(s.status)).length, color: 'var(--accent-2)' },
              { label: 'Done', val: sessions.filter(s => s.status === 'completed').length, color: 'var(--green)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)', color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sessions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.05em' }}>LOADING SESSIONS...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 40px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✦</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              {isStudent ? 'No sessions yet' : 'No pending requests'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {isStudent ? 'Request your first tutoring session to get started.' : 'New session requests will appear here.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.map(s => {
              const sc = STATUS_COLORS[s.status] || STATUS_COLORS.pending
              const canJoin = ['accepted', 'in_progress'].includes(s.status) && s.room_token
              const canAccept = !isStudent && s.status === 'pending'
              return (
                <div key={s.id} className="animate-in" style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', padding: '20px 24px',
                  display: 'flex', alignItems: 'center', gap: '20px',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px' }}>{s.subject}</span>
                      <span style={{
                        padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                      }}>{s.status.replace('_', ' ')}</span>
                    </div>
                    {s.description && <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px' }}>{s.description}</div>}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {isStudent && s.tutor && <span>Tutor: {s.tutor.name}</span>}
                      {!isStudent && <span>Student: {s.student?.name}</span>}
                      {s.scheduled_at && <span>📅 {format(new Date(s.scheduled_at), 'MMM d, h:mm a')}</span>}
                      <span>#{s.id}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {canAccept && (
                      <button onClick={() => acceptSession(s.id)} style={{
                        padding: '8px 18px', borderRadius: 'var(--radius)',
                        background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,0.3)',
                        color: 'var(--green)', fontWeight: 600, fontSize: '13px',
                      }}>Accept</button>
                    )}
                    {canJoin && (
                      <button onClick={() => joinRoom(s.room_token)} style={{
                        padding: '8px 20px', borderRadius: 'var(--radius)',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                        color: '#fff', fontWeight: 600, fontSize: '13px',
                      }}>Join Room →</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create session modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-lg)', padding: '32px', width: '460px',
            animation: 'fadeIn 0.25s ease both',
          }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Request a Session</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>A tutor will accept and schedule your session.</p>
            {error && <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            <form onSubmit={createSession}>
              {[
                { key: 'subject', label: 'Subject *', placeholder: 'e.g. Binary Search Trees', type: 'text', required: true },
                { key: 'description', label: 'Description', placeholder: 'What do you need help with?', type: 'text', required: false },
                { key: 'scheduled_at', label: 'Preferred Time', placeholder: '', type: 'datetime-local', required: false },
              ].map(({ key, label, placeholder, type, required }) => (
                <div key={key} style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>{label}</label>
                  {key === 'description'
                    ? <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                        style={{ width: '100%', padding: '10px 14px', fontSize: '14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', resize: 'vertical', minHeight: '80px' }} />
                    : <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} required={required}
                        style={{ width: '100%', padding: '10px 14px', fontSize: '14px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', colorScheme: 'dark' }} />
                  }
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent', fontWeight: 500 }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ flex: 2, padding: '11px', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-display)', opacity: creating ? 0.7 : 1 }}>
                  {creating ? 'Sending…' : 'Request Session →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
