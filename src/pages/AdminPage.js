import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import {
  getApartamente, updateApartament, updateApartamenteMultiple, addApartament,
  getCuratenie, programeazaCuratenie, programeazaCuratenieMultipla, marcheazaStatus, stergeCuratenie,
  getIstoric, adaugaIstoric, stergeIstoric
} from '../lib/supabase'
import Calendar from '../components/Calendar'
import Modal from '../components/Modal'

const TABS = ['📅 Calendar', '🚪 Apartamente', '🏢 Firme', '📋 Istoric', '💰 Incasari']
const TAB_KEYS = ['calendar', 'apartamente', 'firme', 'istoric', 'incasari']
const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
const ST_MAP = { activ: ['bb','Ocupat'], elib: ['br2','Elib.'], special: ['bp2','Special'], liber: ['bg2','Liber'], maint: ['ba','Mentenanță'] }

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [apts, setApts] = useState([])
  const [curatenii, setCuratenii] = useState([])
  const [istoric, setIstoric] = useState([])
  const [loading, setLoading] = useState(true)
  const [srchApt, setSrchApt] = useState('')
  const [fltStatus, setFltStatus] = useState('')
  const [selApts, setSelApts] = useState(new Set())
  const [srchFirma, setSrchFirma] = useState('')
  const [srchIst, setSrchIst] = useState('')
  const now = new Date()
  const [calAn, setCalAn] = useState(now.getFullYear())
  const [calLuna, setCalLuna] = useState(now.getMonth())

  // Modals
  const [modal, setModal] = useState(null) // null | 'editApt' | 'addApt' | 'curUnic' | 'curMulti' | 'medit' | 'mcur' | 'addIst' | 'cell'
  const [editData, setEditData] = useState({})

  // Load all data
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [a, c, i] = await Promise.all([getApartamente(), getCuratenie(), getIstoric()])
      setApts(a)
      setCuratenii(c)
      setIstoric(i)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  function handleLogout() { logout(); navigate('/', { replace: true }) }

  // ── Stats ──────────────────────────────────────────────────
  const occ = apts.filter(a => a.status === 'activ' && a.firma).length
  const total = apts.filter(a => a.status !== 'maint').length
  const libre = apts.filter(a => a.status === 'liber').length
  const elib = apts.filter(a => a.status === 'elib').length
  const rev = apts.filter(a => a.status === 'activ' && a.pret > 0).reduce((s,a) => s + Number(a.pret) * 30, 0)

  // ── Apartamente ────────────────────────────────────────────
  const filteredApts = apts.filter(a =>
    (!srchApt || (a.nr + (a.firma||'') + (a.nota||'')).toLowerCase().includes(srchApt.toLowerCase())) &&
    (!fltStatus || a.status === fltStatus)
  )

  function toggleSel(nr) {
    setSelApts(prev => {
      const s = new Set(prev)
      s.has(nr) ? s.delete(nr) : s.add(nr)
      return s
    })
  }

  function clearSel() { setSelApts(new Set()) }

  async function saveEditApt() {
    const { nr, ...fields } = editData
    // Include new fields
    if (!fields.tip_serviciu) fields.tip_serviciu = 'cazare'
    if (fields.tip_serviciu !== 'chirie') { fields.pret_utilitati = 0; fields.utilitati_tip = 'fix' }
    setApts(prev => prev.map(a => a.nr === nr ? { ...a, ...fields } : a))
    setModal(null)
    await updateApartament(nr, fields)
  }

  async function saveAddApt() {
    const apt = { nr: editData.nr, tip: editData.tip||'simplu', firma: editData.firma||'', nota: editData.nota||'', status: editData.status||'liber', pret: editData.pret||0, plata: editData.plata||'OP' }
    setApts(prev => [...prev, { ...apt, ultima_curatenie: '', curatenie_status: '' }])
    setModal(null)
    await addApartament(apt)
  }

  async function saveMultiEdit() {
    const fields = {}
    if (editData.firma) fields.firma = editData.firma
    if (editData.nota)  fields.nota  = editData.nota
    if (editData.status) fields.status = editData.status
    if (editData.pret)  fields.pret  = editData.pret
    if (editData.plata) fields.plata = editData.plata
    if (editData.data_elib) fields.data_elib = editData.data_elib
    if (!Object.keys(fields).length) { alert('Completați cel puțin un câmp!'); return }
    const list = Array.from(selApts)
    setApts(prev => prev.map(a => list.includes(a.nr) ? { ...a, ...fields } : a))
    setModal(null); clearSel()
    await updateApartamenteMultiple(list, fields)
    alert(`Actualizate: ${list.length} apartamente`)
  }

  // ── Curățenie ──────────────────────────────────────────────
  async function saveCurUnic() {
    const apt = apts.find(a => a.nr === editData.nr_apt)
    await programeazaCuratenie({ ...editData, tip_apt: apt?.tip, firma: apt?.firma })
    setModal(null)
    const c = await getCuratenie()
    setCuratenii(c)
  }

  async function saveCurMulti() {
    const list = editData.selApts || []
    if (!list.length) { alert('Selectați cel puțin un apartament!'); return }
    await programeazaCuratenieMultipla(list, editData.data_programata, editData.tip_curatenie, editData.observatii, apts)
    setModal(null)
    const c = await getCuratenie()
    setCuratenii(c)
    alert(`${list.length} apartamente programate!`)
  }

  async function saveCurApt() {
    const list = Array.from(selApts)
    await programeazaCuratenieMultipla(list, editData.data_programata, editData.tip_curatenie, editData.observatii||'', apts)
    setModal(null); clearSel()
    const c = await getCuratenie()
    setCuratenii(c)
    alert(`${list.length} programate!`)
  }

  async function handleCellAction(action, curatenie) {
    if (action === 'sterge') {
      if (!window.confirm('Ștergi curățenia?')) return
      await stergeCuratenie(curatenie.id)
    } else if (action === 'add') {
      await programeazaDinCalendar(curatenie)
    }
    setModal(null)
    const c = await getCuratenie()
    setCuratenii(c)
  }

  async function programeazaDinCalendar(obj) {
    const apt = apts.find(a => a.nr === obj.nr_apt)
    await programeazaCuratenie({ data_programata: obj.data_programata, nr_apt: obj.nr_apt, tip_apt: apt?.tip, firma: apt?.firma, tip_curatenie: obj.tip_curatenie, observatii: '' })
  }

  // ── Istoric ────────────────────────────────────────────────
  async function saveIst() {
    const s = editData.data_start, e = editData.data_end, p = Number(editData.pret_noapte)||0
    const z = s&&e ? Math.max(0, Math.round((new Date(e)-new Date(s))/86400000)) : 0
    const obj = { ...editData, nr_zile: z, total_estimat: z * p }
    if (!obj.firma || !obj.nr_apt || !s) { alert('Completați firma, apartament și data start!'); return }
    setIstoric(prev => [{ ...obj, id: Date.now() }, ...prev])
    setModal(null)
    await adaugaIstoric(obj)
  }

  async function delIst(id) {
    if (!window.confirm('Ștergi?')) return
    setIstoric(prev => prev.filter(r => r.id !== id))
    await stergeIstoric(id)
  }

  // ── Render firme ───────────────────────────────────────────
  const byFirma = {}
  apts.filter(a => a.firma).forEach(a => {
    if (!byFirma[a.firma]) byFirma[a.firma] = { apts: [], pret: Number(a.pret)||0, plata: a.plata }
    byFirma[a.firma].apts.push(a)
  })

  // ── Render incasari ─────────────────────────────────────────
  const byFirmaInc = {}
  apts.filter(a => a.firma && a.status === 'activ' && Number(a.pret) > 0).forEach(a => {
    if (!byFirmaInc[a.firma]) byFirmaInc[a.firma] = { apts: [], p: Number(a.pret), pl: a.plata }
    byFirmaInc[a.firma].apts.push(a.nr)
  })
  const incRows = Object.entries(byFirmaInc).sort((a,b) => b[1].apts.length - a[1].apts.length)
  const incTotal = incRows.reduce((s,[,v]) => s + v.apts.length * v.p * 30, 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1F3864', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 48, fontWeight: 700, color: '#fff', marginBottom: 8 }}>EZEL</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginBottom: 24 }}>Se încarcă datele...</div>
      <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: '70%', background: '#fff', borderRadius: 2, animation: 'none' }}></div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Topbar */}
      <div style={{ background: '#1F3864', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>EZEL — Manager</div>
          <div style={{ fontSize: 11, opacity: .7 }}>{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button className="btn" style={{ background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: 12 }} onClick={handleLogout}>Ieși</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1.5px solid #e0e0e0', padding: '0 12px', overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <div key={i} onClick={() => setTab(i)}
            style={{ padding: '10px 13px', fontSize: 13, cursor: 'pointer', color: tab === i ? '#1F3864' : '#888', borderBottom: `2.5px solid ${tab === i ? '#1F3864' : 'transparent'}`, whiteSpace: 'nowrap', fontWeight: 500 }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: 12, maxWidth: 1200, margin: '0 auto' }}>

        {/* ── CALENDAR ── */}
        {tab === 0 && (
          <Calendar apts={apts} curatenii={curatenii} calAn={calAn} calLuna={calLuna}
            onChangeMonth={(d) => { let l = calLuna+d, a = calAn; if(l>11){l=0;a++}if(l<0){l=11;a--}; setCalLuna(l); setCalAn(a) }}
            onCellClick={(nr, zi, data) => {
              const cell = curatenii.find(c => c.nr_apt===nr && c.data_programata===data && c.status_curatenie!=='finalizata')
              setEditData({ nr_apt: nr, zi, data_programata: data, cell })
              setModal('cell')
            }}
            onAddMulti={() => { setEditData({ selApts: [], data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'generala' }); setModal('curMulti') }}
            onAddUnic={() => { setEditData({ nr_apt: apts[0]?.nr, data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'generala' }); setModal('curUnic') }}
          />
        )}

        {/* ── APARTAMENTE ── */}
        {tab === 1 && (
          <div>
            <div className="srch-row">
              <input placeholder="Caută..." value={srchApt} onChange={e => setSrchApt(e.target.value)} />
              <select value={fltStatus} onChange={e => setFltStatus(e.target.value)}>
                <option value="">Toate</option>
                <option value="activ">Ocupat</option>
                <option value="liber">Liber</option>
                <option value="elib">Eliberează</option>
                <option value="maint">Mentenanță</option>
              </select>
              <button className="btn btn-p" onClick={() => { setEditData({ tip: 'simplu', status: 'liber', plata: 'OP' }); setModal('addApt') }}>+ Apt nou</button>
              <button className="btn btn-o" onClick={() => { setEditData({}); setModal('medit') }} disabled={selApts.size === 0}>✏️ Editează</button>
              <button className="btn btn-g" onClick={() => { setEditData({ data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'generala' }); setModal('mcur') }} disabled={selApts.size === 0}>🧹 Curățenie</button>
            </div>

            {selApts.size > 0 && (
              <div className="mbar">
                <span className="mcnt">{selApts.size} apartamente selectate</span>
                <button className="btn btn-o" onClick={() => { setEditData({}); setModal('medit') }}>✏️ Editează</button>
                <button className="btn btn-g" onClick={() => { setEditData({ data_programata: new Date().toISOString().split('T')[0], tip_curatenie: 'generala' }); setModal('mcur') }}>🧹 Curățenie</button>
                <button className="btn" onClick={clearSel}>✕</button>
              </div>
            )}

            <table className="tbl">
              <thead><tr>
                <th><input type="checkbox" onChange={e => { if(e.target.checked) setSelApts(new Set(filteredApts.map(a=>a.nr))); else clearSel() }} /></th>
                <th>Nr</th><th>Tip</th><th>Firmă</th><th>Notă</th><th>Status</th><th>Preț</th><th>Ultima cur.</th><th></th>
              </tr></thead>
              <tbody>
                {filteredApts.map(a => {
                  const [bc, bl] = ST_MAP[a.status] || ['bk','—']
                  const isDbl = a.tip === 'dublu' || String(a.nr).startsWith('D')
                  return (
                    <tr key={a.nr} className={selApts.has(a.nr) ? 'sel' : ''}>
                      <td><input type="checkbox" checked={selApts.has(a.nr)} onChange={() => toggleSel(a.nr)} /></td>
                      <td><strong>{a.nr}</strong>{isDbl && <span className="tip-d">2x</span>}</td>
                      <td>{a.tip}</td>
                      <td>{a.firma || '—'}</td>
                      <td style={{ color: '#888', fontSize: 11 }}>{a.nota || '—'}</td>
                      <td><span className={`badge ${bc}`}>{bl}</span></td>
                      <td>{a.pret ? `${a.pret} RON` : '—'}</td>
                      <td style={{ fontSize: 11, color: '#888' }}>{a.ultima_curatenie || '—'}</td>
                      <td><button className="btn" style={{ height: 24, fontSize: 11 }} onClick={() => { setEditData({ ...a }); setModal('editApt') }}>✏️</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FIRME ── */}
        {tab === 2 && (
          <div>
            <div className="srch-row"><input placeholder="Caută firmă..." value={srchFirma} onChange={e => setSrchFirma(e.target.value)} /></div>
            {Object.entries(byFirma)
              .filter(([n]) => !srchFirma || n.toLowerCase().includes(srchFirma.toLowerCase()))
              .sort((a,b) => b[1].apts.length - a[1].apts.length)
              .map(([name, v]) => {
                const rev = v.apts.filter(a => a.status==='activ').reduce((s,a) => s+Number(a.pret)*30, 0)
                const elibApts = v.apts.filter(a => a.status==='elib')
                return (
                  <div key={name} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div className="firma-av">{name.substring(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{v.plata} · {v.pret} RON/apt/noapte</div>
                      </div>
                      <span className="badge bp2">{rev.toLocaleString()} RON/lună</span>
                    </div>
                    {elibApts.length > 0 && <div className="aw" style={{ fontSize: 11 }}>⚠️ Eliberează: {elibApts.map(a => `AP${a.nr}${a.data_elib ? ' pe ' + a.data_elib : ''}`).join(', ')}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {v.apts.map(a => (
                        <span key={a.nr} className={`badge ${a.status==='activ'?'bb':a.status==='elib'?'br2':'bk'}`}
                          style={{ cursor: 'pointer' }} onClick={() => { setEditData({ ...a }); setModal('editApt') }}>
                          {a.nr}{a.nota ? ` · ${a.nota}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* ── ISTORIC ── */}
        {tab === 3 && (
          <div>
            <div className="srch-row">
              <input placeholder="Caută firmă..." value={srchIst} onChange={e => setSrchIst(e.target.value)} />
              <button className="btn btn-p" onClick={() => { setEditData({ nr_apt: apts[0]?.nr }); setModal('addIst') }}>+ Adaugă</button>
            </div>
            {(() => {
              const fil = istoric.filter(r => !srchIst || r.firma.toLowerCase().includes(srchIst.toLowerCase()))
              const tv = fil.reduce((s,r) => s+Number(r.total_estimat||0), 0)
              const fu = new Set(fil.map(r=>r.firma)).size
              const byF = {}
              fil.forEach(r => { if(!byF[r.firma])byF[r.firma]=[]; byF[r.firma].push(r) })
              return (
                <>
                  <div className="stats">
                    <div className="stat"><div className="stat-label">Înregistrări</div><div className="stat-val">{fil.length}</div></div>
                    <div className="stat"><div className="stat-label">Firme distincte</div><div className="stat-val">{fu}</div></div>
                    <div className="stat"><div className="stat-label">Total înregistrat</div><div className="stat-val">{tv.toLocaleString()} RON</div></div>
                  </div>
                  {Object.entries(byF).map(([firma, rows]) => {
                    const tot = rows.reduce((s,r) => s+Number(r.total_estimat||0), 0)
                    return (
                      <div key={firma} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div className="firma-av">{firma.substring(0,2).toUpperCase()}</div>
                          <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{firma}</div><div style={{ fontSize: 11, color: '#888' }}>{rows.length} perioade</div></div>
                          <span className="badge bp2">{tot.toLocaleString()} RON</span>
                        </div>
                        <table className="tbl">
                          <thead><tr><th>Apt</th><th>Start</th><th>End</th><th>Zile</th><th>Preț</th><th>Total</th><th>Obs</th><th></th></tr></thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.id}>
                                <td>AP{r.nr_apt}</td>
                                <td>{r.data_start||'—'}</td><td>{r.data_end||'—'}</td>
                                <td>{r.nr_zile||'—'}</td>
                                <td>{r.pret_noapte?`${r.pret_noapte} RON`:'—'}</td>
                                <td><strong>{Number(r.total_estimat||0).toLocaleString()} RON</strong></td>
                                <td style={{ fontSize: 11, color: '#888' }}>{r.observatii||'—'}</td>
                                <td><button className="btn" style={{ height: 24, fontSize: 11 }} onClick={() => delIst(r.id)}>🗑</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                  {fil.length === 0 && <div className="loading">Nicio înregistrare. Adaugă cu butonul de sus.</div>}
                </>
              )
            })()}
          </div>
        )}

        {/* ── INCASARI ── */}
        {tab === 4 && <IncasariTab apts={APTS} />}}
      </div>

      {/* ── MODALS ── */}

      {/* Edit apt unic */}
      {modal === 'editApt' && (
        <Modal title={`Editează AP ${editData.nr}`} onClose={() => setModal(null)}>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Notă</label><input className="fi" value={editData.nota||''} onChange={e => setEditData({...editData, nota: e.target.value})} /></div>
          <div className="r2">
            <div className="fg"><label className="fl">Status</label>
              <select className="fi" value={editData.status||'activ'} onChange={e => setEditData({...editData, status: e.target.value})}>
                <option value="activ">Ocupat</option><option value="liber">Liber</option>
                <option value="elib">Eliberează</option><option value="maint">Mentenanță</option><option value="special">Special</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Data elib.</label><input className="fi" value={editData.data_elib||''} placeholder="ex: 20.05" onChange={e => setEditData({...editData, data_elib: e.target.value})} /></div>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Preț/noapte (cazare) sau /lună (chirie)</label><input className="fi" type="number" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} /></div>
            <div className="fg"><label className="fl">Plată</label>
              <select className="fi" value={editData.plata||'OP'} onChange={e => setEditData({...editData, plata: e.target.value})}>
                <option value="OP">OP</option><option value="Cash">Cash</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="fl">Tip serviciu</label>
            <select className="fi" value={editData.tip_serviciu||'cazare'} onChange={e => setEditData({...editData, tip_serviciu: e.target.value})}>
              <option value="cazare">Cazare (preț/noapte)</option>
              <option value="chirie">Chirie (preț/lună)</option>
            </select>
          </div>
          {(editData.tip_serviciu === 'chirie') && (
            <div className="r2">
              <div className="fg"><label className="fl">Utilități (RON)</label><input className="fi" type="number" placeholder="0" value={editData.pret_utilitati||''} onChange={e => setEditData({...editData, pret_utilitati: e.target.value})} /></div>
              <div className="fg"><label className="fl">Tip utilități</label>
                <select className="fi" value={editData.utilitati_tip||'fix'} onChange={e => setEditData({...editData, utilitati_tip: e.target.value})}>
                  <option value="fix">Fix (sumă fixă/lună)</option>
                  <option value="variabil">Variabil (introduc lunar)</option>
                </select>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveEditApt}>Salvează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* Add apt */}
      {modal === 'addApt' && (
        <Modal title="Apartament nou" onClose={() => setModal(null)}>
          <div className="r2">
            <div className="fg"><label className="fl">Nr</label><input className="fi" placeholder="ex: 66" value={editData.nr||''} onChange={e => setEditData({...editData, nr: e.target.value})} /></div>
            <div className="fg"><label className="fl">Tip</label>
              <select className="fi" value={editData.tip||'simplu'} onChange={e => setEditData({...editData, tip: e.target.value})}>
                <option value="simplu">Simplu</option><option value="dublu">Dublu</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Notă</label><input className="fi" value={editData.nota||''} onChange={e => setEditData({...editData, nota: e.target.value})} /></div>
          <div className="r2">
            <div className="fg"><label className="fl">Status</label>
              <select className="fi" value={editData.status||'liber'} onChange={e => setEditData({...editData, status: e.target.value})}>
                <option value="activ">Ocupat</option><option value="liber">Liber</option><option value="maint">Mentenanță</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Preț/noapte</label><input className="fi" type="number" placeholder="85" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} /></div>
          </div>
          <div className="fg"><label className="fl">Plată</label>
            <select className="fi" value={editData.plata||'OP'} onChange={e => setEditData({...editData, plata: e.target.value})}>
              <option value="OP">OP</option><option value="Cash">Cash</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveAddApt}>Adaugă</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* Multi edit */}
      {modal === 'medit' && (
        <Modal title={`Editează ${selApts.size} apartamente`} onClose={() => setModal(null)}>
          <div className="ai">AP {Array.from(selApts).join(', AP ')}</div>
          <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Lasă gol câmpurile pe care nu vrei să le modifici.</p>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" placeholder="lasă gol = nu modifica" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Notă</label><input className="fi" placeholder="lasă gol = nu modifica" value={editData.nota||''} onChange={e => setEditData({...editData, nota: e.target.value})} /></div>
          <div className="r2">
            <div className="fg"><label className="fl">Status</label>
              <select className="fi" value={editData.status||''} onChange={e => setEditData({...editData, status: e.target.value})}>
                <option value="">— nu modifica —</option><option value="activ">Ocupat</option>
                <option value="liber">Liber</option><option value="elib">Eliberează</option><option value="maint">Mentenanță</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Preț/noapte</label><input className="fi" type="number" placeholder="lasă gol" value={editData.pret||''} onChange={e => setEditData({...editData, pret: e.target.value})} /></div>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Plată</label>
              <select className="fi" value={editData.plata||''} onChange={e => setEditData({...editData, plata: e.target.value})}>
                <option value="">— nu modifica —</option><option value="OP">OP</option><option value="Cash">Cash</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Data elib.</label><input className="fi" placeholder="ex: 20.05" value={editData.data_elib||''} onChange={e => setEditData({...editData, data_elib: e.target.value})} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveMultiEdit}>Salvează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* Curățenie unic */}
      {modal === 'curUnic' && (
        <Modal title="Programează curățenie" onClose={() => setModal(null)}>
          <div className="fg"><label className="fl">Apartament</label>
            <select className="fi" value={editData.nr_apt||''} onChange={e => setEditData({...editData, nr_apt: e.target.value})}>
              {apts.filter(a=>a.status!=='maint').map(a => <option key={a.nr} value={a.nr}>AP {a.nr} — {a.firma||'Liber'}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Tip</label>
            <select className="fi" value={editData.tip_curatenie||'generala'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
              <option value="generala">Generală — la plecarea clientului</option>
              <option value="intretinere">Întreținere — același client</option>
              <option value="urgenta">Urgență</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Data</label><input className="fi" type="date" value={editData.data_programata||''} onChange={e => setEditData({...editData, data_programata: e.target.value})} /></div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={saveCurUnic}>✓ Programează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* Curățenie multiplă */}
      {modal === 'curMulti' && (
        <Modal title="Curățenie multiplă" onClose={() => setModal(null)}>
          <div className="fg">
            <label className="fl">Selectează apartamente</label>
            <div className="hint">Click = selectează/deselectează</div>
            <div className="asg">
              {apts.filter(a=>a.status!=='maint').map(a => (
                <div key={a.nr} className={`asi ${(editData.selApts||[]).includes(a.nr)?'sel':a.status==='activ'?'occ':''}`}
                  onClick={() => {
                    const prev = editData.selApts||[]
                    const next = prev.includes(a.nr) ? prev.filter(x=>x!==a.nr) : [...prev, a.nr]
                    setEditData({...editData, selApts: next})
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 10 }}>{a.nr}</div>
                  <div style={{ fontSize: 9, opacity: .7 }}>{(a.firma||'').substring(0,4)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="fg"><label className="fl">Tip</label>
            <select className="fi" value={editData.tip_curatenie||'generala'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
              <option value="generala">Generală</option><option value="intretinere">Întreținere</option><option value="urgenta">Urgență</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Data</label><input className="fi" type="date" value={editData.data_programata||''} onChange={e => setEditData({...editData, data_programata: e.target.value})} /></div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          {(editData.selApts||[]).length > 0 && <div className="ai" style={{ fontSize: 11 }}>{editData.selApts.length} selectate: AP {editData.selApts.join(', AP ')}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={saveCurMulti}>✓ Programează toate</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* Curățenie din apt tab */}
      {modal === 'mcur' && (
        <Modal title={`Curățenie — ${selApts.size} apartamente`} onClose={() => setModal(null)}>
          <div className="ai">AP {Array.from(selApts).join(', AP ')}</div>
          <div className="fg"><label className="fl">Tip</label>
            <select className="fi" value={editData.tip_curatenie||'generala'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
              <option value="generala">Generală</option><option value="intretinere">Întreținere</option><option value="urgenta">Urgență</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Data</label><input className="fi" type="date" value={editData.data_programata||''} onChange={e => setEditData({...editData, data_programata: e.target.value})} /></div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-g" style={{ flex: 1 }} onClick={saveCurApt}>✓ Programează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}

      {/* Click celulă calendar */}
      {modal === 'cell' && (
        <Modal title={`AP ${editData.nr_apt} — ${editData.data_programata}`} onClose={() => setModal(null)}>
          {editData.cell ? (
            <>
              <p style={{ marginBottom: 12 }}>
                <span className="badge bb">{editData.cell.tip_curatenie}</span>{' '}
                <span className={`badge ${editData.cell.status_curatenie==='finalizata'?'bg2':editData.cell.status_curatenie==='in progres'?'ba':'bb'}`}>{editData.cell.status_curatenie}</span>
              </p>
              {editData.cell.status_curatenie !== 'finalizata' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-r" onClick={() => handleCellAction('sterge', editData.cell)}>🗑 Șterge</button>
                  <button className="btn" onClick={() => setModal(null)}>Închide</button>
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Nicio curățenie programată.</p>
              <div className="fg"><label className="fl">Tip</label>
                <select className="fi" value={editData.tip_curatenie||'generala'} onChange={e => setEditData({...editData, tip_curatenie: e.target.value})}>
                  <option value="generala">Generală — la plecare</option>
                  <option value="intretinere">Întreținere — același client</option>
                  <option value="urgenta">Urgență</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-g" style={{ flex: 1 }} onClick={() => handleCellAction('add', editData)}>✓ Adaugă</button>
                <button className="btn" onClick={() => setModal(null)}>Anulează</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Add istoric */}
      {modal === 'addIst' && (
        <Modal title="Adaugă înregistrare istorică" onClose={() => setModal(null)}>
          <div className="fg"><label className="fl">Firmă</label><input className="fi" placeholder="ex: ELM" value={editData.firma||''} onChange={e => setEditData({...editData, firma: e.target.value})} /></div>
          <div className="fg"><label className="fl">Apartament</label>
            <select className="fi" value={editData.nr_apt||''} onChange={e => setEditData({...editData, nr_apt: e.target.value})}>
              {apts.map(a => <option key={a.nr} value={a.nr}>AP {a.nr} — {a.firma||'Liber'}</option>)}
            </select>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Data start</label><input className="fi" type="date" value={editData.data_start||''} onChange={e => setEditData({...editData, data_start: e.target.value})} /></div>
            <div className="fg"><label className="fl">Data end</label><input className="fi" type="date" value={editData.data_end||''} onChange={e => setEditData({...editData, data_end: e.target.value})} /></div>
          </div>
          <div className="r2">
            <div className="fg"><label className="fl">Preț/noapte</label><input className="fi" type="number" placeholder="85" value={editData.pret_noapte||''} onChange={e => setEditData({...editData, pret_noapte: e.target.value})} /></div>
            <div className="fg"><label className="fl">Total (auto)</label>
              <input className="fi" readOnly style={{ background: '#f8f8f8', fontWeight: 600 }}
                value={editData.data_start&&editData.data_end&&editData.pret_noapte ?
                  (Math.max(0,Math.round((new Date(editData.data_end)-new Date(editData.data_start))/86400000)) * Number(editData.pret_noapte)).toLocaleString()+' RON' : ''} />
            </div>
          </div>
          <div className="fg"><label className="fl">Observații</label><input className="fi" value={editData.observatii||''} onChange={e => setEditData({...editData, observatii: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveIst}>Salvează</button>
            <button className="btn" onClick={() => setModal(null)}>Anulează</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
