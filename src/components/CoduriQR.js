import React from 'react'

const NAVY = '#1F3864'

// Un SINGUR cod QR pe locație. Clientul scanează, scrie numărul apartamentului,
// descrie problema și poate atașa o poză. De printat o dată și lipit la intrare/avizier.
export default function CoduriQR() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/raporteaza`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(url)}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>📱 Cod QR — raportare probleme</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            Un singur cod pentru toată locația. Printează-l și lipește-l la intrare / avizier.
          </div>
        </div>
        <button className="btn btn-p" onClick={() => window.print()}>🖨 Printează</button>
      </div>

      {/* Posterul de printat */}
      <div style={{ maxWidth: 460, margin: '0 auto', background: '#fff', border: '2px solid #E9EDF4', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 2px 10px rgba(15,35,68,.08)' }}>
        <div style={{ fontWeight: 800, color: NAVY, fontSize: 24, letterSpacing: 1 }}>EZEL</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginTop: 10 }}>Ai o problemă în apartament?</div>
        <div style={{ fontSize: 14, color: '#475569', margin: '8px 0 16px' }}>
          Scanează codul de mai jos cu telefonul, scrie <b>numărul apartamentului</b> și <b>problema</b> (poți adăuga și o poză).
        </div>
        <img src={qrSrc} alt="Cod QR raportare problemă" width={260} height={260}
          style={{ width: 260, height: 260, margin: '0 auto', display: 'block' }} />
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 14 }}>
          Sau intră pe: <span style={{ color: NAVY, fontWeight: 600 }}>{url}</span>
        </div>
      </div>
    </div>
  )
}
