import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import LogicMirror from '../components/LogicMirror'
import CognitiveAnchor from '../components/CognitiveAnchor'

const EVENT = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  CODE_UPDATE: 'code_update',
  RUN_CODE: 'run_code',
  CHAT_MESSAGE: 'chat_message',
  TRANSCRIPT_CHUNK: 'transcript_chunk',
  ROOM_JOINED: 'room_joined',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  CODE_UPDATED: 'code_updated',
  CODE_RESULT: 'code_result',
  CONCEPT_GRAPH: 'concept_graph',
  ERROR: 'error',
}

export default function SessionRoom() {
  const { roomToken } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState([])
  const [sharedCode, setSharedCode] = useState('# Start coding here...\n')
  const [sharedLanguage, setSharedLanguage] = useState('python')
  const [lastResult, setLastResult] = useState(null)
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [activePane, setActivePane] = useState('split')
  const chatBottomRef = useRef(null)

  const handleMessage = (event) => {
    const { type, payload } = event

    switch (type) {
      case EVENT.ROOM_JOINED:
        setMembers(payload.members || [])
        if (payload.shared_code) setSharedCode(payload.shared_code)
        if (payload.shared_language) setSharedLanguage(payload.shared_language)
        break
      case EVENT.USER_JOINED:
        setMembers(m => [...m.filter(u => u.id !== payload.user.id), payload.user])
        setChatMessages(m => [...m, { type: 'system', text: `${payload.user.name} joined the room`, id: Date.now() }])
        break
      case EVENT.USER_LEFT:
        setMembers(m => m.filter(u => u.id !== payload.user.id))
        setChatMessages(m => [...m, { type: 'system', text: `${payload.user.name} left the room`, id: Date.now() }])
        break
      case EVENT.CODE_UPDATED:
        setSharedCode(payload.code)
        setSharedLanguage(payload.language)
        break
      case EVENT.CODE_RESULT:
        setLastResult(payload)
        break
      case EVENT.CHAT_MESSAGE:
        setChatMessages(m => [...m, { type: 'chat', ...payload, id: Date.now(), isMine: payload.sender?.id === user?.id }])
        break
      case EVENT.CONCEPT_GRAPH:
        if (payload.nodes) setGraph(payload)
        break
      case EVENT.ERROR:
        console.error('WS error:', payload.detail)
        break
    }
  }

  const { send, connected, reconnectCount } = useWebSocket(roomToken, token, handleMessage)

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  const handleCodeChange = (code, language) => send(EVENT.CODE_UPDATE, { code, language })
  const handleRunCode = (code, language) => send(EVENT.RUN_CODE, { code, language })
  const handleSendChat = () => {
    if (!chatInput.trim() || !connected) return
    send(EVENT.CHAT_MESSAGE, { text: chatInput.trim() })
    setChatInput('')
  }
  const handleTranscriptSend = (text) => send(EVENT.TRANSCRIPT_CHUNK, { text })
  const leaveRoom = () => { send(EVENT.LEAVE_ROOM, {}); navigate('/dashboard') }

  const PANES = [
    { key: 'split',  label: '⊞ Split' },
    { key: 'mirror', label: '⌥ Mirror' },
    { key: 'anchor', label: '◎ Anchor' },
    { key: 'chat',   label: '💬 Chat' + (chatMessages.filter(m => m.type === 'chat').length > 0 ? ` (${chatMessages.filter(m => m.type === 'chat').length})` : '') },
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '52px', flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>◈</div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em' }}>Athira</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            ROOM: {roomToken?.toUpperCase().substring(0, 8)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: connected ? 'var(--green)' : reconnectCount > 0 ? 'var(--amber)' : 'var(--red)', animation: connected ? 'pulse-glow 2s infinite' : 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: connected ? 'var(--green)' : reconnectCount > 0 ? 'var(--amber)' : 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {connected ? 'Live' : reconnectCount > 0 ? `Reconnecting (${reconnectCount})` : 'Disconnected'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {PANES.map(p => (
            <button key={p.key} onClick={() => setActivePane(p.key)} style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '11px',
              fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.03em',
              background: activePane === p.key ? 'var(--bg-4)' : 'transparent',
              color: activePane === p.key ? 'var(--text)' : 'var(--text-muted)',
              border: activePane === p.key ? '1px solid var(--border-bright)' : '1px solid transparent',
              transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {members.slice(0, 4).map(m => (
              <div key={m.id} title={`${m.name} (${m.role})`} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: m.role === 'tutor' ? 'rgba(124,106,247,0.25)' : 'rgba(52,211,153,0.2)',
                border: `2px solid ${m.role === 'tutor' ? 'var(--accent)' : 'var(--green)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-display)',
                color: m.role === 'tutor' ? 'var(--accent-2)' : 'var(--green)',
              }}>{m.name?.[0]?.toUpperCase()}</div>
            ))}
            {members.length === 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>Waiting for participants…</span>}
          </div>
          <button onClick={leaveRoom} style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--red)' }}>Leave</button>
        </div>
      </div>

      {/* Main workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {(activePane === 'split' || activePane === 'mirror') && (
          <div style={{ flex: activePane === 'mirror' ? 1 : '0 0 55%', borderRight: activePane === 'split' ? '1px solid var(--border)' : 'none', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <LogicMirror sharedCode={sharedCode} sharedLanguage={sharedLanguage} onCodeChange={handleCodeChange} onRunCode={handleRunCode} lastResult={lastResult} connected={connected} />
          </div>
        )}

        {(activePane === 'split' || activePane === 'anchor' || activePane === 'chat') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {(activePane === 'split' || activePane === 'anchor') && (
              <div style={{ flex: activePane === 'anchor' ? 1 : '1 1 60%', overflow: 'hidden', borderBottom: activePane === 'split' ? '1px solid var(--border)' : 'none' }}>
                <CognitiveAnchor graph={graph} onTranscriptSend={handleTranscriptSend} />
              </div>
            )}

            {(activePane === 'split' || activePane === 'chat') && (
              <div style={{ flex: activePane === 'chat' ? 1 : '0 0 40%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Session Chat</span>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>No messages yet</div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} style={{ animation: 'slideIn 0.2s ease both' }}>
                      {msg.type === 'system' ? (
                        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', padding: '4px 0' }}>— {msg.text} —</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isMine ? 'flex-end' : 'flex-start' }}>
                          {!msg.isMine && <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>{msg.sender?.name}</span>}
                          <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: msg.isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.isMine ? 'rgba(124,106,247,0.2)' : 'var(--bg-3)', border: `1px solid ${msg.isMine ? 'rgba(124,106,247,0.3)' : 'var(--border)'}`, fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
                <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} placeholder="Send a message…" disabled={!connected}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '13px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', opacity: connected ? 1 : 0.5 }} />
                  <button onClick={handleSendChat} disabled={!connected} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', fontSize: '13px', background: 'rgba(124,106,247,0.15)', border: '1px solid rgba(124,106,247,0.3)', color: 'var(--accent-2)', opacity: connected ? 1 : 0.5 }}>→</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
