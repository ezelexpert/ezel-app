import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const NAVY = '#1F3864'
const KEY = 'coduri_qr'

function qrSrc(origin, cod) {
  const url = `${origin}/raporteaza/${encodeURIComponent(cod)}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(url)}`
}

function formatRo(s) {
  try { return new Date(s).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch (e) { return '' }
}

// Generator de coduri QR pentru raportarea problemelor.
// Managerul scrie locația/apartamentul -> se generează un cod care duce la
// /raporteaza/<valoare> (valoarea e preluată automat la scanare).
// Codurile generate rămân într-un istoric (salvat în tabela `setari`, id 'coduri_qr').
export default function CoduriQR() {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [lista, setLista] = useState([])
  const [val, setVal] = useState('')
  const [selectat, setSelectat] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('setari').select('valoare').eq('id', KEY).single()
      .then(({ data }) => {
        if (data && Array.isArray(data.valoare)) setLista(data.valoare)
      })
  }, [])

  async function salveaza(next) {
    setLista(next)
    await supabase.from('setari').upsert({ id: KEY, valoare: next, updated_at: new Date().toISOString() })
  }

  async function genereaza() {
    const cod = val.trim()
    if (!cod) return
    setSaving(true)
    const intrare = { cod, created_at: new Date().toISOString() }
    const next = [intrare, ...lista.filter(x => x.cod !== cod)]
    await salveaza(next)
    setSelectat(cod)
    setVal('')
    setSaving(false)
  }

  async function sterge(cod) {
    if (!window.confirm(`Ștergi codul pentru "${cod}"?`)) return
    await salveaza(lista.filter(x => x.cod !== cod))
    if (selectat === cod) setSelectat(null)
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>📱 Coduri QR — raportare probleme</div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>
          Scrie locația sau apartamentul, generează codul și printează-l. La scanare, valoarea e preluată automat.
        </div>
      </div>

      {/* Generator */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input className="fi" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') genereaza() }}
          placeholder="ex: 12  sau  Cladirea A"
          style={{ maxWidth: 260 }} />
        <button className="btn btn-p" disabled={saving || !val.trim()} onClick={genereaza}>
          {saving ? '...' : '+ Generează cod'}
        </button>
      </div>

      {/* Posterul codului selectat */}
      {selectat && (
        <div style={{ maxWidth: 460, margin: '0 auto 18px', background: '#fff', border: '2px solid #E9EDF4', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 2px 10px rgba(15,35,68,.08)' }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 24, letterSpacing: 1 }}>EZEL</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginTop: 10 }}>Ai o problemă?</div>
          <div style={{ display: 'inline-block', background: '#EBF1FB', color: NAVY, fontWeight: 700, fontSize: 16, padding: '4px 14px', borderRadius: 99, margin: '8px 0' }}>
            📍 {selectat}
          </div>
          <div style={{ fontSize: 14, color: '#475569', margin: '4px 0 16px' }}>
            Scanează codul cu telefonul și descrie problema (poți adăuga și o poză).
          </div>
          <img src={qrSrc(origin, selectat)} alt={`Cod QR ${selectat}`} width={260} height={260}
            style={{ width: 260, height: 260, margin: '0 auto', display: 'block' }} />
          <button className="btn btn-p" style={{ marginTop: 14 }} onClick={() => window.print()}>🖨 Printează</button>
        </div>
      )}

      {/* Istoric coduri generate */}
      <div style={{ fontWeight: 700, color: NAVY, fontSize: 14, marginBottom: 8 }}>Istoric coduri ({lista.length})</div>
      {lista.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>Niciun cod generat încă.</div>}
      <div style={{ display: 'grid', gap: 6 }}>
        {lista.map(item => (
          <div key={item.cod} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E9EDF4', borderRadius: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>📍 {item.cod}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>generat: {formatRo(item.created_at)}</div>
            </div>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setSelectat(item.cod)}>Vezi / Printează</button>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 12, background: '#FDECEA', color: '#c0392b', border: '1px solid #F5A0A0' }} onClick={() => sterge(item.cod)}>Șterge</button>
          </div>
        ))}
      </div>
    </div>
  )
}
