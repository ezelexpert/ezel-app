import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { adaugaMentenanta } from '../lib/supabase'

const NAVY = '#1F3864'

// Pagină PUBLICĂ (fără login) pentru clienți: raportează o problemă la apartament.
// Accesată prin cod QR: /raporteaza/:nrApt
export default function RaporteazaProblema() {
  const { nrApt } = useParams()
  const [descriere, setDescriere] = useState('')
  const [contact, setContact] = useState('')
  const [foto, setFoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [trimis, setTrimis] = useState(false)
  const [eroare, setEroare] = useState('')

  async function trimite() {
    if (!descriere.trim()) { setEroare('Te rugăm descrie problema.'); return }
    setSaving(true); setEroare('')
    try {
      const desc = contact.trim()
        ? `${descriere.trim()}\n\n📞 Contact: ${contact.trim()}`
        : descriere.trim()
      await adaugaMentenanta({ nr_apt: nrApt || '?', descriere: desc, sursa: 'client' }, foto)
      setTrimis(true)
    } catch (e) {
      setEroare('A apărut o eroare. Mai încearcă o dată.')
    }
    setSaving(false)
  }

  const wrap = { minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 14px', fontFamily: 'system-ui, sans-serif' }
  const card = { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(15,35,68,.10)', padding: 22 }

  if (trimis) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <h2 style={{ color: NAVY, margin: '6px 0' }}>Mulțumim!</h2>
          <p style={{ color: '#475569', fontSize: 15 }}>
            Problema a fost trimisă echipei. Ne ocupăm cât mai repede.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 20 }}>EZEL</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Raportează o problemă</div>
          <div style={{ display: 'inline-block', marginTop: 8, background: '#EBF1FB', color: NAVY, fontWeight: 700, fontSize: 14, padding: '4px 12px', borderRadius: 99 }}>
            Apartament {nrApt || '—'}
          </div>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', marginBottom: 6 }}>Ce problemă ai?</label>
        <textarea value={descriere} onChange={e => setDescriere(e.target.value)}
          placeholder="Ex: nu merge boilerul, curge robinetul din baie, s-a ars un bec..."
          rows={5}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #CBD5E1', padding: '10px 12px', fontSize: 15, resize: 'vertical' }} />

        <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', margin: '14px 0 6px' }}>Nume / telefon (opțional)</label>
        <input value={contact} onChange={e => setContact(e.target.value)}
          placeholder="ca să te putem contacta"
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #CBD5E1', padding: '10px 12px', fontSize: 15 }} />

        <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: 'block', margin: '14px 0 6px' }}>Poză (opțional)</label>
        <input type="file" accept="image/*" onChange={e => setFoto(e.target.files?.[0] || null)}
          style={{ fontSize: 14 }} />

        {eroare && <div style={{ color: '#c0392b', fontSize: 13, marginTop: 12 }}>{eroare}</div>}

        <button onClick={trimite} disabled={saving}
          style={{ width: '100%', marginTop: 18, padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: NAVY, color: '#fff', fontWeight: 700, fontSize: 16 }}>
          {saving ? 'Se trimite...' : 'Trimite problema'}
        </button>
      </div>
    </div>
  )
}
