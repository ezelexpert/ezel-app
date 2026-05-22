import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
               'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

// Sarbatori legale Romania
const SARBATORI = [
  '01-01','01-02','01-24','05-01','06-01','08-15','11-30','12-01','12-25','12-26'
]

function getSeason() {
  const m = new Date().getMonth() + 1
  if ([12,1,2].includes(m)) return 'iarna'
  if ([6,7,8].includes(m)) return 'vara'
  return 'normal'
}

function isHolidayPeriod() {
  const today = new Date()
  const md = String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  return SARBATORI.includes(md)
}

function calcVenitLunar(apts) {
  const azi = new Date()
  const primaZiLuna = new Date(azi.getFullYear(), azi.getMonth(), 1)
  let total = 0
  apts.filter(a => a.firma && Number(a.pret) > 0).forEach(a => {
    if (a.tip_serviciu === 'chirie') {
      // Chirie: pret fix lunar intreg
      total += Number(a.pret) + Number(a.pret_utilitati || 0)
    } else {
      // Cazare: de la checkin (sau prima zi luna) pana azi
      const start = a.data_checkin && new Date(a.data_checkin) > primaZiLuna
        ? new Date(a.data_checkin) : primaZiLuna
      const zile = Math.max(1, Math.round((azi - start) / 86400000))
      total += zile * Number(a.pret)
    }
  })
  return Math.round(total)
}

function calcPretRecomandat(apt, ocuparePct) {
  const pretCurent = Number(apt.pret) || 85
  const season = getSeason()
  const isHoliday = isHolidayPeriod()
  let factor = 1

  // Factor ocupare
  if (ocuparePct >= 95) factor += 0.15
  else if (ocuparePct >= 90) factor += 0.10
  else if (ocuparePct >= 80) factor += 0.05
  else if (ocuparePct < 70) factor -= 0.08
  else if (ocuparePct < 60) factor -= 0.15

  // Factor sezon
  if (isHoliday) factor += 0.12
  else if (season === 'vara') factor += 0.08
  else if (season === 'iarna') factor -= 0.05

  const pretRecomandat = Math.round(pretCurent * factor / 5) * 5
  const diff = pretRecomandat - pretCurent
  return { pretRecomandat, diff, factor }
}

export default function DashboardTab({ apts, curatenii, onNavigate }) {
  const [alerte, setAlerte] = useState([])
  const [alerteLoading, setAlerteLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState(null)

  const azi = new Date()
  const aziStr = azi.toISOString().split('T')[0]
  const maine = new Date(azi); maine.setDate(maine.getDate() + 1)
  const maineStr = maine.toISOString().split('T')[0]
  const poimaine = new Date(azi); poimaine.setDate(poimaine.getDate() + 2)
  const poiStr = poimaine.toISOString().split('T')[0]

  // KPI-uri
  const total = apts.filter(a => a.status !== 'maint').length
  const ocupate = apts.filter(a => a.status === 'activ' && a.firma).length
  const libere = apts.filter(a => a.status === 'liber').length
  const elib48h = apts.filter(a => a.status === 'elib' && a.data_elib >= aziStr && a.data_elib <= poiStr)
  const ocuparePct = total > 0 ? Math.round(ocupate / total * 100) : 0
  const venitLunar = calcVenitLunar(apts)

  const curAzi = curatenii.filter(c => c.data_programata === aziStr && c.status_curatenie !== 'finalizata')
  const curFinalizateAzi = curatenii.filter(c => c.data_programata === aziStr && c.status_curatenie === 'finalizata')

  // Luna curenta
  const lunaCurenta = LUNI[azi.getMonth()]
  const anCurent = azi.getFullYear()

  // Pret recomandat - calculat pentru toate apartamentele ocupate
  const recomandarePret = useMemo(() => {
    return apts
      .filter(a => a.status === 'activ' && a.pret > 0 && a.tip_serviciu !== 'chirie')
      .map(a => ({ ...a, ...calcPretRecomandat(a, ocuparePct) }))
      .filter(a => Math.abs(a.diff) >= 5)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 5)
  }, [apts, ocuparePct])

  // Genereaza alerte
  useEffect(() => {
    async function genereazaAlerte() {
      setAlerteLoading(true)
      const alerteNoi = []

      // 1. Eliberari maine fara curatenie generala
      const elibMaine = apts.filter(a => a.status === 'elib' && a.data_elib === maineStr)
      for (const apt of elibMaine) {
        const areCurGenerala = curatenii.some(c =>
          c.nr_apt === apt.nr && c.data_programata === maineStr && c.tip_curatenie === 'generala'
        )
        if (!areCurGenerala) {
          alerteNoi.push({
            id: `elib-${apt.nr}`,
            tip: 'critica',
            icon: '🚨',
            mesaj: `AP ${apt.nr} (${apt.firma}) eliberează mâine fără curățenie programată!`,
            actiune: 'Programează curățenie',
            nr_apt: apt.nr
          })
        }
      }

      // 2. Curatenii nefinalizate azi
      const curNefin = curatenii.filter(c =>
        c.data_programata === aziStr && c.status_curatenie === 'programata'
      )
      if (curNefin.length > 0 && azi.getHours() >= 16) {
        alerteNoi.push({
          id: 'cur-nefin',
          tip: 'warning',
          icon: '⚠️',
          mesaj: `${curNefin.length} curățenii nefinalizate azi: AP ${curNefin.map(c=>c.nr_apt).join(', ')}`,
          actiune: null
        })
      }

      // 3. Apartamente libere >3 zile
      const { data: logLibere } = await supabase
        .from('log_actiuni')
        .select('nr_apt, created_at')
        .eq('actiune', 'Status schimbat la liber')
        .order('created_at', { ascending: false })

      const logMap = {}
      ;(logLibere || []).forEach(l => { if (!logMap[l.nr_apt]) logMap[l.nr_apt] = l.created_at })

      apts.filter(a => a.status === 'liber').forEach(apt => {
        const dataLiber = logMap[apt.nr]
        if (dataLiber) {
          const zileLiber = Math.round((azi - new Date(dataLiber)) / 86400000)
          if (zileLiber >= 3) {
            alerteNoi.push({
              id: `liber-${apt.nr}`,
              tip: 'info',
              icon: '📭',
              mesaj: `AP ${apt.nr} liber de ${zileLiber} zile`,
              actiune: null
            })
          }
        }
      })

      // 4. Mentenanta nerezolvata >7 zile
      const { data: mentNerez } = await supabase
        .from('mentenanta')
        .select('*')
        .neq('status', 'rezolvat')
        .lte('created_at', new Date(azi - 7*86400000).toISOString())

      ;(mentNerez || []).forEach(m => {
        const zile = Math.round((azi - new Date(m.created_at)) / 86400000)
        alerteNoi.push({
          id: `ment-${m.id}`,
          tip: 'warning',
          icon: '🔧',
          mesaj: `AP ${m.nr_apt} — mentenanță nerezolvată de ${zile} zile: ${m.descriere?.substring(0,40)}...`,
          actiune: null
        })
      })

      setAlerte(alerteNoi)
      setAlerteLoading(false)
    }
    genereazaAlerte()
  }, [apts, curatenii, aziStr, maineStr])

  const alerteCritice = alerte.filter(a => a.tip === 'critica')
  const alerteWarning = alerte.filter(a => a.tip === 'warning')
  const alerteInfo = alerte.filter(a => a.tip === 'info')

  const season = getSeason()
  const seasonLabel = { vara: '☀️ Vară', iarna: '❄️ Iarnă', normal: '🍂 Normal' }[season]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Salut + data */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0F2344', letterSpacing: '-0.5px' }}>
          Bună dimineața 👋
        </div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
          {azi.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}{seasonLabel}
          {isHolidayPeriod() && <span style={{ marginLeft: 8, background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Perioadă sărbătoare</span>}
        </div>
      </div>

      {/* Alerte critice - deasupra tuturor */}
      {alerteCritice.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {alerteCritice.map(a => (
            <div key={a.id} style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 14,
              padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#B91C1C' }}>{a.mesaj}</span>
              {a.actiune && (
                <button onClick={() => onNavigate && onNavigate(0)}
                  style={{ padding: '6px 12px', background: '#B91C1C', color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {a.actiune}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>

        {/* Venit lunar */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #0F2344 0%, #1A3A6B 100%)', border: 'none', color: '#fff' }}>
          <div style={{ fontSize: 11, opacity: .7, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            Venit {lunaCurenta} până azi
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px' }}>
            {venitLunar.toLocaleString('ro-RO')}
          </div>
          <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>RON</div>
        </div>

        {/* Ocupare */}
        <div className="card">
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Ocupare</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: ocuparePct >= 90 ? '#1A7A4A' : ocuparePct >= 70 ? '#B45309' : '#B91C1C' }}>
            {ocuparePct}%
          </div>
          <div style={{ height: 4, background: '#E9EDF4', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${ocuparePct}%`, borderRadius: 99,
              background: ocuparePct >= 90 ? '#1A7A4A' : ocuparePct >= 70 ? '#B45309' : '#B91C1C',
              transition: 'width .5s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{ocupate}/{total} apartamente</div>
        </div>

        {/* Curatenii azi */}
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('curatenie')}>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Curățenii azi</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0F2344' }}>{curAzi.length}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
            {curFinalizateAzi.length} finalizate · {curAzi.length - curFinalizateAzi.length} rămase
          </div>
          <div style={{ height: 4, background: '#E9EDF4', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#1A7A4A',
              width: curAzi.length + curFinalizateAzi.length > 0
                ? `${Math.round(curFinalizateAzi.length/(curAzi.length+curFinalizateAzi.length)*100)}%` : '0%' }} />
          </div>
        </div>

        {/* Libere */}
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate && onNavigate(1)}>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Libere acum</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: libere > 0 ? '#B91C1C' : '#1A7A4A' }}>{libere}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>apartamente disponibile</div>
        </div>

        {/* Eliberari 48h */}
        <div className="card">
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Eliberează 48h</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: elib48h.length > 0 ? '#B45309' : '#0F2344' }}>{elib48h.length}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
            {elib48h.length > 0 ? elib48h.map(a => `AP${a.nr}`).join(', ') : 'Nicio eliberare'}
          </div>
        </div>

        {/* Mentenanta */}
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate && onNavigate(6)}>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Mentenanță</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#B45309' }}>
            {alerteWarning.filter(a => a.id.startsWith('ment')).length}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>probleme deschise</div>
        </div>
      </div>

      {/* Row 2: Eliberari detaliu + Alerte + Pret dinamic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Eliberari detaliu */}
        <div className="card">
          <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📅</span> Eliberări în curând
          </div>
          {apts.filter(a => a.status === 'elib' && a.data_elib)
            .sort((a,b) => a.data_elib > b.data_elib ? 1 : -1)
            .slice(0, 8)
            .map(apt => {
              const zileRamase = Math.round((new Date(apt.data_elib) - azi) / 86400000)
              const areCur = curatenii.some(c => c.nr_apt === apt.nr && c.data_programata === apt.data_elib && c.tip_curatenie === 'generala')
              return (
                <div key={apt.nr} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EEF4FF',
                    color: '#1A3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{apt.nr}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F2344',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.firma}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{apt.data_elib}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {areCur
                      ? <span style={{ fontSize: 10, background: '#E8F7EF', color: '#1A7A4A', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>✓ Cur.</span>
                      : <span style={{ fontSize: 10, background: '#FEE2E2', color: '#B91C1C', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>⚠ Lipsă</span>
                    }
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: zileRamase === 0 ? '#B91C1C' : zileRamase === 1 ? '#B45309' : '#0F2344' }}>
                      {zileRamase === 0 ? 'Azi' : zileRamase === 1 ? 'Mâine' : `${zileRamase}z`}
                    </span>
                  </div>
                </div>
              )
            })}
          {apts.filter(a => a.status === 'elib').length === 0 && (
            <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Nicio eliberare programată
            </div>
          )}
        </div>

        {/* Alerte + Pret dinamic */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Alerte */}
          <div className="card" style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔔</span> Alerte
              {alerte.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#FEE2E2', color: '#B91C1C',
                  padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                  {alerte.length}
                </span>
              )}
            </div>
            {alerteLoading ? (
              <div style={{ color: '#94A3B8', fontSize: 12 }}>Se verifică...</div>
            ) : alerte.length === 0 ? (
              <div style={{ color: '#1A7A4A', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✅</span> Totul e în regulă!
              </div>
            ) : (
              <div>
                {[...alerteWarning, ...alerteInfo].slice(0, 5).map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 8, padding: '7px 0',
                    borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                    <span>{a.icon}</span>
                    <span style={{ color: a.tip === 'warning' ? '#B45309' : '#475569' }}>{a.mesaj}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pret dinamic */}
          <div className="card">
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>💡</span> Recomandări preț
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>Ocupare: {ocuparePct}%</span>
            </div>
            {recomandarePret.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: 12 }}>Prețurile curente sunt optime.</div>
            ) : (
              recomandarePret.slice(0, 4).map(a => (
                <div key={a.nr} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#0F2344', minWidth: 28 }}>AP{a.nr}</span>
                  <span style={{ color: '#475569', flex: 1 }}>{a.pret} → {a.pretRecomandat} RON</span>
                  <span style={{ fontWeight: 700,
                    color: a.diff > 0 ? '#1A7A4A' : '#B91C1C',
                    background: a.diff > 0 ? '#E8F7EF' : '#FEE2E2',
                    padding: '2px 8px', borderRadius: 99, fontSize: 11 }}>
                    {a.diff > 0 ? '+' : ''}{a.diff} RON
                  </span>
                </div>
              ))
            )}
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8 }}>
              * Bazat pe ocupare curentă + sezon. Tu decizi.
            </div>
          </div>
        </div>
      </div>

      {/* Curatenii azi - detaliu */}
      {curAzi.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧹</span> Curățenii programate azi
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>
              {curFinalizateAzi.length}/{curAzi.length + curFinalizateAzi.length} finalizate
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {curAzi
              .sort((a,b) => parseInt(a.nr_apt) - parseInt(b.nr_apt))
              .map(c => (
                <div key={c.id} style={{ padding: '5px 10px', borderRadius: 10,
                  background: c.tip_curatenie === 'generala' ? '#FEE2E2' : '#EEF4FF',
                  color: c.tip_curatenie === 'generala' ? '#B91C1C' : '#1A3A6B',
                  fontSize: 12, fontWeight: 600 }}>
                  AP {c.nr_apt}
                  {c.tip_curatenie === 'generala' && <span style={{ marginLeft: 4, opacity: .7 }}>G</span>}
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  )
}
