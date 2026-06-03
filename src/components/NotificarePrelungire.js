import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const NAVY = '#1F3864'

function formatRo(dataStr) {
  try {
    return new Date(dataStr + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
  } catch (e) { return dataStr }
}

// Notificare flotantă pentru manageri: rezervări deschise cărora curățeniile
// programate li se termină în ≤ 7 zile. Apare zilnic cât timp condiția e adevărată.
// Managerul confirmă prelungirea cu încă 2 luni (sau o lasă să expire).
export default function NotificarePrelungire() {
  const [lista, setLista] = useState([])
  const [inchis, setInchis] = useState(false)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let activ = true
    supabase.rpc('rezervari_de_prelungit').then(({ data, error }) => {
      if (activ && !error && Array.isArray(data)) setLista(data)
    })
    return () => { activ = false }
  }, [])

  async function prelungeste(rezId) {
    setBusy(rezId)
    try {
      await supabase.rpc('programeaza_curatenii_continuare', { p_rezervare_id: rezId })
      setLista(prev => prev.filter(r => r.rezervare_id !== rezId))
    } catch (e) { /* noop */ }
    setBusy(null)
  }

  if (inchis || lista.length === 0) return null

  return (
    <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 400, width: 320, maxWidth: 'calc(100vw - 32px)',
      background: '#fff', border: '1.5px solid #C7DAFF', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.18)', overflow: 'hidden' }}>
      <div style={{ background: '#EBF1FB', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: NAVY }}>
          {lista.length} {lista.length === 1 ? 'rezervare' : 'rezervări'} de prelungit
        </div>
        <button onClick={() => setInchis(true)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: NAVY, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: '8px 12px', maxHeight: 280, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
          Curățeniile programate se termină în curând. Confirmă dacă clientul rămâne.
        </div>
        {lista.map(r => (
          <div key={r.rezervare_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 2px', borderTop: '1px solid #f4f6fa' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>AP {r.nr_apt} · {r.firma}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>ultima curățenie: {formatRo(r.ultima_curatenie)}</div>
            </div>
            <button className="btn" disabled={busy === r.rezervare_id}
              onClick={() => prelungeste(r.rezervare_id)}
              style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#E2EFDA', color: '#375623', border: '1px solid #C0DD97', whiteSpace: 'nowrap' }}>
              {busy === r.rezervare_id ? '...' : '+ 2 luni'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
