import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const RED = '#c0392b'

function formatRo(dataStr) {
  try { return new Date(dataStr).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch (e) { return '' }
}

// Notificare flotantă: probleme de mentenanță raportate de CLIENȚI, încă noi.
// onDeschide() -> trece la tab-ul Mentenanță.
export default function NotificareMentenanta({ onDeschide }) {
  const [lista, setLista] = useState([])
  const [inchis, setInchis] = useState(false)

  useEffect(() => {
    let activ = true
    supabase.from('mentenanta').select('id, nr_apt, descriere, created_at, sursa, status')
      .eq('sursa', 'client').eq('status', 'nou')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => { if (activ && !error && Array.isArray(data)) setLista(data) })
    return () => { activ = false }
  }, [])

  if (inchis || lista.length === 0) return null

  return (
    <div style={{ position: 'fixed', right: 16, top: 16, zIndex: 401, width: 320, maxWidth: 'calc(100vw - 32px)',
      background: '#fff', border: '1.5px solid #F5A0A0', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.18)', overflow: 'hidden' }}>
      <div style={{ background: '#FDECEA', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🔧</span>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: RED }}>
          {lista.length} {lista.length === 1 ? 'problemă nouă' : 'probleme noi'} de la clienți
        </div>
        <button onClick={() => setInchis(true)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: RED, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: '8px 12px', maxHeight: 240, overflowY: 'auto' }}>
        {lista.slice(0, 6).map(m => (
          <div key={m.id} style={{ padding: '7px 2px', borderTop: '1px solid #f4f6fa' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F2344' }}>AP {m.nr_apt}</div>
            <div style={{ fontSize: 12, color: '#475569', whiteSpace: 'pre-wrap' }}>{(m.descriere || '').slice(0, 100)}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{formatRo(m.created_at)}</div>
          </div>
        ))}
      </div>
      {onDeschide && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
          <button className="btn" onClick={() => { onDeschide(); setInchis(true) }}
            style={{ width: '100%', background: RED, color: '#fff', border: 'none', fontWeight: 600 }}>
            Vezi la Mentenanță
          </button>
        </div>
      )}
    </div>
  )
}
