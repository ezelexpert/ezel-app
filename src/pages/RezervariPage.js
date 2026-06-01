import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getNume } from '../lib/auth'

// ── Utils ─────────────────────────────────────────────────────
function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function addZile(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function diffZile(a, b) {
  const d1 = new Date(a); d1.setHours(0,0,0,0)
  const d2 = new Date(b); d2.setHours(0,0,0,0)
  return Math.round((d2-d1)/86400000)
}
function parseD(s) { if(!s) return null; const d=new Date(s+'T12:00:00'); return isNaN(d)?null:d }
// Datele "deschise" sunt salvate ca 2099-12-31. Afișează ca "Deschis"
const DATA_DESCHIS = '2099-12-31'
function isDataDeschis(s) { return s === DATA_DESCHIS || (s && s.startsWith('2099')) }
function formatData(s) {
  if (!s) return '—'
  if (isDataDeschis(s)) return 'Deschis'
  return s
}
function normalizeData(d) {
  if (!d || !d.trim()) return ''
  const s = d.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const an = new Date().getFullYear()
  if (/^\d{2}\.\d{2}$/.test(s)) { const [zi,luna]=s.split('.'); return `${an}-${luna.padStart(2,'0')}-${zi.padStart(2,'0')}` }
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) { const [zi,luna,a]=s.split('.'); return `${a}-${luna.padStart(2,'0')}-${zi.padStart(2,'0')}` }
  return s
}

const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const LUNI_SC = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']
const ZI_SC = ['Du','Lu','Ma','Mi','Jo','Vi','Sa']
const COL_W = 32, ROW_H = 44, LABEL_W = 140

const TIP_COLORS = {
  cazare:   { bg:'rgba(26,58,107,.38)', border:'#1A3A6B33', text:'#0F2344' },
  chirie:   { bg:'rgba(15,118,110,.38)', border:'#0F766E33', text:'#134E4A' },
  rezervat: { bg:'rgba(180,83,9,.22)', border:'#B4530933', text:'#78350F' },
  elib:     { bg:'rgba(185,28,28,.35)', border:'#B91C1C33', text:'#7F1D1D' },
}

function firmaColor(firma) {
  if (!firma) return '#94A3B8'
  let h = 0
  for (let i=0;i<firma.length;i++) h = firma.charCodeAt(i) + ((h<<5)-h)
  return `hsl(${Math.abs(h)%360},55%,38%)`
}

// ── Modal rezervare complet ───────────────────────────────────
function ModalRezervare({ apt, seg, apts, curatenii, onClose, onSave, onContract, onReloadRezervari }) {
  const [activeTab, setActiveTab] = useState('detalii')
  // Detectează dacă editezi o rezervare existentă, creezi una nouă cu interval (drag), sau ad-hoc
  const editRez = apt?._editRezervare || null
  const newRezervFromDrag = apt?._newRezerv ? { checkin: apt.data_checkin, checkout: apt.data_elib, tip: apt.tip_serviciu } : null
  const [form, setForm] = useState({
    firma: editRez?.firma || '',
    tip_serviciu: editRez?.tip_serviciu || newRezervFromDrag?.tip || 'cazare',
    data_checkin: editRez?.data_checkin || newRezervFromDrag?.checkin || '',
    data_elib: editRez?.data_checkout || newRezervFromDrag?.checkout || '',
    pret: editRez?.pret || editRez?.pret_noapte || apt?.pret || '',
    pret_utilitati: editRez?.pret_utilitati || 0,
    utilitati_tip: editRez?.utilitati_tip || 'fix',
    plata: editRez?.plata || 'OP',
    nota: editRez?.nota || '',
    prosop: editRez?.prosop || false,
    nr_locuri: editRez?.nr_locuri || apt?.nr_locuri || 2,
    status_plata: editRez?.status_plata || 'neplatit',
    observatii: editRez?.observatii || '',
    sursa: editRez?.sursa || 'telefon',
  })
  const [saving, setSaving] = useState(false)
  const [eroare, setEroare] = useState('')
  const [curForm, setCurForm] = useState({
    tip_curatenie: 'intretinere',
    data_programata: new Date().toISOString().split('T')[0],
    observatii: ''
  })
  const [curSaved, setCurSaved] = useState(false)

  const aziStr = new Date().toISOString().split('T')[0]
  const curApt = curatenii.filter(c => String(c.nr_apt) === String(apt?.nr))
    .sort((a,b) => a.data_programata > b.data_programata ? 1 : -1)

  const nrNopti = form.data_checkin && form.data_elib
    ? diffZile(normalizeData(form.data_checkin), normalizeData(form.data_elib))
    : null
  const totalEstimat = nrNopti && form.pret ? nrNopti * Number(form.pret) : null

  async function handleSave() {
    setSaving(true)
    setEroare('')

    // Validări
    if (!form.firma.trim()) {
      setEroare('Completează firma!')
      setSaving(false)
      return
    }
    const checkin = normalizeData(form.data_checkin)
    const checkout = normalizeData(form.data_elib)
    if (!checkin) {
      setEroare('Completează data check-in!')
      setSaving(false)
      return
    }
    if (!checkout) {
      setEroare('Completează data check-out!')
      setSaving(false)
      return
    }
    if (checkout <= checkin) {
      setEroare('Check-out trebuie să fie după check-in!')
      setSaving(false)
      return
    }

    // Verifică suprapuneri cu alte rezervări ale acestui apartament
    const { data: existRez } = await supabase
      .from('rezervari')
      .select('id, firma, data_checkin, data_checkout, status')
      .eq('nr_apt', String(apt.nr))
      .neq('status', 'anulata')

    const conflict = (existRez || []).find(r => {
      if (editRez && r.id === editRez.id) return false  // exclude rezervarea curentă din verificare
      // Suprapunere: NOT (existing_end <= new_start OR existing_start >= new_end)
      return !(r.data_checkout <= checkin || r.data_checkin >= checkout)
    })
    if (conflict) {
      setEroare(`Suprapunere cu: ${conflict.firma} (${conflict.data_checkin} → ${formatData(conflict.data_checkout)})`)
      setSaving(false)
      return
    }

    // Calculează nr_nopti și total
    const nrNoptiCalc = Math.round((new Date(checkout) - new Date(checkin)) / 86400000)
    const pret = Number(form.pret) || 0
    const aziDate = new Date().toISOString().split('T')[0]
    const status = checkin > aziDate ? 'rezervata' : 'activa'

    const payload = {
      nr_apt: String(apt.nr),
      firma: form.firma.trim(),
      tip_serviciu: form.tip_serviciu || 'cazare',
      tip_apt: apt.tip || 'simplu',
      data_checkin: checkin,
      data_checkout: checkout,
      pret, pret_noapte: pret,
      pret_utilitati: Number(form.pret_utilitati) || 0,
      utilitati_tip: form.utilitati_tip || 'fix',
      plata: form.plata || 'OP',
      nota: form.nota || '',
      prosop: form.prosop === true,
      nr_locuri: Number(form.nr_locuri) || 2,
      status_plata: form.status_plata || 'neplatit',
      observatii: form.observatii || '',
      sursa: form.sursa || 'telefon',
      creat_de: editRez?.creat_de || getNume() || '',
      nr_nopti: nrNoptiCalc,
      total: nrNoptiCalc * pret,
      status
    }

    let error = null
    if (editRez) {
      // Update rezervare existentă
      const { error: e } = await supabase.from('rezervari').update(payload).eq('id', editRez.id)
      error = e
    } else {
      // Insert rezervare nouă
      const { error: e } = await supabase.from('rezervari').insert(payload)
      error = e
    }

    if (error) {
      if (error.code === '23P01' || error.message?.includes('rezervari_no_overlap')) {
        setEroare('Suprapunere cu altă rezervare')
      } else {
        setEroare('Eroare: ' + error.message)
      }
      setSaving(false)
      return
    }

    // Reload rezervări în parent (apartamentul se sincronizează automat prin trigger)
    if (onReloadRezervari) await onReloadRezervari()
    setSaving(false)
    onClose()
  }

  async function handleStergeRezervare() {
    if (!editRez) return
    if (!window.confirm(`Ștergi rezervarea pentru ${editRez.firma} (${editRez.data_checkin} → ${formatData(editRez.data_checkout)})?`)) return
    setSaving(true)
    await supabase.from('rezervari').delete().eq('id', editRez.id)
    if (onReloadRezervari) await onReloadRezervari()
    setSaving(false)
    onClose()
  }

  async function handleProgramareCuratenie() {
    await supabase.from('curatenie').insert({
      data_programata: curForm.data_programata,
      nr_apt: apt.nr,
      tip_apt: apt.tip || 'simplu',
      firma: form.firma || apt.firma,
      tip_curatenie: curForm.tip_curatenie,
      status_curatenie: 'programata',
      observatii: curForm.observatii,
      amanare_status: ''
    })
    setCurSaved(true)
    setTimeout(() => setCurSaved(false), 2000)
  }

  async function handleSetLiber() {
    // În sistemul nou: setarea apartamentului liber = ștergerea rezervării active
    // Caută rezervarea activă acum
    const { data: rezAct } = await supabase
      .from('rezervari').select('*')
      .eq('nr_apt', String(apt.nr))
      .lte('data_checkin', aziStr)
      .gte('data_checkout', aziStr)
      .neq('status', 'anulata')
      .limit(1).maybeSingle()

    if (!rezAct) {
      alert('Apartamentul nu are rezervare activă acum.')
      return
    }

    if (!window.confirm(`Ștergi rezervarea activă a apartamentului (${rezAct.firma})?`)) return
    await supabase.from('rezervari').delete().eq('id', rezAct.id)
    if (onReloadRezervari) await onReloadRezervari()
    onClose()
  }

  const TABS_MOD = [
    { key:'detalii', label:'✏️ Detalii' },
    { key:'curatenie', label:'🧹 Curățenie' },
    { key:'contract', label:'📄 Contract' },
    { key:'istoric', label:'📋 Istoric' },
  ]

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'#EEF4FF', color:'#1A3A6B',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 }}>
            {apt?.nr}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#0F2344' }}>
              AP {apt?.nr} {apt?.tip==='dublu'?'· Dublu':''}
            </div>
            <div style={{ fontSize:12, color:'#94A3B8' }}>
              {form.firma || 'Liber'}{form.tip_serviciu==='chirie'?' · Chirie':''}
              {form.data_elib ? ` · Elib. ${form.data_elib}` : ''}
            </div>
          </div>


          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
        </div>

        {/* Sub-nav */}
        <div style={{ display:'flex', gap:2, background:'#F1F5F9', borderRadius:10, padding:3, marginBottom:16 }}>
          {TABS_MOD.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ flex:1, padding:'6px 4px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:11, fontWeight:500, transition:'all .15s',
                background:activeTab===t.key?'#fff':'transparent',
                color:activeTab===t.key?'#0F2344':'#64748B',
                boxShadow:activeTab===t.key?'0 1px 3px rgba(0,0,0,.08)':'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB DETALII ── */}
        {activeTab === 'detalii' && (
          <div>
            <div className="fg">
              <label className="fl">Firmă client</label>
              <input className="fi" value={form.firma} onChange={e=>setForm(p=>({...p,firma:e.target.value}))}
                placeholder="Numele firmei" />
            </div>

            <div className="fg">
              <label className="fl">Tip serviciu</label>
              <div style={{ display:'flex', gap:6 }}>
                {['cazare','chirie'].map(t => (
                  <div key={t} onClick={() => setForm(p=>({...p,tip_serviciu:t}))}
                    style={{ flex:1, padding:'8px 0', borderRadius:10, textAlign:'center', cursor:'pointer',
                      fontWeight:600, fontSize:12, border:'2px solid',
                      borderColor:form.tip_serviciu===t?'#0F2344':'#E9EDF4',
                      background:form.tip_serviciu===t?'#0F2344':'#fff',
                      color:form.tip_serviciu===t?'#fff':'#475569' }}>
                    {t==='cazare'?'🌙 Cazare':'🏠 Chirie'}
                  </div>
                ))}
              </div>
            </div>

            <div className="r2">
              <div className="fg">
                <label className="fl">Data check-in</label>
                <input className="fi" value={form.data_checkin}
                  onChange={e=>setForm(p=>({...p,data_checkin:e.target.value}))}
                  placeholder="ex: 01.06" />
              </div>
              <div className="fg">
                <label className="fl">Data eliberare</label>
                <input className="fi" value={form.data_elib}
                  onChange={e=>setForm(p=>({...p,data_elib:e.target.value}))}
                  placeholder="ex: 30.06" />
              </div>
            </div>

            {nrNopti !== null && nrNopti > 0 && (
              <div style={{ padding:'8px 12px', background:'#EEF4FF', borderRadius:10,
                fontSize:12, color:'#1A3A6B', marginBottom:12, display:'flex', gap:8, alignItems:'center' }}>
                <span>📅</span>
                <span><strong>{nrNopti} {form.tip_serviciu==='chirie'?'zile':'nopți'}</strong>
                  {totalEstimat ? ` · Total estimat: ${totalEstimat.toLocaleString()} RON` : ''}
                </span>
              </div>
            )}

            <div className="r2">
              <div className="fg">
                <label className="fl">{form.tip_serviciu==='chirie'?'Preț/lună':'Preț/noapte'} (RON)</label>
                <input type="number" className="fi" value={form.pret}
                  onChange={e=>setForm(p=>({...p,pret:e.target.value}))} />
              </div>
              <div className="fg">
                <label className="fl">Plată</label>
                <select className="fi" value={form.plata} onChange={e=>setForm(p=>({...p,plata:e.target.value}))}>
                  <option value="OP">OP</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>

            <div className="fg">
              <label className="fl">Sursă rezervare</label>
              <select className="fi" value={form.sursa} onChange={e=>setForm(p=>({...p,sursa:e.target.value}))}>
                <option value="telefon">Telefon</option>
                <option value="airbnb">Airbnb</option>
                <option value="booking">Booking</option>
                <option value="website">Website</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {form.tip_serviciu === 'chirie' && (
              <div className="r2">
                <div className="fg">
                  <label className="fl">Utilități (RON)</label>
                  <input type="number" className="fi" value={form.pret_utilitati}
                    onChange={e=>setForm(p=>({...p,pret_utilitati:e.target.value}))} />
                </div>
                <div className="fg">
                  <label className="fl">Tip utilități</label>
                  <select className="fi" value={form.utilitati_tip} onChange={e=>setForm(p=>({...p,utilitati_tip:e.target.value}))}>
                    <option value="fix">Fix</option>
                    <option value="variabil">Variabil</option>
                  </select>
                </div>
              </div>
            )}

            <div className="fg">
              <label className="fl">Notă (ex: 2c/l)</label>
              <input className="fi" value={form.nota}
                onChange={e=>setForm(p=>({...p,nota:e.target.value}))}
                placeholder="ex: 2c/l" />
            </div>

            {/* Prosop toggle */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
              background:'#F8FAFC', borderRadius:12, marginBottom:14, cursor:'pointer' }}
              onClick={() => setForm(p=>({...p,prosop:!p.prosop}))}>
              <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, display:'flex',
                alignItems:'center', justifyContent:'center',
                background:form.prosop?'#0F2344':'#E9EDF4',
                border:`2px solid ${form.prosop?'#0F2344':'#D1D9E6'}` }}>
                {form.prosop && <span style={{ color:'#fff', fontSize:12 }}>✓</span>}
              </div>
              <span style={{ fontSize:13, fontWeight:500, color:'#0F2344' }}>🛁 Prosop inclus</span>
            </div>

            {/* Mesaj eroare */}
            {eroare && (
              <div style={{ padding:'10px 12px', background:'#FEE2E2', border:'1px solid #FECACA',
                borderRadius:8, color:'#B91C1C', fontSize:13, marginBottom:8 }}>
                ⚠️ {eroare}
              </div>
            )}

            {/* Creat de */}
            {editRez && editRez.creat_de && (
              <div style={{ fontSize:11, color:'#94A3B8', marginBottom:8 }}>
                Creat de: {editRez.creat_de}
              </div>
            )}

            {/* Actiuni */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="btn btn-p" style={{ flex:1 }} onClick={handleSave} disabled={saving}>
                {saving ? '⏳...' : (editRez ? '✓ Salvează modificările' : '✓ Salvează rezervarea')}
              </button>
              {editRez && (
                <button className="btn" style={{ background:'#FEE2E2', color:'#B91C1C', border:'1px solid #FECACA' }}
                  onClick={handleStergeRezervare} disabled={saving}>
                  🗑 Șterge
                </button>
              )}
              <button className="btn" onClick={onClose}>Anulează</button>
            </div>
          </div>
        )}

        {/* ── TAB CURATENIE ── */}
        {activeTab === 'curatenie' && (
          <div>
            {/* Curateniile existente */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#94A3B8', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:8 }}>Programate</div>
              {curApt.filter(c => c.status_curatenie !== 'finalizata').length === 0 ? (
                <div style={{ fontSize:12, color:'#94A3B8', padding:'12px 0' }}>Nicio curățenie programată.</div>
              ) : curApt.filter(c => c.status_curatenie !== 'finalizata').map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0',
                  borderBottom:'1px solid #F1F5F9', fontSize:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: c.tip_curatenie==='generala'?'#B91C1C':c.tip_curatenie==='urgenta'?'#B45309':'#1A3A6B' }} />
                  <span style={{ fontWeight:600, color:'#0F2344' }}>{c.data_programata}</span>
                  <span style={{ color:'#64748B' }}>{c.tip_curatenie}</span>
                  <span style={{ marginLeft:'auto', fontSize:10, padding:'2px 8px', borderRadius:99,
                    background:'#EEF4FF', color:'#1A3A6B' }}>{c.status_curatenie}</span>
                </div>
              ))}
            </div>

            {/* Finalizate recent */}
            {curApt.filter(c => c.status_curatenie === 'finalizata').length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#94A3B8', textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:8 }}>Ultimele finalizate</div>
                {curApt.filter(c => c.status_curatenie === 'finalizata')
                  .sort((a,b) => b.data_programata.localeCompare(a.data_programata))
                  .slice(0,3).map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0',
                    borderBottom:'1px solid #F1F5F9', fontSize:12 }}>
                    <span style={{ color:'#1A7A4A', fontWeight:700 }}>✓</span>
                    <span style={{ color:'#0F2344' }}>{c.data_programata}</span>
                    <span style={{ color:'#64748B' }}>{c.tip_curatenie}</span>
                    {c.facut_de && <span style={{ marginLeft:'auto', color:'#94A3B8', fontSize:11 }}>{c.facut_de}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Programeaza noua */}
            <div style={{ background:'#F8FAFC', borderRadius:14, padding:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#0F2344', marginBottom:12 }}>
                + Programează curățenie nouă
              </div>
              <div className="fg">
                <label className="fl">Tip</label>
                <select className="fi" value={curForm.tip_curatenie}
                  onChange={e=>setCurForm(p=>({...p,tip_curatenie:e.target.value}))}>
                  <option value="intretinere">Întreținere — același client</option>
                  <option value="generala">Generală — la plecare</option>
                  <option value="urgenta">Urgență</option>
                </select>
              </div>
              <div className="fg">
                <label className="fl">Data</label>
                <input type="date" className="fi" value={curForm.data_programata}
                  onChange={e=>setCurForm(p=>({...p,data_programata:e.target.value}))} />
              </div>
              <div className="fg">
                <label className="fl">Observații</label>
                <input className="fi" value={curForm.observatii}
                  onChange={e=>setCurForm(p=>({...p,observatii:e.target.value}))}
                  placeholder="Opțional" />
              </div>
              <button className="btn btn-g" onClick={handleProgramareCuratenie} style={{ width:'100%' }}>
                {curSaved ? '✓ Programat!' : '✓ Programează'}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB CONTRACT ── */}
        {activeTab === 'contract' && (
          <div>
            <div style={{ textAlign:'center', padding:'16px 0' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#0F2344', marginBottom:6 }}>
                Contract {form.tip_serviciu === 'chirie' ? 'Închiriere' : 'Cazare'}
              </div>
              <div style={{ fontSize:12, color:'#94A3B8', marginBottom:20 }}>
                {form.firma || 'Firmă necompletată'} · AP {apt?.nr}
                {form.data_checkin && form.data_elib ? ` · ${form.data_checkin} — ${form.data_elib}` : ''}
              </div>
              {!form.firma ? (
                <div style={{ padding:'12px', background:'#FEF3C7', borderRadius:12, fontSize:12, color:'#B45309', marginBottom:16 }}>
                  ⚠️ Completează firma și datele în tab-ul Detalii înainte de a genera contractul.
                </div>
              ) : (
                <button className="btn btn-p" style={{ width:'100%', height:44, fontSize:14 }}
                  onClick={() => onContract && onContract(apt, form)}>
                  ⬇️ Generează & Descarcă Contract
                </button>
              )}
              <div style={{ fontSize:11, color:'#94A3B8', marginTop:12 }}>
                Contractul se generează cu datele completate mai sus. Poți modifica înainte de generare.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB ISTORIC ── */}
        {activeTab === 'istoric' && (
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'#94A3B8', textTransform:'uppercase',
              letterSpacing:'.05em', marginBottom:10 }}>Toate curățeniile</div>
            {curApt.length === 0 ? (
              <div style={{ fontSize:12, color:'#94A3B8', textAlign:'center', padding:'24px 0' }}>
                Nicio activitate înregistrată pentru AP {apt?.nr}.
              </div>
            ) : (
              <div style={{ maxHeight:360, overflowY:'auto' }}>
                {curApt.sort((a,b) => b.data_programata.localeCompare(a.data_programata)).map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8,
                    padding:'9px 0', borderBottom:'1px solid #F1F5F9', fontSize:12 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                      background: c.status_curatenie==='finalizata'?'#1A7A4A':c.tip_curatenie==='generala'?'#B91C1C':'#1A3A6B' }} />
                    <span style={{ fontWeight:600, color:'#0F2344', minWidth:80 }}>{c.data_programata}</span>
                    <span style={{ color:'#64748B', flex:1 }}>{c.tip_curatenie}</span>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:600,
                      background: c.status_curatenie==='finalizata'?'#E8F7EF':c.status_curatenie==='in progres'?'#FEF3C7':'#EEF4FF',
                      color: c.status_curatenie==='finalizata'?'#1A7A4A':c.status_curatenie==='in progres'?'#B45309':'#1A3A6B' }}>
                      {c.status_curatenie}
                    </span>
                    {c.facut_de && <span style={{ fontSize:11, color:'#94A3B8' }}>{c.facut_de}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal selectie tip rezervare ─────────────────────────────
function ModalTipRezervare({ onSelect, onClose, apt, checkin, checkout }) {
  const zile = checkin && checkout ? diffZile(checkin, checkout) : 0
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:360 }} onClick={e=>e.stopPropagation()}>
        <div className="mhdr">
          <div className="mtitle">Rezervare nouă — AP {apt?.nr}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
        </div>
        <div style={{ fontSize:12, color:'#94A3B8', marginBottom:16 }}>
          {checkin} → {checkout} · {zile} {zile===1?'zi':'zile'}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div onClick={() => onSelect('cazare')}
            style={{ padding:'16px', borderRadius:14, border:'2px solid #E9EDF4', cursor:'pointer',
              background:'#fff', transition:'all .15s', display:'flex', alignItems:'center', gap:12 }}
            onMouseOver={e => { e.currentTarget.style.borderColor='#1A3A6B'; e.currentTarget.style.background='#EEF4FF' }}
            onMouseOut={e => { e.currentTarget.style.borderColor='#E9EDF4'; e.currentTarget.style.background='#fff' }}>
            <div style={{ fontSize:28 }}>🌙</div>
            <div>
              <div style={{ fontWeight:700, color:'#0F2344', fontSize:14 }}>Cazare</div>
              <div style={{ fontSize:12, color:'#94A3B8' }}>Preț pe noapte · {zile} nopți</div>
            </div>
          </div>
          <div onClick={() => onSelect('chirie')}
            style={{ padding:'16px', borderRadius:14, border:'2px solid #E9EDF4', cursor:'pointer',
              background:'#fff', transition:'all .15s', display:'flex', alignItems:'center', gap:12 }}
            onMouseOver={e => { e.currentTarget.style.borderColor='#0F766E'; e.currentTarget.style.background='#F0FDFA' }}
            onMouseOut={e => { e.currentTarget.style.borderColor='#E9EDF4'; e.currentTarget.style.background='#fff' }}>
            <div style={{ fontSize:28 }}>🏠</div>
            <div>
              <div style={{ fontWeight:700, color:'#0F2344', fontSize:14 }}>Chirie</div>
              <div style={{ fontSize:12, color:'#94A3B8' }}>Preț lunar fix</div>
            </div>
          </div>
          <div onClick={() => onSelect('rezervat')}
            style={{ padding:'16px', borderRadius:14, border:'2px solid #E9EDF4', cursor:'pointer',
              background:'#fff', transition:'all .15s', display:'flex', alignItems:'center', gap:12 }}
            onMouseOver={e => { e.currentTarget.style.borderColor='#B45309'; e.currentTarget.style.background='#FFFBEB' }}
            onMouseOut={e => { e.currentTarget.style.borderColor='#E9EDF4'; e.currentTarget.style.background='#fff' }}>
            <div style={{ fontSize:28 }}>📅</div>
            <div>
              <div style={{ fontWeight:700, color:'#0F2344', fontSize:14 }}>Rezervat viitor</div>
              <div style={{ fontSize:12, color:'#94A3B8' }}>Client confirmат, nu a intrat încă</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componenta principala ─────────────────────────────────────
export default function RezervariPage({
  apts, curatenii, selApts, onSelApt, onEditApt,
  onSaveApt, onAddCuratenie, onStergeCuratenii, onEditLocuri, onMultiEdit, onMultiCuratenie,
  onContract
}) {
  const [view, setView] = useState('timeline')
  const [calAn, setCalAn] = useState(new Date().getFullYear())
  const [calLuna, setCalLuna] = useState(new Date().getMonth())
  const [rezervari, setRezervari] = useState([])
  const [loading, setLoading] = useState(true)
  const [srch, setSrch] = useState('')
  const [fltTip, setFltTip] = useState('')
  const [fltFirma, setFltFirma] = useState('')
  const [tooltip, setTooltip] = useState(null)
  const [modalApt, setModalApt] = useState(null) // apt selectat pt modal detalii
  const [dragState, setDragState] = useState(null)
  const [modalTip, setModalTip] = useState(null) // { apt, checkin, checkout }
  const [heatmapZi, setHeatmapZi] = useState(null)
  const [previziuni, setPreviziuni] = useState(null)

  const azi = useMemo(() => { const d=new Date(); d.setHours(0,0,0,0); return d }, [])
  const aziStr = dateStr(azi)

  const zile = useMemo(() => {
    const nrZile = new Date(calAn, calLuna+1, 0).getDate()
    const start = new Date(calAn, calLuna, 1); start.setHours(0,0,0,0)
    return Array.from({ length: nrZile }, (_, i) => addZile(start, i))
  }, [calAn, calLuna])

  const startDate = useMemo(() => new Date(calAn, calLuna, 1), [calAn, calLuna])

  useEffect(() => {
    // Încarcă TOATE rezervările (active + rezervate + finalizate, dar fără anulate)
    supabase.from('rezervari').select('*').neq('status','anulata').order('data_checkin', { ascending: false })
      .then(({ data }) => { setRezervari(data||[]); setLoading(false) })
  }, [])

  // Reload rezervări (după save/delete)
  async function reloadRezervari() {
    const { data } = await supabase.from('rezervari').select('*').neq('status','anulata').order('data_checkin', { ascending: false })
    setRezervari(data || [])
  }

  useEffect(() => {
    const aziF = new Date()
    const primaZi = new Date(aziF.getFullYear(), aziF.getMonth(), 1)
    const ultimaZi = new Date(aziF.getFullYear(), aziF.getMonth()+1, 0)
    const zileRamase = ultimaZi.getDate() - aziF.getDate() + 1
    let venitAzi=0, venitEstimat=0, venitLunaViit=0
    apts.filter(a=>a.firma&&Number(a.pret)>0).forEach(a => {
      const p = Number(a.pret)
      if (a.tip_serviciu==='chirie') {
        venitAzi += p + Number(a.pret_utilitati||0)
        venitEstimat += p + Number(a.pret_utilitati||0)
        if (!a.data_elib||a.data_elib>dateStr(ultimaZi)) venitLunaViit += p
      } else {
        const start = a.data_checkin&&new Date(a.data_checkin)>primaZi?new Date(a.data_checkin):primaZi
        const zileFacute = Math.max(0, diffZile(dateStr(start), aziStr))
        venitAzi += zileFacute * p
        venitEstimat += (a.data_elib&&a.data_elib<=dateStr(ultimaZi)) ? zileFacute*p : (zileFacute+zileRamase)*p
        if (!a.data_elib||a.data_elib>dateStr(ultimaZi)) venitLunaViit += 28*p
      }
    })
    setPreviziuni({ venitAzi:Math.round(venitAzi), venitEstimat:Math.round(venitEstimat), venitLunaViit:Math.round(venitLunaViit) })
  }, [apts, aziStr])

  // Segmente timeline
  const segments = useMemo(() => {
    const endDate = addZile(startDate, zile.length)
    const allApts = [...apts].sort((a,b)=>(parseInt(a.nr)||999)-(parseInt(b.nr)||999))
    const filtered = allApts.filter(a => {
      // Filtru search: caută în nr_apt + firme din rezervările lui
      const aptRezervari = rezervari.filter(r => String(r.nr_apt) === String(a.nr))
      const firmePeApt = aptRezervari.map(r => r.firma).join(' ')
      const mQ = !srch||(a.nr+' '+firmePeApt).toLowerCase().includes(srch.toLowerCase())
      // Filtru tip: bazat pe rezervările apartamentului
      const mT = !fltTip || aptRezervari.some(r => {
        if (fltTip === 'rezervat') return r.status === 'rezervata'
        return r.tip_serviciu === fltTip
      })
      // Filtru firmă: are vreo rezervare cu firma asta
      const mF = !fltFirma || aptRezervari.some(r => r.firma === fltFirma)
      return mQ&&mT&&mF
    })
    const map = {}
    filtered.forEach(apt => {
      const segs = []
      // Pentru fiecare rezervare a apartamentului, creează un segment
      const rez = rezervari.filter(r => String(r.nr_apt) === String(apt.nr))
      rez.forEach(r => {
        const segStart = parseD(r.data_checkin) || addZile(azi,-90)
        const segEnd = parseD(r.data_checkout) || addZile(azi,90)
        const visStart = segStart<startDate?startDate:segStart
        const visEnd = segEnd>endDate?endDate:segEnd
        if (visStart>=visEnd) return

        // Determine status display pentru culoare:
        // - 'rezervata' (viitor) → rezervat (portocaliu)
        // - 'activa' care s-a terminat (data_checkout <= azi) → elib (roșu)
        // - 'activa' care e în curs sau viitor → activ (albastru)
        let displayStatus = 'activ'
        if (r.status === 'rezervata') displayStatus = 'rezervat'
        else if (r.data_checkout && r.data_checkout <= aziStr) displayStatus = 'elib'

        segs.push({
          status: displayStatus,
          rezervareId: r.id,
          isViitor: r.status === 'rezervata',
          firma: r.firma,
          tip: r.tip_serviciu || 'cazare',
          pret: r.pret || r.pret_noapte,
          elib: r.data_checkout,
          checkin: r.data_checkin,
          status_plata: r.status_plata,
          offsetDays: diffZile(startDate, visStart),
          lengthDays: diffZile(visStart, visEnd),
          isStartClipped: segStart<startDate,
          isEndClipped: segEnd>endDate,
          apt,
          rezervare: r
        })
      })
      map[apt.nr] = segs
    })
    return { map, filtered }
  }, [apts, rezervari, startDate, zile, srch, fltTip, fltFirma, azi, aziStr])

  // Drag
  const handleMouseDown = useCallback((aptNr, dayIdx, e) => {
    e.preventDefault()
    setDragState({ aptNr, startDay:dayIdx, endDay:dayIdx, active:true })
  }, [])
  const handleMouseEnter = useCallback((aptNr, dayIdx) => {
    if (!dragState?.active||dragState.aptNr!==aptNr) return
    setDragState(p=>p?{...p,endDay:dayIdx}:null)
  }, [dragState])
  const handleMouseUp = useCallback(() => {
    if (!dragState?.active) return
    const start = Math.min(dragState.startDay, dragState.endDay)
    const end = Math.max(dragState.startDay, dragState.endDay)
    const apt = segments.filtered.find(a=>a.nr===dragState.aptNr)
    if (apt && end>=start) {
      const checkin = dateStr(addZile(startDate, start))
      const checkout = dateStr(addZile(startDate, end+1))
      setModalTip({ apt, checkin, checkout })
    }
    setDragState(null)
  }, [dragState, segments, startDate])
  useEffect(() => {
    const up = () => { if(dragState?.active) handleMouseUp() }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [dragState, handleMouseUp])

  function handleTipSelect(tip) {
    if (!modalTip) return
    const { apt, checkin, checkout } = modalTip
    setModalTip(null)
    if (tip === 'rezervat') {
      setModalApt({ ...apt, rezervat_checkin: checkin, status:'rezervat', _newRezerv:true, _checkin:checkin, _checkout:checkout, _tip:tip })
    } else {
      setModalApt({ ...apt, data_checkin: checkin, data_elib: checkout, tip_serviciu: tip, _newRezerv:true })
    }
  }

  async function handleSaveApt(nr, fields) {
    await onSaveApt(nr, fields)
  }

  const firmeUnice = useMemo(() => [...new Set(rezervari.filter(r=>r.firma).map(r=>r.firma))].sort(), [rezervari])
  const dragRange = dragState?.active ? { aptNr:dragState.aptNr, start:Math.min(dragState.startDay,dragState.endDay), end:Math.max(dragState.startDay,dragState.endDay) } : null

  // Heatmap
  const heatmapData = useMemo(() => {
    const data = {}
    const totalApts = apts.filter(a=>a.status!=='maint').length
    for (let luna=0;luna<12;luna++) {
      const nrZile2 = new Date(calAn,luna+1,0).getDate()
      for (let zi=1;zi<=nrZile2;zi++) {
        const ds = `${calAn}-${String(luna+1).padStart(2,'0')}-${String(zi).padStart(2,'0')}`
        const ocupate = apts.filter(a => {
          if (!a.firma||a.status==='maint') return false
          return ds>=(a.data_checkin||'2020-01-01')&&ds<=(a.data_elib||'2099-12-31')
        }).length
        data[ds] = totalApts>0?Math.round(ocupate/totalApts*100):0
      }
    }
    return data
  }, [apts, calAn])

  function heatColor(p) {
    if(p>=90) return '#1A7A4A'; if(p>=75) return '#65A30D'
    if(p>=60) return '#CA8A04'; if(p>=40) return '#EA580C'; return '#B91C1C'
  }

  function exportCSV() {
    const rows=[['Nr Apt','Firmă','Tip','Check-in','Check-out','Nopți','Preț/noapte','Total','Status plată']]
    rezervari.forEach(r=>rows.push([r.nr_apt,r.firma,r.tip_serviciu,r.data_checkin,r.data_checkout,r.nr_nopti,r.pret_noapte,r.total,r.status_plata]))
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const el=document.createElement('a');el.href=url;el.download=`rezervari-${aziStr}.csv`;el.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ fontFamily:'inherit', userSelect:'none' }}>

      {/* Previziuni */}
      {previziuni && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:18 }}>
          {[
            { l:'Venit luna curentă', v:`${previziuni.venitAzi.toLocaleString()} RON`, c:'#fff', bg:'linear-gradient(135deg,#0F2344,#1A3A6B)' },
            { l:'Estimat fin. lunii', v:`${previziuni.venitEstimat.toLocaleString()} RON`, c:'#1A7A4A', bg:'#E8F7EF' },
            { l:'Estimat luna viitoare', v:`${previziuni.venitLunaViit.toLocaleString()} RON`, c:'#B45309', bg:'#FEF3C7' },
            { l:'Apartamente libere', v:`${apts.filter(a=>a.status==='liber').length}`, c:'#B91C1C', bg:'#FEE2E2' },
          ].map(k=>(
            <div key={k.l} style={{ borderRadius:16, padding:'14px 16px', background:k.bg,
              border:k.c==='#fff'?'none':'1px solid rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:10, color:k.c==='#fff'?'rgba(255,255,255,.6)':k.c, textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:5, opacity:k.c==='#fff'?1:.8 }}>{k.l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:k.c, letterSpacing:'-0.5px' }}>{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:2, background:'#F1F5F9', borderRadius:10, padding:3 }}>
          {[['timeline','📅'],['lista','📋'],['heatmap','🔥']].map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)}
              style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                background:view===k?'#fff':'transparent', color:view===k?'#0F2344':'#64748B',
                boxShadow:view===k?'0 1px 3px rgba(0,0,0,.08)':'none' }}>{l} {k.charAt(0).toUpperCase()+k.slice(1)}</button>
          ))}
        </div>
        {view!=='heatmap'&&<>
          <input placeholder="Caută..." value={srch} onChange={e=>setSrch(e.target.value)}
            style={{ flex:1, minWidth:120, height:34, padding:'0 10px', border:'1.5px solid #E9EDF4', borderRadius:10, fontSize:13, outline:'none' }}/>
          <select value={fltTip} onChange={e=>setFltTip(e.target.value)}
            style={{ height:34, padding:'0 10px', border:'1.5px solid #E9EDF4', borderRadius:10, fontSize:12, background:'#fff' }}>
            <option value="">Toate</option>
            <option value="cazare">Cazare</option>
            <option value="chirie">Chirie</option>
            <option value="rezervat">Rezervat</option>
          </select>
          <select value={fltFirma} onChange={e=>setFltFirma(e.target.value)}
            style={{ height:34, padding:'0 10px', border:'1.5px solid #E9EDF4', borderRadius:10, fontSize:12, background:'#fff', maxWidth:150 }}>
            <option value="">Toate firmele</option>
            {firmeUnice.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </>}
        {view!=='lista'&&<>
          <button onClick={()=>{let l=calLuna-1,a=calAn;if(l<0){l=11;a--};setCalLuna(l);setCalAn(a)}}
            style={{ height:34, width:34, border:'1.5px solid #E9EDF4', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:16 }}>◀</button>
          <div style={{ height:34, padding:'0 14px', border:'1.5px solid #1A3A6B', borderRadius:10, background:'#EEF4FF', color:'#1A3A6B', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', minWidth:150, justifyContent:'center' }}>
            {view==='heatmap'?calAn:`${LUNI[calLuna]} ${calAn}`}
          </div>
          <button onClick={()=>{let l=calLuna+1,a=calAn;if(l>11){l=0;a++};setCalLuna(l);setCalAn(a)}}
            style={{ height:34, width:34, border:'1.5px solid #E9EDF4', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:16 }}>▶</button>
        </>}
        {view==='lista'&&<button onClick={exportCSV} className="btn" style={{ marginLeft:'auto' }}>⬇️ CSV</button>}
      </div>

      {/* Hint */}
      {view==='timeline'&&(
        <div style={{ fontSize:11, color:'#94A3B8', marginBottom:8 }}>
          💡 Click pe o rezervare pentru detalii și editare · Trage pe zone libere pentru rezervare nouă
        </div>
      )}

      {/* ══ TIMELINE ══ */}
      {view==='timeline'&&(
        <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E9EDF4', background:'#fff' }}>
          <div style={{ minWidth:LABEL_W+COL_W*zile.length }}>
            {/* Header */}
            <div style={{ display:'flex', borderBottom:'1px solid #E9EDF4', background:'#F8FAFC', position:'sticky', top:0, zIndex:10 }}>
              <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:'1px solid #E9EDF4', padding:'6px 10px', fontSize:11, color:'#94A3B8', fontWeight:600 }}>APARTAMENT</div>
              {zile.map((z,i)=>{
                const isWe=z.getDay()===0||z.getDay()===6
                const isAzi2=z.toDateString()===azi.toDateString()
                return (
                  <div key={i} style={{ width:COL_W, minWidth:COL_W, textAlign:'center', padding:'3px 0',
                    background:isAzi2?'#EEF4FF':isWe?'#FFF8F8':'transparent',
                    borderRight:'0.5px solid #F1F5F9', borderBottom:isAzi2?'2px solid #1A3A6B':'none' }}>
                    <div style={{ fontSize:8, color:'#94A3B8', height:10 }}>{i===0||z.getDate()===1?LUNI_SC[z.getMonth()]:''}</div>
                    <div style={{ fontSize:11, fontWeight:isAzi2?700:500, color:isAzi2?'#1A3A6B':isWe?'#FDA4AF':'#0F2344' }}>{z.getDate()}</div>
                    <div style={{ fontSize:8, color:isWe?'#FDA4AF':'#94A3B8' }}>{ZI_SC[z.getDay()]}</div>
                  </div>
                )
              })}
            </div>
            {/* Rows */}
            {segments.filtered.map(apt=>{
              const aptSegs=segments.map[apt.nr]||[]
              const isLiber=apt.status==='liber'
              const isSel=selApts?.has(apt.nr)
              const isDbl=apt.tip==='dublu'||String(apt.nr).startsWith('D')
              return (
                <div key={apt.nr} style={{ display:'flex', borderBottom:'0.5px solid #F1F5F9', height:ROW_H,
                  background:isSel?'rgba(26,58,107,.04)':isLiber?'rgba(232,247,239,.15)':'white',
                  borderLeft:`3px solid ${isSel?'#1A3A6B':'transparent'}` }}>
                  {/* Label */}
                  <div style={{ width:LABEL_W, minWidth:LABEL_W, borderRight:'1px solid #E9EDF4',
                    padding:'0 8px', display:'flex', alignItems:'center', gap:6,
                    background:isSel?'rgba(26,58,107,.06)':isLiber?'rgba(232,247,239,.3)':'#FAFAFA',
                    position:'sticky', left:0, zIndex:5 }}>
                    {onSelApt&&(
                      <input type="checkbox" checked={isSel||false}
                        onChange={e=>{e.stopPropagation();onSelApt(apt.nr)}}
                        style={{ flexShrink:0, cursor:'pointer', accentColor:'#1A3A6B' }}/>
                    )}
                    <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={()=>{
                      // Caută rezervarea activă acum
                      const aptRez = rezervari.filter(r => String(r.nr_apt) === String(apt.nr))
                      const azi = aziStr
                      const activa = aptRez.find(r => r.data_checkin <= azi && r.data_checkout > azi)
                      const viitoare = aptRez.filter(r => r.data_checkin > azi).sort((a,b) => a.data_checkin > b.data_checkin ? 1 : -1)[0]
                      // Editează activa, sau viitoarea cea mai apropiată, sau rezervare nouă
                      const target = activa || viitoare
                      setModalApt({...apt, _editRezervare: target || null})
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontWeight:700, fontSize:12, color:'#0F2344' }}>AP {apt.nr}</span>
                        {isDbl&&<span style={{ fontSize:9, background:'#EDE9FE', color:'#5B21B6', padding:'1px 5px', borderRadius:99 }}>2x</span>}
                        {apt.prosop&&<span style={{ fontSize:10 }}>🛁</span>}
                      </div>
                      <div style={{ fontSize:10, color:'#94A3B8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {apt.firma||'Liber'}{apt.pret>0?` · ${apt.pret}RON`:''}
                        {apt.nota?` · ${apt.nota}`:''}
                      </div>
                    </div>
                  </div>
                  {/* Celule */}
                  <div style={{ display:'flex', flex:1, position:'relative' }}>
                    {zile.map((z,zi)=>{
                      const isWe=z.getDay()===0||z.getDay()===6
                      const isAzi3=z.toDateString()===azi.toDateString()
                      const isDragSel=dragRange?.aptNr===apt.nr&&zi>=dragRange.start&&zi<=dragRange.end
                      const isOcc=aptSegs.some(s=>zi>=s.offsetDays&&zi<s.offsetDays+s.lengthDays)
                      return (
                        <div key={zi} style={{ width:COL_W, minWidth:COL_W, height:'100%', position:'relative',
                          background:isDragSel?'rgba(26,58,107,.1)':isAzi3?'rgba(14,165,233,.03)':isWe?'rgba(253,164,175,.03)':'transparent',
                          borderRight:'0.5px solid #F1F5F9', cursor:isOcc?'default':'crosshair' }}
                          onMouseDown={e=>!isOcc&&handleMouseDown(apt.nr,zi,e)}
                          onMouseEnter={()=>handleMouseEnter(apt.nr,zi)}>
                          {isAzi3&&<div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1.5, background:'#0EA5E9', opacity:.35, pointerEvents:'none' }}/>}
                        </div>
                      )
                    })}
                    {/* Bare */}
                    {aptSegs.map((seg,si)=>{
                      const colorKey = seg.status==='elib'?'elib':seg.isViitor?'rezervat':seg.tip
                      const colors = TIP_COLORS[colorKey]||TIP_COLORS.cazare
                      const left=seg.offsetDays*COL_W+2
                      const width=Math.max(seg.lengthDays*COL_W-4,4)
                      return (
                        <div key={si}
                          onClick={()=>{setTooltip(null);setModalApt({...seg.apt, _editRezervare: seg.rezervare})}}
                          onMouseEnter={e=>{e.stopPropagation();setTooltip({seg,x:e.clientX,y:e.clientY})}}
                          onMouseLeave={()=>setTooltip(null)}
                          style={{ position:'absolute', left, top:5, height:ROW_H-10, width,
                            background:seg.isViitor?'transparent':colors.bg, zIndex:4, cursor:'pointer',
                            borderRadius:`${seg.isStartClipped?0:8}px ${seg.isEndClipped?0:8}px ${seg.isEndClipped?0:8}px ${seg.isStartClipped?0:8}px`,
                            border:seg.isViitor?`2px dashed ${colors.border}`:`1.5px solid ${colors.border}`,
                            display:'flex', alignItems:'center', paddingLeft:6, overflow:'hidden',
                            boxShadow:'0 1px 4px rgba(0,0,0,.08)' }}
                          onMouseOver={e=>e.currentTarget.style.opacity='.8'}
                          onMouseOut={e=>e.currentTarget.style.opacity='1'}>
                          {!seg.isViitor&&!seg.isStartClipped&&(
                            <div style={{ width:3, height:'65%', borderRadius:99, background:firmaColor(seg.firma), marginRight:5, flexShrink:0 }}/>
                          )}
                          {width>40&&(
                            <span style={{ fontSize:10, fontWeight:600, color:colors.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
                              {seg.isViitor?`📅 ${seg.firma||'Rezervat'}`:seg.firma}
                              {seg.elib&&!seg.isEndClipped&&width>80?` → ${seg.elib.substring(5)}`:''}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {/* Drag preview */}
                    {dragRange?.aptNr===apt.nr&&(
                      <div style={{ position:'absolute', left:dragRange.start*COL_W+2, top:5, height:ROW_H-10,
                        width:(dragRange.end-dragRange.start+1)*COL_W-4, background:'rgba(26,58,107,.15)',
                        borderRadius:8, zIndex:3, border:'2px dashed #1A3A6B', pointerEvents:'none',
                        display:'flex', alignItems:'center', paddingLeft:8 }}>
                        <span style={{ fontSize:11, color:'#1A3A6B', fontWeight:700 }}>
                          {dragRange.end-dragRange.start+1}z
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {segments.filtered.length===0&&(
              <div style={{ padding:48, textAlign:'center', color:'#94A3B8', fontSize:13 }}>Niciun apartament găsit.</div>
            )}
          </div>
        </div>
      )}

      {/* ══ LISTA ══ */}
      {view==='lista'&&(
        <>
        <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E9EDF4', background:'#fff' }}>
          <table className="tbl">
            <thead><tr>
              <th>Apt</th><th>Firmă</th><th>Status</th><th>Tip</th><th>Check-in</th><th>Check-out</th>
              <th>Zile rămase</th><th>Preț/noapte</th><th>Total</th><th>Plată</th>
            </tr></thead>
            <tbody>
              {rezervari.filter(r => {
                  if (srch && !((r.nr_apt + ' ' + (r.firma||'')).toLowerCase().includes(srch.toLowerCase()))) return false
                  if (fltFirma && r.firma !== fltFirma) return false
                  if (fltTip) {
                    if (fltTip === 'rezervat' && r.status !== 'rezervata') return false
                    if (fltTip !== 'rezervat' && r.tip_serviciu !== fltTip) return false
                  }
                  return true
                })
                .sort((a,b) => {
                  // Sortare: rezervate (viitor) primul, apoi active, apoi finalizate (cele mai recente primul)
                  if (a.status !== b.status) {
                    if (a.status === 'rezervata') return -1
                    if (b.status === 'rezervata') return 1
                  }
                  return a.data_checkin < b.data_checkin ? 1 : -1
                })
                .map(r=>{
                  const apt = apts.find(a => String(a.nr) === String(r.nr_apt))
                  const zR = r.data_checkout ? diffZile(aziStr, r.data_checkout) : null
                  const e = r.data_checkout && r.data_checkout <= aziStr
                  const v = r.data_checkin > aziStr
                  return (
                    <tr key={r.id} style={{ cursor:'pointer', opacity: e ? 0.65 : 1 }}
                        onClick={()=>setModalApt({...(apt||{nr:r.nr_apt}), _editRezervare: r})}>
                      <td><strong>{r.nr_apt}</strong>{r.prosop?<span style={{marginLeft:4}}>🛁</span>:null}</td>
                      <td><div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:firmaColor(r.firma),flexShrink:0}}/>
                        {r.firma}
                      </div></td>
                      <td><span className="badge" style={{fontSize:10,
                        background: v ? '#FEF3C7' : e ? '#FEE2E2' : '#DCFCE7',
                        color: v ? '#92400E' : e ? '#991B1B' : '#166534'}}>
                        {v ? 'Viitor' : e ? 'Finalizat' : 'Activ'}
                      </span></td>
                      <td><span className={r.tip_serviciu==='chirie'?'badge bk':'badge bb'} style={{fontSize:10}}>{r.tip_serviciu||'cazare'}</span></td>
                      <td style={{fontSize:12}}>{r.data_checkin||'—'}</td>
                      <td style={{fontSize:12}}>{formatData(r.data_checkout)}</td>
                      <td>{zR!==null && !e && !isDataDeschis(r.data_checkout) ? <span style={{fontWeight:700,color:zR<=3?'#B91C1C':zR<=7?'#B45309':'#1A7A4A'}}>{zR<=0?'Azi':zR===1?'Mâine':`${zR}z`}</span> : isDataDeschis(r.data_checkout) ? <span style={{color:'#94A3B8',fontSize:11}}>Deschis</span> : <span style={{color:'#94A3B8'}}>—</span>}</td>
                      <td style={{fontWeight:600}}>{r.pret ? `${r.pret} RON` : '—'}</td>
                      <td style={{fontWeight:700,color:'#1A3A6B'}}>{r.total && !isDataDeschis(r.data_checkout) ? `${Number(r.total).toLocaleString()} RON` : <span style={{color:'#94A3B8',fontSize:11}}>—</span>}</td>
                      <td style={{fontSize:11}}><span className="badge" style={{fontSize:10,
                        background: r.status_plata === 'platit' ? '#DCFCE7' : r.status_plata === 'partial' ? '#FEF3C7' : '#FEE2E2',
                        color: r.status_plata === 'platit' ? '#166534' : r.status_plata === 'partial' ? '#92400E' : '#991B1B'}}>
                        {r.status_plata || 'neplatit'}
                      </span></td>
                    </tr>
                  )
                })}
              {rezervari.length === 0 && (
                <tr><td colSpan={10} style={{textAlign:'center', padding:30, color:'#94A3B8'}}>Nicio rezervare</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* ══ HEATMAP ══ */}
      {view==='heatmap'&&(
        <div>
          <div style={{fontSize:12,color:'#94A3B8',marginBottom:14}}>Ocupare zilnică — {calAn}. Click pe o zi pentru detalii.</div>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'separate',borderSpacing:3}}>
              <thead><tr>
                <th style={{fontSize:11,color:'#94A3B8',fontWeight:500,padding:'0 8px 6px',textAlign:'left',width:50}}>Luna</th>
                {Array.from({length:31},(_,i)=><th key={i} style={{fontSize:10,color:'#94A3B8',fontWeight:500,width:20,textAlign:'center',paddingBottom:6}}>{i+1}</th>)}
              </tr></thead>
              <tbody>
                {Array.from({length:12},(_,luna)=>{
                  const nrZ=new Date(calAn,luna+1,0).getDate()
                  return (
                    <tr key={luna}>
                      <td style={{fontSize:11,color:'#475569',fontWeight:500,paddingRight:8}}>{LUNI_SC[luna]}</td>
                      {Array.from({length:31},(_,zi)=>{
                        if(zi>=nrZ) return <td key={zi}/>
                        const ds=`${calAn}-${String(luna+1).padStart(2,'0')}-${String(zi+1).padStart(2,'0')}`
                        const pct=heatmapData[ds]||0
                        const isAziCell=ds===aziStr
                        return (
                          <td key={zi} onClick={()=>setHeatmapZi(ds)}
                            style={{width:20,height:20,borderRadius:5,cursor:'pointer',
                              background:pct===0?'#F1F5F9':heatColor(pct),
                              border:isAziCell?'2px solid #0F2344':'2px solid transparent',
                              opacity:pct===0?.4:1,transition:'transform .1s'}}
                            onMouseOver={e=>e.currentTarget.style.transform='scale(1.3)'}
                            onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}/>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center',fontSize:11,color:'#64748B'}}>
            <span>0%</span>
            {[0,40,60,75,90].map(p=><div key={p} style={{width:16,height:16,borderRadius:4,background:p===0?'#F1F5F9':heatColor(p)}}/>)}
            <span>100%</span>
          </div>
          {heatmapZi&&(
            <div className="overlay" onClick={()=>setHeatmapZi(null)}>
              <div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
                <div className="mhdr">
                  <div className="mtitle">📅 {new Date(heatmapZi+'T12:00:00').toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}</div>
                  <button onClick={()=>setHeatmapZi(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#94A3B8'}}>✕</button>
                </div>
                <div style={{marginBottom:12}}>
                  <span style={{fontWeight:700,fontSize:18,color:'#0F2344'}}>{heatmapData[heatmapZi]||0}%</span>
                  <span style={{fontSize:12,color:'#94A3B8',marginLeft:6}}>ocupare</span>
                </div>
                {apts.filter(a=>{
                  if(!a.firma) return false
                  return heatmapZi>=(a.data_checkin||'2020-01-01')&&heatmapZi<=(a.data_elib||'2099-12-31')
                }).map(a=>(
                  <div key={a.nr} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid #F1F5F9',fontSize:12,cursor:'pointer'}}
                    onClick={()=>{setHeatmapZi(null);setModalApt(a)}}>
                    <div style={{width:28,height:28,borderRadius:8,background:'#EEF4FF',color:'#1A3A6B',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,flexShrink:0}}>{a.nr}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,color:'#0F2344'}}>{a.firma}</div>
                      <div style={{color:'#94A3B8'}}>{a.pret} RON · {a.tip_serviciu}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip&&(
        <div style={{position:'fixed',left:tooltip.x+14,top:tooltip.y-10,background:'#0F2344',color:'#fff',
          borderRadius:10,padding:'8px 12px',fontSize:12,zIndex:9999,pointerEvents:'none',
          boxShadow:'0 4px 16px rgba(0,0,0,.2)',maxWidth:200}}>
          <div style={{fontWeight:700,marginBottom:3}}>AP {tooltip.seg.apt.nr}</div>
          <div>{tooltip.seg.firma||'—'}</div>
          {tooltip.seg.pret>0&&<div>{tooltip.seg.pret} RON/{tooltip.seg.tip==='chirie'?'lună':'noapte'}</div>}
          {tooltip.seg.checkin&&<div>Check-in: {tooltip.seg.checkin}</div>}
          {tooltip.seg.elib&&<div>Elib.: {tooltip.seg.elib}</div>}
          <div style={{color:'rgba(255,255,255,.6)',fontSize:10,marginTop:4}}>Click pentru detalii</div>
        </div>
      )}

      {/* Modal tip rezervare */}
      {modalTip&&(
        <ModalTipRezervare
          apt={modalTip.apt} checkin={modalTip.checkin} checkout={modalTip.checkout}
          onSelect={handleTipSelect} onClose={()=>setModalTip(null)}/>
      )}

      {/* Modal detalii rezervare */}
      {modalApt&&(
        <ModalRezervare
          apt={modalApt} seg={null} apts={apts} curatenii={curatenii}
          onClose={()=>setModalApt(null)}
          onSave={handleSaveApt}
          onReloadRezervari={reloadRezervari}
          onContract={onContract}/>
      )}
    </div>
  )
}
