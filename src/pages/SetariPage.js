import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { adaugaUtilizator, reseteazaParola } from '../lib/auth'

const ROLURI = ['admin', 'curatenie', 'lenjerii']
const ROL_LABELS = { admin: '👔 Manager', curatenie: '🧹 Curățenie', lenjerii: '🧺 Lenjerii' }
const ROL_COLORS = { admin: '#EEF4FF', curatenie: '#E8F7EF', lenjerii: '#EDE9FE' }
const ROL_TEXT = { admin: '#1A3A6B', curatenie: '#1A7A4A', lenjerii: '#5B21B6' }

const TEME = [
  { nume: 'Navy', primary: '#0F2344', accent: '#1A7A4A', bg: '#F6F7F9' },
  { nume: 'Slate', primary: '#1E293B', accent: '#0EA5E9', bg: '#F8FAFC' },
  { nume: 'Forest', primary: '#14532D', accent: '#15803D', bg: '#F0FDF4' },
  { nume: 'Burgundy', primary: '#4C0519', accent: '#BE123C', bg: '#FFF1F2' },
  { nume: 'Midnight', primary: '#1E1B4B', accent: '#6D28D9', bg: '#F5F3FF' },
  { nume: 'Amber', primary: '#78350F', accent: '#D97706', bg: '#FFFBEB' },
]

const TABS_SETARI = [
  { key: 'utilizatori', label: '👥 Utilizatori' },
  { key: 'vizual', label: '🎨 Vizual' },
  { key: 'curatenie', label: '🧹 Curățenie' },
  { key: 'financiar', label: '💰 Financiar' },
  { key: 'contracte', label: '📄 Contracte' },
  { key: 'angajati', label: '👷 Angajați' },
  { key: 'locatii', label: '📍 Locații' },
  { key: 'notificari', label: '🔔 Notificări' },
  { key: 'apartamente', label: '🚪 Apartamente' },
  { key: 'integrations', label: '🔌 Integrări' },
  { key: 'securitate', label: '🔒 Securitate' },
  { key: 'sistem', label: '⚙️ Sistem' },
]

function ColorPicker({ label, value, onChange }) {
  const ref = useRef()
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:value, border:'2px solid #E9EDF4', cursor:'pointer', flexShrink:0 }}
        onClick={() => ref.current?.click()} />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:12, fontWeight:500, color:'#0F2344', fontFamily:'monospace' }}>{value}</div>
      </div>
      <input ref={ref} type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ opacity:0, width:0, height:0, position:'absolute' }} />
      <button onClick={() => ref.current?.click()}
        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E9EDF4', background:'#F8FAFC', fontSize:11, cursor:'pointer', color:'#475569' }}>
        Alege
      </button>
    </div>
  )
}

function Toggle({ value, onChange, label, desc }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid #F1F5F9' }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:500, color:'#0F2344' }}>{label}</div>
        {desc && <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{desc}</div>}
      </div>
      <div onClick={() => onChange(!value)}
        style={{ width:44, height:24, borderRadius:99, cursor:'pointer', transition:'all .2s',
          background: value ? '#0F2344' : '#E9EDF4', position:'relative', flexShrink:0 }}>
        <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff',
          position:'absolute', top:3, transition:'left .2s',
          left: value ? 23 : 3, boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange, min, max, step=1, suffix='' }) {
  return (
    <div className="fg">
      <label className="fl">{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="number" className="fi" value={value} min={min} max={max} step={step}
          onChange={e => onChange(Number(e.target.value))}
          style={{ maxWidth:120 }} />
        {suffix && <span style={{ fontSize:12, color:'#94A3B8' }}>{suffix}</span>}
      </div>
    </div>
  )
}

function SaveBtn({ onClick, saved, label='💾 Salvează' }) {
  return (
    <button className="btn btn-p" onClick={onClick} style={{ marginTop:6 }}>
      {saved ? '✓ Salvat!' : label}
    </button>
  )
}

const DEFAULT_SETARI = {
  curatenie: {
    interval_zile: 7, interval_max: 10, limita_zi: 12,
    ora_start: '07:30', ora_end: '16:00',
    pauza_start: '12:00', pauza_end: '12:30',
    clockin_inainte: 10, clockin_dupa: 10,
    firme_speciale: [{ firma: 'ELM', program: 'luni-vineri', zile: ['luni','vineri'] },
                     { firma: 'ELECTROMONTAJ', program: 'luni-vineri', zile: ['luni','vineri'] }],
    apt_duble: ['26','48','59'],
  },
  financiar: {
    pret_curatenie_normal: 250, pret_curatenie_dublu: 400,
    tva: 19, moneda: 'RON',
    bonus_curatenii_luna: 200, bonus_per_curatenie: 10,
    pret_dinamic_sus: 90, pret_dinamic_jos: 70,
    pret_dinamic_factor_sus: 10, pret_dinamic_factor_jos: 8,
  },
  contracte: {
    firma_nume: 'EZEL EXPERT SRL', firma_cui: 'RO12345678',
    firma_reg: 'J05/123/2020', firma_adresa: 'str. Ovidiu Densușianu nr. 1A, Oradea',
    firma_banca: 'Banca Transilvania', firma_iban: 'RO49AAAA1B31007593840000',
    reprezentant: 'Milas Daniel', nr_contract_curent: 1,
    limba_implicita: 'bilingual', perioada_min: 1, perioada_max: 12,
    email_template: 'Vă transmitem atașat contractul de închiriere nr. {nr_contract}.',
  },
  angajati: {
    lista: [
      { id:'sv', nume:'Olar Svitlana', program_start:'07:30', program_end:'16:00', tarif:10, activ:true },
      { id:'fa', nume:'Farcas Adela Georgiana', program_start:'07:30', program_end:'16:00', tarif:10, activ:true },
    ],
    supervisor: 'Dani Milas',
  },
  locatii: [{ id:'loc1', nume:'Ovidiu Densușianu', adresa:'str. Ovidiu Densușianu nr. 1A, Oradea', email:'' }],
  notificari: {
    elib_fara_curatenie: true, liber_zile: 3, mentenanta_zile: 7,
    curatenie_nefinalizata: true, email_manageri: '',
    ora_verificare_1: '08:00', ora_verificare_2: '17:00',
  },
  apartamente: {
    nr_locuri_implicit: 2, status_implicit: 'liber',
    apt_duble: ['26','48','59'], pret_implicit: 85,
  },
  integrations: {
    smartbill_api: '', smartbill_serie: '', anaf_activ: false,
    smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '',
    whatsapp_activ: false, webhook_url: '',
  },
  securitate: {
    incercari_max: 5, sesiune_ore: 12, log_autentificari: [],
  },
  culori: { primary:'#0F2344', accent:'#1A7A4A', bg:'#F6F7F9' },
}

export default function SetariPage() {
  const [activeTab, setActiveTab] = useState('utilizatori')
  const [setari, setSetari] = useState(DEFAULT_SETARI)
  const [utilizatori, setUtilizatori] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userModal, setUserModal] = useState(null)
  const [userForm, setUserForm] = useState({ nume:'', parola:'', rol:'curatenie', activ:true })
  const [showParola, setShowParola] = useState({})
  const [saved, setSaved] = useState({})
  const [log, setLog] = useState([])
  const [logLogin, setLogLogin] = useState([])
  const [locForm, setLocForm] = useState({ nume:'', adresa:'', email:'' })
  const [firmaSpecialaForm, setFirmaSpecialaForm] = useState({ firma:'', zile:[] })
  const [angajatForm, setAngajatForm] = useState(null)
  const [userError, setUserError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadUtilizatori(); loadSetariDB() }, [])

  async function loadUtilizatori() {
    setLoadingUsers(true)
    const { data } = await supabase.from('utilizatori_public').select('*').order('rol').order('nume')
    setUtilizatori(data || [])
    setLoadingUsers(false)
  }

  async function loadSetariDB() {
    const { data } = await supabase.from('setari').select('*')
    if (!data) return
    const merged = { ...DEFAULT_SETARI }
    data.forEach(r => {
      if (r.id === 'locatii') {
        merged.locatii = Array.isArray(r.valoare) ? r.valoare : merged.locatii
      } else if (merged[r.id] !== undefined) {
        merged[r.id] = typeof r.valoare === 'object' && !Array.isArray(r.valoare)
          ? { ...merged[r.id], ...r.valoare }
          : r.valoare
      }
    })
    setSetari(merged)
  }

  function updateSetari(section, key, value) {
    setSetari(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
  }

  async function saveSection(section) {
    const { error } = await supabase.from('setari').upsert({
      id: section, valoare: setari[section], updated_at: new Date().toISOString()
    })
    if (error) {
      alert('Eroare la salvare: ' + error.message)
      return
    }
    if (section === 'culori') {
      document.documentElement.style.setProperty('--navy', setari.culori.primary)
      document.documentElement.style.setProperty('--green', setari.culori.accent)
      document.documentElement.style.setProperty('--bg', setari.culori.bg)
    }
    // Sincronizeaza angajatii cu tabelul utilizatori (doar status activ, fără parolă)
    if (section === 'angajati') {
      for (const a of setari.angajati.lista || []) {
        const { data: existing } = await supabase.from('utilizatori_public')
          .select('id, activ').eq('nume', a.nume).maybeSingle()
        if (existing && existing.activ !== a.activ) {
          await supabase.from('utilizatori').update({ activ: a.activ }).eq('id', existing.id)
        }
      }
    }
    setSaved(p => ({ ...p, [section]: true }))
    setTimeout(() => setSaved(p => ({ ...p, [section]: false })), 2500)
  }

  // ── Utilizatori ──────────────────────────────────────────
  async function saveUser() {
    if (!userForm.nume.trim()) {
      setUserError('Completează numele!')
      return
    }
    setUserError('')

    if (userModal === 'add') {
      if (!userForm.parola.trim()) {
        setUserError('Introdu o parolă!')
        return
      }
      const result = await adaugaUtilizator(userForm.nume.trim(), userForm.parola.trim(), userForm.rol)
      if (result.error) {
        setUserError(result.error)
        return
      }
    } else {
      // Update nume / rol / activ (fără parolă)
      await supabase.from('utilizatori')
        .update({ nume: userForm.nume.trim(), rol: userForm.rol, activ: userForm.activ })
        .eq('id', userModal)

      // Dacă s-a schimbat parola, folosește RPC
      if (userForm.parola && userForm.parola !== '••••••') {
        if (!userForm.parola.trim()) {
          setUserError('Introdu o parolă!')
          return
        }
        const result = await reseteazaParola(userModal, userForm.parola.trim())
        if (result.error) {
          setUserError(result.error)
          return
        }
      }
    }
    await loadUtilizatori(); setUserModal(null)
  }

  async function toggleActiv(u) {
    await supabase.from('utilizatori').update({ activ: !u.activ }).eq('id', u.id)
    setUtilizatori(prev => prev.map(x => x.id === u.id ? { ...x, activ: !x.activ } : x))
  }

  async function deleteUser(u) {
    setConfirmDelete(u)
  }

  async function confirmDeleteUser() {
    if (!confirmDelete) return
    await supabase.from('utilizatori').delete().eq('id', confirmDelete.id)
    setUtilizatori(prev => prev.filter(x => x.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

  async function loadLogLogin() {
    const { data } = await supabase.from('log_actiuni').select('*').eq('actiune', 'Login').order('created_at', { ascending:false }).limit(30)
    setLogLogin(data || [])
  }

  async function exportDate() {
    const [a,c,i,u] = await Promise.all([
      supabase.from('apartamente').select('*'),
      supabase.from('curatenie').select('*'),
      supabase.from('istoric_firme').select('*'),
      supabase.from('utilizatori').select('id,nume,rol,activ'),
    ])
    const blob = new Blob([JSON.stringify({ exportat_la: new Date().toISOString(), apartamente:a.data, curatenie:c.data, istoric:i.data, utilizatori:u.data }, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a'); el.href=url; el.download=`ezel-backup-${new Date().toISOString().split('T')[0]}.json`; el.click()
    URL.revokeObjectURL(url)
  }

  async function loadLog() {
    const { data } = await supabase.from('log_actiuni').select('*').order('created_at',{ascending:false}).limit(50)
    setLog(data||[])
  }

  const s = setari

  return (
    <div style={{ maxWidth:940, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'#0F2344', marginBottom:4 }}>⚙️ Setări</div>
        <div style={{ fontSize:12, color:'#94A3B8' }}>Super-admin · David Salajan</div>
      </div>

      {/* Sub-nav */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'#F1F5F9', borderRadius:14, padding:4, flexWrap:'wrap' }}>
        {TABS_SETARI.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); if(t.key==='securitate') loadLogLogin(); if(t.key==='sistem') loadLog() }}
            style={{ padding:'7px 12px', borderRadius:10, border:'none', cursor:'pointer', fontSize:11.5, fontWeight:500,
              background: activeTab===t.key ? '#fff' : 'transparent',
              color: activeTab===t.key ? '#0F2344' : '#64748B',
              boxShadow: activeTab===t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ UTILIZATORI ══ */}
      {activeTab === 'utilizatori' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-p" onClick={() => { setUserForm({nume:'',parola:'',rol:'curatenie',activ:true}); setUserModal('add') }}>+ Utilizator nou</button>
          </div>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {loadingUsers ? <div className="loading">Se încarcă...</div> : utilizatori.map((u,i) => (
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px',
                borderBottom: i<utilizatori.length-1?'1px solid #F1F5F9':'none', opacity:u.activ?1:.5 }}>
                <div style={{ width:38, height:38, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700,
                  background:ROL_COLORS[u.rol]||'#F1F5F9', color:ROL_TEXT[u.rol]||'#64748B' }}>
                  {u.nume?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>{u.nume}</span>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, fontWeight:500, background:ROL_COLORS[u.rol]||'#F1F5F9', color:ROL_TEXT[u.rol]||'#64748B' }}>
                      {ROL_LABELS[u.rol]||u.rol}
                    </span>
                    {!u.activ && <span style={{ fontSize:10, color:'#94A3B8', background:'#F1F5F9', padding:'2px 7px', borderRadius:99 }}>Inactiv</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:2, display:'flex', gap:6, alignItems:'center' }}>
                    <span>Parolă:</span>
                    <span style={{ fontFamily:'monospace', letterSpacing:2, color:'#94A3B8' }}>••••••••</span>
                    <button onClick={() => {
                      const noua = window.prompt('Parolă nouă:')
                      if (!noua) return
                      reseteazaParola(u.id, noua).then(r => {
                        if (r.ok) alert('✓ Parolă schimbată!')
                        else alert('Eroare: ' + r.error)
                      })
                    }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#1A3A6B', padding:'2px 6px', fontWeight:500 }} title="Resetează parola">
                      🔑 Resetează
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => toggleActiv(u)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E9EDF4', fontSize:11, cursor:'pointer', fontWeight:500, background:u.activ?'#FEF3C7':'#E8F7EF', color:u.activ?'#B45309':'#1A7A4A' }}>
                    {u.activ?'Dezactivează':'Activează'}
                  </button>
                  <button onClick={() => { setUserForm({...u, parola:'••••••'}); setUserModal(u.id) }} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E9EDF4', background:'#F8FAFC', fontSize:11, cursor:'pointer', color:'#475569' }}>✏️</button>
                  <button onClick={() => deleteUser(u)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #FECACA', background:'#FEE2E2', fontSize:11, cursor:'pointer', color:'#B91C1C' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          {userModal && (
            <div className="overlay" onClick={() => setUserModal(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="mhdr">
                  <div className="mtitle">{userModal==='add'?'Utilizator nou':'Editează utilizator'}</div>
                  <button onClick={() => setUserModal(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#94A3B8' }}>✕</button>
                </div>
                <div className="fg"><label className="fl">Nume</label><input className="fi" value={userForm.nume} onChange={e => setUserForm({...userForm,nume:e.target.value})} placeholder="ex: Olar Svitlana" /></div>
                <div className="fg"><label className="fl">Parolă</label><input className="fi" type="password" value={userForm.parola} onChange={e => setUserForm({...userForm,parola:e.target.value})} placeholder={userModal==='add'?'Min 8 caractere':'Lasă neschimbat'} /></div>
                <div className="fg"><label className="fl">Rol</label>
                  <select className="fi" value={userForm.rol} onChange={e => setUserForm({...userForm,rol:e.target.value})}>
                    {ROLURI.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#F8FAFC', borderRadius:12, marginBottom:14, cursor:'pointer' }}
                  onClick={() => setUserForm({...userForm,activ:!userForm.activ})}>
                  <div style={{ width:20, height:20, borderRadius:6, background:userForm.activ?'#0F2344':'#E9EDF4', border:`2px solid ${userForm.activ?'#0F2344':'#D1D9E6'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {userForm.activ && <span style={{ color:'#fff', fontSize:12 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:13, color:'#0F2344', fontWeight:500 }}>Cont activ</span>
                </div>
                {userError && (
                  <div style={{ padding:'8px 12px', background:'#FEE2E2', borderRadius:10, fontSize:12, color:'#B91C1C', marginBottom:8 }}>
                    ⚠️ {userError}
                  </div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-p" style={{ flex:1 }} onClick={saveUser}>Salvează</button>
                  <button className="btn" onClick={() => { setUserModal(null); setUserError('') }}>Anulează</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ VIZUAL ══ */}
      {activeTab === 'vizual' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:14, fontSize:13 }}>🎨 Teme rapide</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {TEME.map(t => (
                <div key={t.nume} onClick={() => setSetari(p=>({...p,culori:{primary:t.primary,accent:t.accent,bg:t.bg}}))}
                  style={{ padding:'8px 14px', borderRadius:12, cursor:'pointer', transition:'all .15s',
                    border:`2px solid ${s.culori.primary===t.primary?t.primary:'#E9EDF4'}`, background:t.bg,
                    display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', gap:3 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:t.primary }} />
                    <div style={{ width:10, height:10, borderRadius:'50%', background:t.accent }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color:t.primary }}>{t.nume}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>🖌️ Culori personalizate</div>
            <ColorPicker label="Culoare principală" value={s.culori.primary} onChange={v => updateSetari('culori','primary',v)} />
            <ColorPicker label="Culoare accent" value={s.culori.accent} onChange={v => updateSetari('culori','accent',v)} />
            <ColorPicker label="Fundal" value={s.culori.bg} onChange={v => updateSetari('culori','bg',v)} />
            <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid #E9EDF4', marginTop:12 }}>
              <div style={{ background:s.culori.primary, padding:'8px 14px', display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>EZEL</span>
                <span style={{ color:'rgba(255,255,255,.5)', fontSize:11 }}>preview</span>
              </div>
              <div style={{ background:s.culori.bg, padding:12, display:'flex', gap:8 }}>
                <div style={{ background:s.culori.primary, color:'#fff', padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:600 }}>Principal</div>
                <div style={{ background:s.culori.accent, color:'#fff', padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:600 }}>Accent</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <SaveBtn onClick={() => saveSection('culori')} saved={saved.culori} label="💾 Salvează & Aplică" />
            <button className="btn" onClick={() => setSetari(p=>({...p,culori:{primary:'#0F2344',accent:'#1A7A4A',bg:'#F6F7F9'}}))}>Reset</button>
          </div>
        </div>
      )}

      {/* ══ CURATENIE ══ */}
      {activeTab === 'curatenie' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>⏱ Program & Intervale</div>
            <div className="r2">
              <NumInput label="Interval minim între curățenii (zile)" value={s.curatenie.interval_zile} onChange={v=>updateSetari('curatenie','interval_zile',v)} min={3} max={14} suffix="zile" />
              <NumInput label="Interval maxim (zile)" value={s.curatenie.interval_max} onChange={v=>updateSetari('curatenie','interval_max',v)} min={5} max={21} suffix="zile" />
            </div>
            <NumInput label="Limita curățenii per zi" value={s.curatenie.limita_zi} onChange={v=>updateSetari('curatenie','limita_zi',v)} min={5} max={30} suffix="curățenii/zi" />
            <div className="r2">
              <div className="fg"><label className="fl">Ora start program</label><input type="time" className="fi" value={s.curatenie.ora_start} onChange={e=>updateSetari('curatenie','ora_start',e.target.value)} /></div>
              <div className="fg"><label className="fl">Ora end program</label><input type="time" className="fi" value={s.curatenie.ora_end} onChange={e=>updateSetari('curatenie','ora_end',e.target.value)} /></div>
            </div>
            <div className="r2">
              <div className="fg"><label className="fl">Pauză masă start</label><input type="time" className="fi" value={s.curatenie.pauza_start} onChange={e=>updateSetari('curatenie','pauza_start',e.target.value)} /></div>
              <div className="fg"><label className="fl">Pauză masă end</label><input type="time" className="fi" value={s.curatenie.pauza_end} onChange={e=>updateSetari('curatenie','pauza_end',e.target.value)} /></div>
            </div>
            <div className="r2">
              <NumInput label="Clock-in cu X minute înainte de program" value={s.curatenie.clockin_inainte} onChange={v=>updateSetari('curatenie','clockin_inainte',v)} min={0} max={30} suffix="min" />
              <NumInput label="Clock-in cu X minute după program" value={s.curatenie.clockin_dupa} onChange={v=>updateSetari('curatenie','clockin_dupa',v)} min={0} max={30} suffix="min" />
            </div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:14, fontSize:13 }}>🏢 Firme cu program special</div>
            <div style={{ fontSize:12, color:'#94A3B8', marginBottom:12 }}>Aceste firme primesc curățenie doar în zilele specificate.</div>
            {(s.curatenie.firme_speciale||[]).map((f,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>{f.firma}</span>
                  <span style={{ marginLeft:8, fontSize:11, color:'#94A3B8' }}>{f.zile?.join(', ')}</span>
                </div>
                <button onClick={() => {
                  const noi = s.curatenie.firme_speciale.filter((_,j)=>j!==i)
                  updateSetari('curatenie','firme_speciale',noi)
                }} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid #FECACA', background:'#FEE2E2', fontSize:11, cursor:'pointer', color:'#B91C1C' }}>🗑</button>
              </div>
            ))}
            <div style={{ marginTop:12, display:'flex', gap:8 }}>
              <input className="fi" placeholder="Nume firmă" value={firmaSpecialaForm.firma}
                onChange={e=>setFirmaSpecialaForm(p=>({...p,firma:e.target.value}))}
                style={{ flex:1 }} />
              <select className="fi" multiple value={firmaSpecialaForm.zile}
                onChange={e=>setFirmaSpecialaForm(p=>({...p,zile:[...e.target.selectedOptions].map(o=>o.value)}))}
                style={{ flex:1, height:60 }}>
                {['luni','marți','miercuri','joi','vineri'].map(z=><option key={z} value={z}>{z}</option>)}
              </select>
              <button className="btn btn-p" onClick={() => {
                if (!firmaSpecialaForm.firma) return
                const noi = [...(s.curatenie.firme_speciale||[]), { firma:firmaSpecialaForm.firma, zile:firmaSpecialaForm.zile }]
                updateSetari('curatenie','firme_speciale',noi)
                setFirmaSpecialaForm({ firma:'', zile:[] })
              }}>+ Adaugă</button>
            </div>
          </div>
          <SaveBtn onClick={() => saveSection('curatenie')} saved={saved.curatenie} />
        </div>
      )}

      {/* ══ FINANCIAR ══ */}
      {activeTab === 'financiar' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>💰 Prețuri curățenie</div>
            <div className="r2">
              <NumInput label="Preț curățenie standard" value={s.financiar.pret_curatenie_normal} onChange={v=>updateSetari('financiar','pret_curatenie_normal',v)} min={50} max={1000} suffix="RON + TVA" />
              <NumInput label="Preț curățenie apartament dublu" value={s.financiar.pret_curatenie_dublu} onChange={v=>updateSetari('financiar','pret_curatenie_dublu',v)} min={50} max={1000} suffix="RON + TVA" />
            </div>
            <div className="r2">
              <NumInput label="TVA %" value={s.financiar.tva} onChange={v=>updateSetari('financiar','tva',v)} min={0} max={25} suffix="%" />
              <div className="fg">
                <label className="fl">Moneda afișată</label>
                <div style={{ display:'flex', gap:6 }}>
                  {['RON','EUR'].map(m => (
                    <div key={m} onClick={() => updateSetari('financiar','moneda',m)}
                      style={{ flex:1, padding:'9px 0', borderRadius:10, textAlign:'center', cursor:'pointer', fontWeight:600, fontSize:13, border:'2px solid',
                        borderColor:s.financiar.moneda===m?'#0F2344':'#E9EDF4',
                        background:s.financiar.moneda===m?'#0F2344':'#fff',
                        color:s.financiar.moneda===m?'#fff':'#475569' }}>{m}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>👷 Bonus angajate</div>
            <div className="r2">
              <NumInput label="Curățenii bonus/lună" value={s.financiar.bonus_curatenii_luna} onChange={v=>updateSetari('financiar','bonus_curatenii_luna',v)} min={50} max={500} suffix="curățenii" />
              <NumInput label="Tarif per curățenie bonus" value={s.financiar.bonus_per_curatenie} onChange={v=>updateSetari('financiar','bonus_per_curatenie',v)} min={1} max={50} suffix="RON" />
            </div>
            <div style={{ padding:'10px 14px', background:'#EEF4FF', borderRadius:12, fontSize:12, color:'#1A3A6B' }}>
              💡 Bonus maxim per angajată: <strong>{s.financiar.bonus_curatenii_luna * s.financiar.bonus_per_curatenie} RON/lună</strong> dacă sunt ambele prezente, sau <strong>{s.financiar.bonus_curatenii_luna * s.financiar.bonus_per_curatenie * 2} RON</strong> dacă una lipsește.
            </div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>💡 Prag preț dinamic</div>
            <div className="r2">
              <NumInput label="Ocupare % → crește prețul" value={s.financiar.pret_dinamic_sus} onChange={v=>updateSetari('financiar','pret_dinamic_sus',v)} min={70} max={99} suffix="%" />
              <NumInput label="Factor creștere" value={s.financiar.pret_dinamic_factor_sus} onChange={v=>updateSetari('financiar','pret_dinamic_factor_sus',v)} min={1} max={30} suffix="%" />
            </div>
            <div className="r2">
              <NumInput label="Ocupare % → scade prețul" value={s.financiar.pret_dinamic_jos} onChange={v=>updateSetari('financiar','pret_dinamic_jos',v)} min={30} max={80} suffix="%" />
              <NumInput label="Factor scădere" value={s.financiar.pret_dinamic_factor_jos} onChange={v=>updateSetari('financiar','pret_dinamic_factor_jos',v)} min={1} max={30} suffix="%" />
            </div>
          </div>
          <SaveBtn onClick={() => saveSection('financiar')} saved={saved.financiar} />
        </div>
      )}

      {/* ══ CONTRACTE ══ */}
      {activeTab === 'contracte' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>🏢 Date EZEL EXPERT SRL</div>
            <div className="r2">
              <div className="fg"><label className="fl">Denumire firmă</label><input className="fi" value={s.contracte.firma_nume} onChange={e=>updateSetari('contracte','firma_nume',e.target.value)} /></div>
              <div className="fg"><label className="fl">CUI</label><input className="fi" value={s.contracte.firma_cui} onChange={e=>updateSetari('contracte','firma_cui',e.target.value)} /></div>
            </div>
            <div className="r2">
              <div className="fg"><label className="fl">Nr. Reg. Comerțului</label><input className="fi" value={s.contracte.firma_reg} onChange={e=>updateSetari('contracte','firma_reg',e.target.value)} /></div>
              <div className="fg"><label className="fl">Reprezentant legal</label><input className="fi" value={s.contracte.reprezentant} onChange={e=>updateSetari('contracte','reprezentant',e.target.value)} /></div>
            </div>
            <div className="fg"><label className="fl">Adresă sediu</label><input className="fi" value={s.contracte.firma_adresa} onChange={e=>updateSetari('contracte','firma_adresa',e.target.value)} /></div>
            <div className="r2">
              <div className="fg"><label className="fl">Bancă</label><input className="fi" value={s.contracte.firma_banca} onChange={e=>updateSetari('contracte','firma_banca',e.target.value)} /></div>
              <div className="fg"><label className="fl">IBAN</label><input className="fi" value={s.contracte.firma_iban} onChange={e=>updateSetari('contracte','firma_iban',e.target.value)} style={{ fontFamily:'monospace', fontSize:12 }} /></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>📄 Setări contract</div>
            <div className="r2">
              <NumInput label="Nr. contract următor" value={s.contracte.nr_contract_curent} onChange={v=>updateSetari('contracte','nr_contract_curent',v)} min={1} max={9999} />
              <div className="fg">
                <label className="fl">Limba implicită</label>
                <select className="fi" value={s.contracte.limba_implicita} onChange={e=>updateSetari('contracte','limba_implicita',e.target.value)}>
                  <option value="ro">Română</option>
                  <option value="en">Engleză</option>
                  <option value="bilingual">Bilingv RO/EN</option>
                </select>
              </div>
            </div>
            <div className="r2">
              <NumInput label="Perioadă minimă contract" value={s.contracte.perioada_min} onChange={v=>updateSetari('contracte','perioada_min',v)} min={1} max={12} suffix="luni" />
              <NumInput label="Perioadă maximă contract" value={s.contracte.perioada_max} onChange={v=>updateSetari('contracte','perioada_max',v)} min={1} max={36} suffix="luni" />
            </div>
            <div className="fg">
              <label className="fl">Template email trimitere contract</label>
              <textarea className="fi" value={s.contracte.email_template} rows={3}
                onChange={e=>updateSetari('contracte','email_template',e.target.value)}
                style={{ resize:'vertical' }} />
              <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>Variabile: {'{nr_contract}'}, {'{firma}'}, {'{data}'}</div>
            </div>
          </div>
          <SaveBtn onClick={() => saveSection('contracte')} saved={saved.contracte} />
        </div>
      )}

      {/* ══ ANGAJATI ══ */}
      {activeTab === 'angajati' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:4, fontSize:13 }}>👷 Angajate curățenie</div>
            <div style={{ fontSize:12, color:'#94A3B8', marginBottom:14 }}>Program individual per angajată. Parola de clock-in se setează aici.</div>
            {(s.angajati.lista||[]).map((a,i) => (
              <div key={a.id} style={{ padding:'14px 0', borderBottom:'1px solid #F1F5F9' }}>
                {angajatForm?.id === a.id ? (
                  <div>
                    <div className="r2">
                      <div className="fg"><label className="fl">Nume</label><input className="fi" value={angajatForm.nume} onChange={e=>setAngajatForm(p=>({...p,nume:e.target.value}))} /></div>
                      <div className="fg"><label className="fl" style={{color:'#94A3B8'}}>Parola se setează în Utilizatori</label><div style={{ fontSize:11, color:'#94A3B8', padding:'10px 0' }}>Mergi la tab "👥 Utilizatori" → 🔑 Resetează</div></div>
                    </div>
                    <div className="r2">
                      <div className="fg"><label className="fl">Oră start</label><input type="time" className="fi" value={angajatForm.program_start} onChange={e=>setAngajatForm(p=>({...p,program_start:e.target.value}))} /></div>
                      <div className="fg"><label className="fl">Oră end</label><input type="time" className="fi" value={angajatForm.program_end} onChange={e=>setAngajatForm(p=>({...p,program_end:e.target.value}))} /></div>
                    </div>
                    <NumInput label="Tarif per curățenie (RON)" value={angajatForm.tarif} onChange={v=>setAngajatForm(p=>({...p,tarif:v}))} min={1} max={100} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn btn-p" onClick={() => {
                        const lista = s.angajati.lista.map(x => x.id===angajatForm.id ? angajatForm : x)
                        updateSetari('angajati','lista',lista)
                        setAngajatForm(null)
                      }}>Salvează</button>
                      <button className="btn" onClick={() => setAngajatForm(null)}>Anulează</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:'#E8F7EF', color:'#1A7A4A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
                      {a.nume?.charAt(0)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>{a.nume}</div>
                      <div style={{ fontSize:11, color:'#94A3B8' }}>{a.program_start} — {a.program_end} · {a.tarif} RON/curățenie</div>
                    </div>
                    <button onClick={() => setAngajatForm({...a})} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E9EDF4', background:'#F8FAFC', fontSize:11, cursor:'pointer', color:'#475569' }}>✏️</button>
                  </div>
                )}
              </div>
            ))}
            <div className="fg" style={{ marginTop:14 }}>
              <label className="fl">Supervisor pontaj</label>
              <input className="fi" value={s.angajati.supervisor} onChange={e=>updateSetari('angajati','supervisor',e.target.value)} placeholder="ex: Dani Milas" />
            </div>
          </div>
          <SaveBtn onClick={() => saveSection('angajati')} saved={saved.angajati} />
        </div>
      )}

      {/* ══ LOCATII ══ */}
      {activeTab === 'locatii' && (
        <div>
          {s.locatii.map(l => (
            <div key={l.id} className="card" style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:12, background:'#EEF4FF', color:'#1A3A6B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📍</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>{l.nume}</div>
                  {l.adresa && <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{l.adresa}</div>}
                  {l.email && <div style={{ fontSize:11, color:'#94A3B8' }}>✉️ {l.email}</div>}
                </div>
                <button onClick={async () => {
                  const noi = s.locatii.filter(x=>x.id!==l.id)
                  setSetari(p=>({...p,locatii:noi}))
                  await supabase.from('setari').upsert({id:'locatii',valoare:noi,updated_at:new Date().toISOString()})
                }} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #FECACA', background:'#FEE2E2', fontSize:11, cursor:'pointer', color:'#B91C1C' }}>🗑</button>
              </div>
            </div>
          ))}
          <div className="card">
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:14, fontSize:13 }}>+ Locație nouă</div>
            <div className="fg"><label className="fl">Nume</label><input className="fi" value={locForm.nume} onChange={e=>setLocForm({...locForm,nume:e.target.value})} placeholder="ex: Piața Unirii" /></div>
            <div className="fg"><label className="fl">Adresă</label><input className="fi" value={locForm.adresa} onChange={e=>setLocForm({...locForm,adresa:e.target.value})} placeholder="ex: str. Republicii nr. 5, Oradea" /></div>
            <div className="fg"><label className="fl">Email rapoarte</label><input className="fi" value={locForm.email} onChange={e=>setLocForm({...locForm,email:e.target.value})} placeholder="ex: manager@ezel.ro" /></div>
            <button className="btn btn-p" onClick={async () => {
              if (!locForm.nume.trim()) return
              const noua = { id:`loc${Date.now()}`, ...locForm }
              const noi = [...s.locatii, noua]
              setSetari(p=>({...p,locatii:noi}))
              await supabase.from('setari').upsert({id:'locatii',valoare:noi,updated_at:new Date().toISOString()})
              setLocForm({nume:'',adresa:'',email:''})
            }}>+ Adaugă</button>
          </div>
        </div>
      )}

      {/* ══ NOTIFICARI ══ */}
      {activeTab === 'notificari' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:14, fontSize:13 }}>🔔 Tipuri alerte</div>
            <Toggle value={s.notificari.elib_fara_curatenie} onChange={v=>updateSetari('notificari','elib_fara_curatenie',v)}
              label="Eliberare mâine fără curățenie" desc="Alertă critică afișată în dashboard" />
            <Toggle value={s.notificari.curatenie_nefinalizata} onChange={v=>updateSetari('notificari','curatenie_nefinalizata',v)}
              label="Curățenie nefinalizată seara" desc="Alertă dacă curățeniile de azi nu sunt marcate" />
            <div style={{ padding:'12px 0', borderBottom:'1px solid #F1F5F9' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#0F2344', marginBottom:8 }}>
                Apartament liber — alertă după:
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {[1,2,3,5,7].map(z => (
                  <div key={z} onClick={() => updateSetari('notificari','liber_zile',z)}
                    style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:600, fontSize:13, border:'2px solid',
                      borderColor:s.notificari.liber_zile===z?'#0F2344':'#E9EDF4',
                      background:s.notificari.liber_zile===z?'#0F2344':'#fff',
                      color:s.notificari.liber_zile===z?'#fff':'#475569' }}>{z}</div>
                ))}
                <span style={{ alignSelf:'center', fontSize:11, color:'#94A3B8' }}>zile</span>
              </div>
            </div>
            <div style={{ padding:'12px 0' }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#0F2344', marginBottom:8 }}>Mentenanță — alertă după:</div>
              <div style={{ display:'flex', gap:6 }}>
                {[3,5,7,14].map(z => (
                  <div key={z} onClick={() => updateSetari('notificari','mentenanta_zile',z)}
                    style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:600, fontSize:13, border:'2px solid',
                      borderColor:s.notificari.mentenanta_zile===z?'#0F2344':'#E9EDF4',
                      background:s.notificari.mentenanta_zile===z?'#0F2344':'#fff',
                      color:s.notificari.mentenanta_zile===z?'#fff':'#475569' }}>{z}</div>
                ))}
                <span style={{ alignSelf:'center', fontSize:11, color:'#94A3B8' }}>zile</span>
              </div>
            </div>
          </div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:14, fontSize:13 }}>✉️ Email manageri</div>
            <div className="fg"><label className="fl">Adrese email (separate cu virgulă)</label>
              <input className="fi" value={s.notificari.email_manageri} onChange={e=>updateSetari('notificari','email_manageri',e.target.value)} placeholder="ex: dani@ezel.ro, david@ezel.ro" />
            </div>
            <div className="r2">
              <div className="fg"><label className="fl">Verificare dimineață</label><input type="time" className="fi" value={s.notificari.ora_verificare_1} onChange={e=>updateSetari('notificari','ora_verificare_1',e.target.value)} /></div>
              <div className="fg"><label className="fl">Verificare seară</label><input type="time" className="fi" value={s.notificari.ora_verificare_2} onChange={e=>updateSetari('notificari','ora_verificare_2',e.target.value)} /></div>
            </div>
          </div>
          <SaveBtn onClick={() => saveSection('notificari')} saved={saved.notificari} />
        </div>
      )}

      {/* ══ APARTAMENTE ══ */}
      {activeTab === 'apartamente' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>🚪 Configurare globală</div>
            <div className="r2">
              <NumInput label="Nr. locuri implicit apartament nou" value={s.apartamente.nr_locuri_implicit} onChange={v=>updateSetari('apartamente','nr_locuri_implicit',v)} min={1} max={8} suffix="locuri" />
              <NumInput label="Preț implicit/noapte" value={s.apartamente.pret_implicit} onChange={v=>updateSetari('apartamente','pret_implicit',v)} min={0} max={1000} suffix="RON" />
            </div>
            <div className="fg">
              <label className="fl">Status implicit apartament nou</label>
              <select className="fi" value={s.apartamente.status_implicit} onChange={e=>updateSetari('apartamente','status_implicit',e.target.value)}>
                <option value="liber">Liber</option>
                <option value="maint">Mentenanță</option>
              </select>
            </div>
          </div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:12, fontSize:13 }}>🛏 Apartamente duble</div>
            <div style={{ fontSize:12, color:'#94A3B8', marginBottom:12 }}>Aceste apartamente au preț curățenie diferit și sunt marcate cu badge "2x".</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
              {(s.apartamente.apt_duble||[]).map(nr => (
                <div key={nr} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:99, background:'#EDE9FE', color:'#5B21B6', fontWeight:600, fontSize:12 }}>
                  AP {nr}
                  <button onClick={() => updateSetari('apartamente','apt_duble',s.apartamente.apt_duble.filter(x=>x!==nr))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#5B21B6', padding:0, fontSize:14, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input className="fi" placeholder="Nr. apartament" id="apt-dublu-input" style={{ maxWidth:160 }} />
              <button className="btn btn-p" onClick={() => {
                const input = document.getElementById('apt-dublu-input')
                const val = input.value.trim()
                if (!val || (s.apartamente.apt_duble||[]).includes(val)) return
                updateSetari('apartamente','apt_duble',[...(s.apartamente.apt_duble||[]),val])
                input.value = ''
              }}>+ Adaugă</button>
            </div>
          </div>
          <SaveBtn onClick={() => saveSection('apartamente')} saved={saved.apartamente} />
        </div>
      )}

      {/* ══ INTEGRATIONS ══ */}
      {activeTab === 'integrations' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#EEF4FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧾</div>
              <div>
                <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>SmartBill</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>Facturare automată</div>
              </div>
              <div style={{ marginLeft:'auto' }}>
                <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background: s.integrations.smartbill_api?'#E8F7EF':'#F1F5F9', color:s.integrations.smartbill_api?'#1A7A4A':'#94A3B8', fontWeight:600 }}>
                  {s.integrations.smartbill_api ? '✓ Conectat' : 'Neconectat'}
                </span>
              </div>
            </div>
            <div className="fg"><label className="fl">API Key</label><input className="fi" type="password" value={s.integrations.smartbill_api} onChange={e=>updateSetari('integrations','smartbill_api',e.target.value)} placeholder="sk-..." /></div>
            <div className="fg"><label className="fl">Serie factură</label><input className="fi" value={s.integrations.smartbill_serie} onChange={e=>updateSetari('integrations','smartbill_serie',e.target.value)} placeholder="ex: EZEL" /></div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#E8F7EF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📧</div>
              <div>
                <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>Email SMTP</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>Trimitere contracte și rapoarte</div>
              </div>
            </div>
            <div className="r2">
              <div className="fg"><label className="fl">Host SMTP</label><input className="fi" value={s.integrations.smtp_host} onChange={e=>updateSetari('integrations','smtp_host',e.target.value)} placeholder="smtp.gmail.com" /></div>
              <NumInput label="Port" value={s.integrations.smtp_port} onChange={v=>updateSetari('integrations','smtp_port',v)} min={25} max={999} />
            </div>
            <div className="r2">
              <div className="fg"><label className="fl">Utilizator</label><input className="fi" value={s.integrations.smtp_user} onChange={e=>updateSetari('integrations','smtp_user',e.target.value)} placeholder="email@gmail.com" /></div>
              <div className="fg"><label className="fl">Parolă aplicație</label><input className="fi" type="password" value={s.integrations.smtp_pass} onChange={e=>updateSetari('integrations','smtp_pass',e.target.value)} /></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#E8F7EF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>💬</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>WhatsApp Business</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>Agent automat clienți</div>
              </div>
              <Toggle value={s.integrations.whatsapp_activ} onChange={v=>updateSetari('integrations','whatsapp_activ',v)} label="" />
            </div>
            {s.integrations.whatsapp_activ && (
              <div className="ai" style={{ fontSize:12 }}>⚠️ Necesită server Node.js activ pe PC-ul local. Configurează după ce serverul e pornit.</div>
            )}
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#EEF4FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🔗</div>
              <div>
                <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>Webhook URL</div>
                <div style={{ fontSize:11, color:'#94A3B8' }}>Notificări externe</div>
              </div>
            </div>
            <div className="fg"><label className="fl">URL webhook</label><input className="fi" value={s.integrations.webhook_url} onChange={e=>updateSetari('integrations','webhook_url',e.target.value)} placeholder="https://..." /></div>
          </div>
          <SaveBtn onClick={() => saveSection('integrations')} saved={saved.integrations} />
        </div>
      )}

      {/* ══ SECURITATE ══ */}
      {activeTab === 'securitate' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:16, fontSize:13 }}>🔒 Politici de acces</div>
            <NumInput label="Blocare cont după X încercări greșite" value={s.securitate.incercari_max} onChange={v=>updateSetari('securitate','incercari_max',v)} min={3} max={10} suffix="încercări" />
            <NumInput label="Sesiune expiră după" value={s.securitate.sesiune_ore} onChange={v=>updateSetari('securitate','sesiune_ore',v)} min={1} max={72} suffix="ore" />
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>📋 Jurnal autentificări</div>
              <button className="btn" style={{ fontSize:11 }} onClick={loadLogLogin}>Reîncarcă</button>
            </div>
            {logLogin.length === 0 ? (
              <div style={{ color:'#94A3B8', fontSize:12 }}>
                Niciun log de autentificare. Autentificările se înregistrează automat.
              </div>
            ) : (
              <div style={{ maxHeight:280, overflowY:'auto' }}>
                {logLogin.map(l => (
                  <div key={l.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid #F1F5F9', fontSize:12 }}>
                    <div style={{ color:'#94A3B8', whiteSpace:'nowrap', flexShrink:0 }}>
                      {new Date(l.created_at).toLocaleString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    </div>
                    <div style={{ color:'#0F2344', fontWeight:500 }}>{l.user_tip}</div>
                    <div style={{ color:'#94A3B8' }}>{l.detalii}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <SaveBtn onClick={() => saveSection('securitate')} saved={saved.securitate} />
        </div>
      )}

      {/* ══ SISTEM ══ */}
      {activeTab === 'sistem' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:14, fontSize:13 }}>💾 Backup & Export</div>
            <div style={{ fontSize:12, color:'#94A3B8', marginBottom:14 }}>Exportă toate datele ca fișier JSON. Recomandat lunar.</div>
            <button className="btn btn-p" onClick={exportDate}>⬇️ Export complet JSON</button>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, color:'#0F2344', marginBottom:10, fontSize:13 }}>ℹ️ Info sistem</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                {l:'Versiune',v:'EZEL v1.8.0'},{l:'Stack',v:'React + Supabase'},
                {l:'Deploy',v:'Vercel'},{l:'Ultima actualizare',v:new Date().toLocaleDateString('ro-RO')},
              ].map(r=>(
                <div key={r.l} style={{ padding:'10px 14px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E9EDF4' }}>
                  <div style={{ fontSize:10, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3 }}>{r.l}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#0F2344', fontFamily:'monospace' }}>{r.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:600, color:'#0F2344', fontSize:13 }}>📋 Log activitate</div>
              <button className="btn" style={{ fontSize:11 }} onClick={loadLog}>Reîncarcă</button>
            </div>
            {log.length === 0 ? <div style={{ color:'#94A3B8', fontSize:12 }}>Nicio activitate.</div> : (
              <div style={{ maxHeight:300, overflowY:'auto' }}>
                {log.map(l=>(
                  <div key={l.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid #F1F5F9', fontSize:12 }}>
                    <div style={{ color:'#94A3B8', whiteSpace:'nowrap', flexShrink:0 }}>
                      {new Date(l.created_at).toLocaleString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    </div>
                    <div style={{ color:'#475569' }}>
                      <span style={{ fontWeight:500, color:'#0F2344' }}>{l.user_tip}</span>{' · '}{l.actiune}
                      {l.detalii && <span style={{ color:'#94A3B8' }}> — {l.detalii}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmare stergere user */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:380 }}>
            <div style={{ textAlign:'center', padding:'8px 0 16px' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🗑</div>
              <div style={{ fontSize:15, fontWeight:600, color:'#0F2344', marginBottom:8 }}>
                Ștergi utilizatorul?
              </div>
              <div style={{ fontSize:13, color:'#94A3B8', marginBottom:20 }}>
                <strong>{confirmDelete.nume}</strong> ({ROL_LABELS[confirmDelete.rol]}) va fi șters permanent.
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" style={{ flex:1 }} onClick={() => setConfirmDelete(null)}>Anulează</button>
                <button className="btn btn-r" style={{ flex:1 }} onClick={confirmDeleteUser}>Șterge definitiv</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
