import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Config ──────────────────────────────────────────────────────────────────
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const SUGGESTION_TYPES = [
  { key: 'hint',     label: '💡 Hint',      color: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  { key: 'analogy',  label: '🔗 Analogy',   color: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',   text: '#34d399' },
  { key: 'alt',      label: '↩ Alt Explain',color: 'rgba(124,106,247,0.15)', border: 'rgba(124,106,247,0.35)', text: '#a78bfa' },
]

// ─── Prompt Builder ───────────────────────────────────────────────────────────
function buildPrompt(transcript, code, topic) {
  return `You are a Shadow AI Co-Tutor silently listening to a live tutoring session.

${topic ? `Current topic being discussed: "${topic}"` : ''}
${code && code.trim() !== '# Start coding here...' ? `\nShared code buffer:\n\`\`\`\n${code.slice(0, 800)}\n\`\`\`` : ''}

Recent session transcript:
"""
${transcript}
"""

Generate exactly 3 teaching suggestions for the tutor to consider RIGHT NOW. Be brief and actionable.

Respond ONLY with a JSON object — no markdown, no preamble:
{
  "hint": "One concise hint the tutor can drop to spark the student's own thinking (max 2 sentences)",
  "analogy": "A vivid real-world analogy that maps to what is being explained (max 2 sentences)",
  "alt": "An alternative way to explain the current concept if the student seems stuck (max 2 sentences)"
}`
}

// ─── API Call ─────────────────────────────────────────────────────────────────
async function fetchSuggestions(transcript, code, topic, signal) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: buildPrompt(transcript, code, topic) }],
    }),
  })
  if (!response.ok) throw new Error(`API error ${response.status}`)
  const data = await response.json()
  const raw = data.content?.find(b => b.type === 'text')?.text || '{}'
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AiCoTutor({ transcriptChunks = [], sharedCode = '', isVisible = true }) {
  const [suggestions, setSuggestions]     = useState(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [lastUpdated, setLastUpdated]     = useState(null)
  const [autoMode, setAutoMode]           = useState(true)
  const [topic, setTopic]                 = useState('')
  const [copiedKey, setCopiedKey]         = useState(null)
  const [pulseKey, setPulseKey]           = useState(null)
  const abortRef                          = useRef(null)
  const autoTimerRef                      = useRef(null)
  const prevLengthRef                     = useRef(0)

  const recentTranscript = transcriptChunks.slice(-12).join(' ').trim()

  const getSuggestions = useCallback(async () => {
    if (!recentTranscript || loading) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const result = await fetchSuggestions(recentTranscript, sharedCode, topic, abortRef.current.signal)
      setSuggestions(result)
      setLastUpdated(new Date())
      // Pulse all cards on new load
      SUGGESTION_TYPES.forEach(({ key }, i) => {
        setTimeout(() => setPulseKey(key), i * 120)
        setTimeout(() => setPulseKey(null), i * 120 + 600)
      })
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [recentTranscript, sharedCode, topic, loading])

  // Auto-trigger when transcript grows by 3+ new chunks
  useEffect(() => {
    if (!autoMode) return
    const newLen = transcriptChunks.length
    if (newLen - prevLengthRef.current >= 3) {
      prevLengthRef.current = newLen
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = setTimeout(getSuggestions, 800)
    }
    return () => clearTimeout(autoTimerRef.current)
  }, [transcriptChunks.length, autoMode, getSuggestions])

  const handleCopy = (key, text) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  if (!isVisible) return null

  const timeAgo = lastUpdated
    ? (() => {
        const s = Math.floor((Date.now() - lastUpdated) / 1000)
        return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
      })()
    : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg)', overflow: 'hidden',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(124,106,247,0.4), rgba(52,211,153,0.3))',
              border: '1px solid rgba(124,106,247,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
            }}>🤖</div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', letterSpacing: '-0.01em' }}>
              Shadow Co-Tutor
            </span>
            {/* live dot */}
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: autoMode ? 'var(--green)' : 'var(--text-dim)',
              animation: autoMode ? 'pulse-glow 2s infinite' : 'none',
            }} />
          </div>
          {/* Auto toggle */}
          <button
            onClick={() => setAutoMode(a => !a)}
            title={autoMode ? 'Auto mode ON — click to switch to manual' : 'Manual mode — click for auto'}
            style={{
              padding: '3px 9px', borderRadius: '5px', fontSize: '10px',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', fontWeight: 600,
              background: autoMode ? 'rgba(52,211,153,0.12)' : 'var(--bg-3)',
              border: `1px solid ${autoMode ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
              color: autoMode ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {autoMode ? 'AUTO' : 'MANUAL'}
          </button>
        </div>

        {/* Topic override input */}
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Topic hint (optional, e.g. 'recursion')"
          style={{
            width: '100%', padding: '5px 9px', fontSize: '11px', boxSizing: 'border-box',
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
          }}
        />
      </div>

      {/* ── Transcript status ── */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-3)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
          {transcriptChunks.length === 0
            ? '⏳ Waiting for transcript…'
            : `📝 ${transcriptChunks.length} chunk${transcriptChunks.length !== 1 ? 's' : ''} captured`}
        </span>
        {lastUpdated && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
            Updated {timeAgo}
          </span>
        )}
      </div>

      {/* ── Suggestion Cards ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!suggestions && !loading && !error && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '10px', padding: '20px',
            color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', opacity: 0.5 }}>🤖</div>
            <div style={{ lineHeight: 1.7 }}>
              {transcriptChunks.length < 3
                ? 'Add 3+ transcript chunks\nto generate suggestions'
                : autoMode
                  ? 'Auto-suggestions will appear\nas the session progresses'
                  : 'Click "Suggest Now" to\ngenerate AI suggestions'}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {SUGGESTION_TYPES.map(({ key, label, color, border }) => (
              <div key={key} style={{
                padding: '12px', borderRadius: '10px',
                background: color, border: `1px solid ${border}`,
                animation: 'pulse-glow 1.4s infinite',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>{label}</div>
                <div style={{ height: '10px', background: 'var(--border)', borderRadius: '4px', width: '85%', marginBottom: '6px' }} />
                <div style={{ height: '10px', background: 'var(--border)', borderRadius: '4px', width: '65%' }} />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div style={{
            padding: '12px', borderRadius: '10px',
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', lineHeight: 1.6,
          }}>
            ⚠ {error}
            <br />
            <button onClick={getSuggestions} style={{
              marginTop: '8px', padding: '4px 10px', borderRadius: '5px', fontSize: '10px',
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
              color: 'var(--red)', fontFamily: 'var(--font-mono)',
            }}>Retry</button>
          </div>
        )}

        {suggestions && !loading && SUGGESTION_TYPES.map(({ key, label, color, border, text }) => (
          <div
            key={key}
            style={{
              padding: '12px', borderRadius: '10px',
              background: pulseKey === key ? color.replace('0.15', '0.28').replace('0.12', '0.22') : color,
              border: `1px solid ${border}`,
              transition: 'background 0.3s',
              animation: pulseKey === key ? 'none' : undefined,
            }}
          >
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.07em', fontWeight: 700, color: text }}>
                {label}
              </span>
              <button
                onClick={() => handleCopy(key, suggestions[key] || '')}
                title="Copy to clipboard"
                style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '10px',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
                  background: copiedKey === key ? border : 'var(--bg-3)',
                  border: `1px solid ${copiedKey === key ? border : 'var(--border)'}`,
                  color: copiedKey === key ? text : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}
              >
                {copiedKey === key ? '✓ copied' : 'copy'}
              </button>
            </div>
            {/* Suggestion text */}
            <p style={{
              margin: 0, fontSize: '12px', lineHeight: 1.65,
              color: 'var(--text)', fontFamily: 'var(--font-sans, var(--font-display))',
            }}>
              {suggestions[key] || '—'}
            </p>
          </div>
        ))}
      </div>

      {/* ── Footer action button ── */}
      <div style={{
        flexShrink: 0, padding: '10px 12px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <button
          onClick={getSuggestions}
          disabled={loading || transcriptChunks.length === 0}
          style={{
            width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px',
            fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.05em',
            background: loading ? 'var(--bg-3)' : 'linear-gradient(135deg, rgba(124,106,247,0.2), rgba(52,211,153,0.12))',
            border: loading ? '1px solid var(--border)' : '1px solid rgba(124,106,247,0.35)',
            color: loading ? 'var(--text-dim)' : 'var(--accent-2)',
            transition: 'all 0.15s',
            opacity: transcriptChunks.length === 0 ? 0.4 : 1,
          }}
        >
          {loading ? '⏳ Thinking…' : '✦ Suggest Now'}
        </button>
      </div>
    </div>
  )
}
