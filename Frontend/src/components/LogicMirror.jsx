import { useState, useRef, useEffect } from 'react'

const LANGS = ['python', 'javascript']

const LANG_COLORS = {
  python: { bg: 'rgba(52,211,153,0.1)', text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  javascript: { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
}

export default function LogicMirror({ sharedCode, sharedLanguage, onCodeChange, onRunCode, lastResult, connected }) {
  const [localCode, setLocalCode] = useState(sharedCode || '# Start coding here...\n')
  const [lang, setLang] = useState(sharedLanguage || 'python')
  const [isRunning, setIsRunning] = useState(false)
  const outputRef = useRef(null)

  // Sync from remote
  useEffect(() => {
    if (sharedCode !== undefined && sharedCode !== localCode) {
      setLocalCode(sharedCode)
    }
  }, [sharedCode])

  useEffect(() => {
    if (sharedLanguage) setLang(sharedLanguage)
  }, [sharedLanguage])

  useEffect(() => {
    if (lastResult) setIsRunning(false)
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [lastResult])

  const handleCodeChange = (e) => {
    const code = e.target.value
    setLocalCode(code)
    onCodeChange?.(code, lang)
  }

  const handleRun = () => {
    if (!connected) return
    setIsRunning(true)
    onRunCode?.(localCode, lang)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const newCode = localCode.substring(0, start) + '    ' + localCode.substring(end)
      setLocalCode(newCode)
      setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 4 }, 0)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  const lc = LANG_COLORS[lang]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Logic Mirror</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {LANGS.map(l => (
              <button key={l} onClick={() => { setLang(l); onCodeChange?.(localCode, l) }} style={{
                padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                border: lang === l ? `1px solid ${LANG_COLORS[l].border}` : '1px solid transparent',
                background: lang === l ? LANG_COLORS[l].bg : 'transparent',
                color: lang === l ? LANG_COLORS[l].text : 'var(--text-dim)',
                transition: 'all 0.15s',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>⌘↩ to run</span>
          <button onClick={handleRun} disabled={!connected || isRunning} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-display)',
            background: isRunning ? 'var(--bg-3)' : 'var(--green-dim)',
            border: `1px solid ${isRunning ? 'var(--border)' : 'rgba(52,211,153,0.3)'}`,
            color: isRunning ? 'var(--text-muted)' : 'var(--green)',
            transition: 'all 0.2s',
            opacity: !connected ? 0.5 : 1,
          }}>
            {isRunning ? (
              <><span style={{ display: 'inline-block', width: '10px', height: '10px', border: '1.5px solid var(--text-dim)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Running</>
            ) : (
              <><span>▶</span> Run</>
            )}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: '1 1 60%', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* Line numbers */}
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{
            width: '44px', flexShrink: 0, padding: '12px 0',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-2)', overflowY: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          }}>
            {localCode.split('\n').map((_, i) => (
              <div key={i} style={{ padding: '0 10px 0 0', lineHeight: '21px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', userSelect: 'none' }}>{i + 1}</div>
            ))}
          </div>
          <textarea
            value={localCode}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{
              flex: 1, padding: '12px 16px', resize: 'none',
              fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '21px',
              background: 'var(--bg)', color: 'var(--text)', border: 'none',
              outline: 'none', height: '100%', overflow: 'auto',
              tabSize: 4,
            }}
          />
        </div>
      </div>

      {/* Output panel */}
      <div style={{ flexShrink: 0, height: '200px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Output</span>
          {lastResult && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
              padding: '2px 8px', borderRadius: '4px',
              background: lastResult.timed_out ? 'var(--amber-dim)' : lastResult.exit_code === 0 ? 'var(--green-dim)' : 'var(--red-dim)',
              color: lastResult.timed_out ? 'var(--amber)' : lastResult.exit_code === 0 ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${lastResult.timed_out ? 'rgba(251,191,36,0.25)' : lastResult.exit_code === 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
            }}>
              {lastResult.timed_out ? 'TIMEOUT' : lastResult.exit_code === 0 ? 'EXIT 0' : `EXIT ${lastResult.exit_code}`}
            </span>
          )}
        </div>
        <div ref={outputRef} style={{ flex: 1, overflow: 'auto', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.7 }}>
          {!lastResult && !isRunning && (
            <div style={{ color: 'var(--text-dim)' }}>// Output will appear here after running code</div>
          )}
          {isRunning && (
            <div style={{ color: 'var(--text-muted)' }}>Running...</div>
          )}
          {lastResult && !isRunning && (<>
            {lastResult.stdout && <pre style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lastResult.stdout}</pre>}
            {lastResult.stderr && <pre style={{ color: 'var(--red)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lastResult.stderr}</pre>}
            {lastResult.timed_out && <div style={{ color: 'var(--amber)' }}>⏱ Execution timed out (10s limit)</div>}
          </>)}
        </div>
      </div>
    </div>
  )
}
