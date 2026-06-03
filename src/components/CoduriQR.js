import React, { useState } from 'react'

const NAVY = '#1F3864'

// Coduri QR per apartament. Fiecare cod duce la pagina publica /raporteaza/:nrApt
// unde clientul raporteaza o problema. De printat si lipit in apartament.
export default function CoduriQR({ apts }) {
  const [filtru, setFiltru] = useState('')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const lista = (apts || [])
    .filter(a => a.status !== 'maint')
    .filter(a => !filtru || String(a.nr).toLowerCase().includes(filtru.toLowerCase()) || (a.firma || '').toLowerCase().includes(filtru.toLowerCase()))

  function qrSrc(nr) {
    const url = `${origin}/raporteaza/${encodeURIComponent(nr)}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>📱 Coduri QR — raportare probleme</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            Printează și lipește codul în fiecare apartament. Clientul scanează → raportează o problemă.
          </div>
        </div>
        <input className="fi" placeholder="Caută apartament/firmă..." value={filtru} onChange={e => setFiltru(e.target.value)}
          style={{ maxWidth: 220 }} />
        <button className="btn btn-p" onClick={() => window.print()}>🖨 Printează</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {lista.map(a => (
          <div key={a.nr} style={{ background: '#fff', border: '1px solid #E9EDF4', borderRadius: 12, padding: 12, textAlign: 'center', boxShadow: '0 1px 4px rgba(15,35,68,.06)' }}>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 18 }}>Apartament {a.nr}</div>
            {a.firma && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>{a.firma}</div>}
            <img src={qrSrc(a.nr)} alt={`QR AP ${a.nr}`} width={160} height={160}
              style={{ width: 160, height: 160, margin: '4px auto', display: 'block' }} />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Scanează pentru a raporta o problemă</div>
          </div>
        ))}
        {lista.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13 }}>Niciun apartament.</div>}
      </div>
    </div>
  )
}
