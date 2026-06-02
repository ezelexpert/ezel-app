import React, { useState, useEffect } from 'react'
import {
  getSetariZile, salveazaSetariZile, listaSarbatoriRO, isZiLucratoare
} from '../lib/zileLucratoare'

const NAVY = '#1F3864'

function formatRo(dataStr) {
  try {
    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', weekday: 'short' })
  } catch (e) { return dataStr }
}

// Panou de configurare a zilelor lucratoare:
//  - weekend on/off
//  - sarbatori legale RO (auto) cu override „se lucreaza / nu se lucreaza"
export default function ZileLucratoarePanel({ onSaved }) {
  const [open, setOpen] = useState(false)
  const [setari, setSetari] = useState({ weekend: false, override: {} })
  const [an, setAn] = useState(new Date().getFullYear())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getSetariZile(true).then(s => setSetari({ weekend: !!s.weekend, override: { ...(s.override || {}) } }))
  }, [])

  async function salveaza(next) {
    setSaving(true)
    try {
      await salveazaSetariZile(next)
      setSetari(next)
      setMsg('✓ Salvat')
      setTimeout(() => setMsg(''), 2500)
      if (onSaved) onSaved(next)
    } catch (e) {
      setMsg('Eroare la salvare')
    }
    setSaving(false)
  }

  function toggleWeekend() {
    salveaza({ ...setari, weekend: !setari.weekend })
  }

  // Comuta override pentru o zi: lucratoare <-> nelucratoare.
  function toggleZi(dataStr, esteLucratoareImplicit) {
    const nextOverride = { ...setari.override }
    const are = Object.prototype.hasOwnProperty.call(nextOverride, dataStr)
    if (are) {
      // exista override -> il scoatem (revine la valoarea implicita)
      delete nextOverride[dataStr]
    } else {
      // adaugam override-ul opus valorii implicite
      nextOverride[dataStr] = !esteLucratoareImplicit
    }
    salveaza({ ...setari, override: nextOverride })
  }

  const sarbatori = listaSarbatoriRO(an)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E9EDF4', boxShadow: '0 1px 4px rgba(15,35,68,.06)', marginBottom: 14 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'pointer' }}>
        <span style={{ fontSize: 16 }}>📅</span>
        <span style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>Zile lucrătoare & sărbători</span>
        <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>
          Weekend: {setari.weekend ? 'se lucrează' : 'liber'}
        </span>
        {msg && <span style={{ fontSize: 12, color: '#375623', marginLeft: 8 }}>{msg}</span>}
        <span style={{ marginLeft: 'auto', color: '#94A3B8' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Weekend toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Se lucrează în weekend</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Sâmbătă și duminică (implicit: liber)</div>
            </div>
            <button
              onClick={toggleWeekend}
              disabled={saving}
              style={{
                width: 52, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer',
                background: setari.weekend ? '#375623' : '#cbd5e1', position: 'relative', transition: 'background .2s'
              }}>
              <span style={{
                position: 'absolute', top: 3, left: setari.weekend ? 27 : 3, width: 22, height: 22,
                borderRadius: '50%', background: '#fff', transition: 'left .2s'
              }} />
            </button>
          </div>

          {/* Sarbatori legale */}
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Sărbători legale România</div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="btn" style={{ padding: '2px 8px' }} onClick={() => setAn(a => a - 1)}>◀</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, minWidth: 44, textAlign: 'center' }}>{an}</span>
                <button className="btn" style={{ padding: '2px 8px' }} onClick={() => setAn(a => a + 1)}>▶</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>
              Implicit nelucrătoare. Apasă butonul pentru a marca o zi „se lucrează" (override manual).
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {sarbatori.map(s => {
                const lucr = isZiLucratoare(s.data, setari)
                const areOverride = Object.prototype.hasOwnProperty.call(setari.override || {}, s.data)
                return (
                  <div key={s.data} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10,
                    background: lucr ? '#FEF3C7' : '#F1F5F9', border: '1px solid #E9EDF4'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{s.nume}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{formatRo(s.data)}{areOverride ? ' · modificat manual' : ''}</div>
                    </div>
                    <button
                      onClick={() => toggleZi(s.data, false)}
                      disabled={saving}
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: '1px solid', borderColor: lucr ? '#C0DD97' : '#CBD5E1',
                        background: lucr ? '#E2EFDA' : '#fff', color: lucr ? '#375623' : '#64748B'
                      }}>
                      {lucr ? '✓ Se lucrează' : 'Nu se lucrează'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
