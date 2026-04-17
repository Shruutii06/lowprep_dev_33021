import { useEffect, useRef, useState } from 'react'

const NODE_COLORS = {
  core: { bg: 'rgba(124,106,247,0.2)', border: '#7c6af7', text: '#c4b5fd', glow: 'rgba(124,106,247,0.5)' },
  related: { bg: 'rgba(52,211,153,0.15)', border: '#34d399', text: '#6ee7b7', glow: 'rgba(52,211,153,0.4)' },
  example: { bg: 'rgba(251,191,36,0.12)', border: '#fbbf24', text: '#fde68a', glow: 'rgba(251,191,36,0.35)' },
}

const NODE_RADIUS = { core: 38, related: 30, example: 24 }

function layoutNodes(nodes) {
  const core = nodes.find(n => n.type === 'core')
  const others = nodes.filter(n => n.type !== 'core')
  const laid = {}

  if (core) {
    laid[core.id] = { x: 0, y: 0 }
    const angleStep = (2 * Math.PI) / Math.max(others.length, 1)
    others.forEach((n, i) => {
      const angle = i * angleStep - Math.PI / 2
      const radius = n.type === 'related' ? 160 : 220
      laid[n.id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    })
  } else {
    const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1)
    nodes.forEach((n, i) => {
      const angle = i * angleStep
      laid[n.id] = { x: Math.cos(angle) * 150, y: Math.sin(angle) * 150 }
    })
  }
  return laid
}

export default function CognitiveAnchor({ graph, transcript, onTranscriptSend }) {
  const canvasRef = useRef(null)
  const [positions, setPositions] = useState({})
  const [dragging, setDragging] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [localTranscript, setLocalTranscript] = useState('')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef(null)
  const containerRef = useRef(null)

  const nodes = graph?.nodes || []
  const edges = graph?.edges || []
  const isMock = graph?.mock

  useEffect(() => {
    if (nodes.length > 0) {
      const laid = layoutNodes(nodes)
      setPositions(p => {
        const merged = { ...p }
        Object.entries(laid).forEach(([id, pos]) => {
          if (!merged[id]) merged[id] = pos
        })
        return merged
      })
    }
  }, [nodes.map(n => n.id).join(',')])

  const getPos = (id) => {
    const p = positions[id] || { x: 0, y: 0 }
    const cx = (containerRef.current?.clientWidth || 400) / 2 + pan.x
    const cy = (containerRef.current?.clientHeight || 300) / 2 + pan.y
    return { x: cx + p.x, y: cy + p.y }
  }

  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation()
    setDragging(nodeId)
  }

  const handleBgMouseDown = (e) => {
    panRef.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y }
  }

  const handleMouseMove = (e) => {
    if (dragging) {
      const rect = containerRef.current.getBoundingClientRect()
      const cx = rect.width / 2 + pan.x
      const cy = rect.height / 2 + pan.y
      setPositions(p => ({
        ...p,
        [dragging]: { x: e.clientX - rect.left - cx, y: e.clientY - rect.top - cy }
      }))
    } else if (panRef.current) {
      setPan({ x: e.clientX - panRef.current.startX, y: e.clientY - panRef.current.startY })
    }
  }

  const handleMouseUp = () => {
    setDragging(null)
    panRef.current = null
  }

  const sendTranscript = () => {
    if (!localTranscript.trim()) return
    onTranscriptSend?.(localTranscript.trim())
    setLocalTranscript('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cognitive Anchor</span>
          {nodes.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'rgba(124,106,247,0.1)', color: 'var(--accent-2)', border: '1px solid rgba(124,106,247,0.2)' }}>
              {nodes.length} nodes · {edges.length} edges
            </span>
          )}
          {isMock && <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>MOCK</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          {['core', 'related', 'example'].map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: NODE_COLORS[type].border }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleBgMouseDown}
      >
        {/* Grid background */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {nodes.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', pointerEvents: 'none' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>◎</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Knowledge graph awaiting session content</div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Send a transcript chunk below to populate</div>
          </div>
        ) : (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.2)" />
              </marker>
              {Object.entries(NODE_COLORS).map(([type, c]) => (
                <filter key={type} id={`glow-${type}`}>
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              ))}
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const sp = getPos(e.source)
              const tp = getPos(e.target)
              if (!sp || !tp) return null
              const mx = (sp.x + tp.x) / 2
              const my = (sp.y + tp.y) / 2
              return (
                <g key={i}>
                  <line x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                    stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" markerEnd="url(#arrow)" />
                  <text x={mx} y={my - 6} textAnchor="middle" fill="rgba(255,255,255,0.3)"
                    fontSize="10" fontFamily="var(--font-mono)">{e.label}</text>
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const pos = getPos(n.id)
              if (!pos) return null
              const colors = NODE_COLORS[n.type] || NODE_COLORS.related
              const r = NODE_RADIUS[n.type] || 28
              const isHov = hovered === n.id
              return (
                <g key={n.id} transform={`translate(${pos.x},${pos.y})`}
                  onMouseDown={e => handleMouseDown(e, n.id)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'grab' }}
                >
                  {isHov && <circle r={r + 8} fill={colors.glow} opacity={0.3} />}
                  <circle r={r} fill={colors.bg} stroke={colors.border} strokeWidth={isHov ? 2 : 1.5}
                    filter={isHov ? `url(#glow-${n.type})` : undefined} />
                  <text textAnchor="middle" dominantBaseline="middle" fill={colors.text}
                    fontSize={n.type === 'core' ? 11 : 10} fontFamily="var(--font-display)"
                    fontWeight={n.type === 'core' ? 700 : 500}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {n.label.length > 10 ? n.label.substring(0, 10) + '…' : n.label}
                  </text>
                  <text y={r + 14} textAnchor="middle" fill="rgba(255,255,255,0.25)"
                    fontSize="9" fontFamily="var(--font-mono)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {n.type}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Transcript input */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-2)', padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>Send transcript chunk (every 5 chunks updates graph)</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={localTranscript}
            onChange={e => setLocalTranscript(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendTranscript()}
            placeholder="Type what's being discussed…"
            style={{ flex: 1, padding: '8px 12px', fontSize: '13px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }}
          />
          <button onClick={sendTranscript} style={{
            padding: '8px 16px', borderRadius: 'var(--radius)', fontSize: '12px', fontWeight: 600,
            background: 'rgba(124,106,247,0.15)', border: '1px solid rgba(124,106,247,0.3)',
            color: 'var(--accent-2)', fontFamily: 'var(--font-display)',
          }}>Send</button>
        </div>
      </div>
    </div>
  )
}
