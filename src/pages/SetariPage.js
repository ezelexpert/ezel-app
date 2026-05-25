import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ROLURI = ['admin', 'curatenie', 'lenjerii']
const ROL_LABELS = { admin: '👔 Manager', curatenie: '🧹 Curățenie', lenjerii: '🧺 Lenjerii' }
const ROL_COLORS = { admin: '#EEF4FF', curatenie: '#E8F7EF', lenjerii: '#EDE9FE' }
const ROL_TEXT = { admin: '#1A3A6B', curatenie: '#1A7A4A', lenjerii: '#5B21B6' }

const TEME_PREDEFINITE = [
  { nume: 'Navy (implicit)', primary: '#0F2344', accent: '#1A7A4A', bg: '#F6F7F9' },
  { nume: 'Slate', primary: '#1E293B', accent: '#0EA5E9', bg: '#F8FAFC' },
  { nume: 'Forest', primary: '#14532D', accent: '#15803D', bg: '#F0FDF4' },
  { nume: 'Burgundy', primary: '#4C0519', accent: '#BE123C', bg: '#FFF1F2' },
  { nume: 'Midnight', primary: '#1E1B4B', accent: '#6D28D9', bg: '#F5F3FF' },
]

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', borderBottom: open ? '1px solid #E9EDF4' : 'none',
          background: open ? '#FAFBFD' : 'white' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 600, color: '#0F2344', fontSize: 14, flex: 1 }}>{title}</span>
        <span style={{ color: '#94A3B8', fontSize: 12, transition: 'transform .2s',
          transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>
      {open && <div style={{ padding: '20px 22px' }}>{children}</div>}
    </div>
  )
}

function ColorPicker({ label, value, onChange }) {
  const ref = useRef()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: value,
        border: '2px solid #E9EDF4', cursor: 'pointer', flexShrink: 0 }}
        onClick={() => ref.current?.click()} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
          letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#0F2344', fontFamily: 'monospace' }}>{value}</div>
      </div>
      <input ref={ref} type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
      <button onClick={() => ref.current?.click()}
        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E9EDF4',
          background: '#F8FAFC', fontSize: 11, cursor: 'pointer', color: '#475569' }}>
        Alege
      </button>
    </div>
  )
}

export default function SetariPage() {
  const [activeTab, setActiveTab] = useState('utilizatori')
  const [utilizatori, setUtilizatori] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userModal, setUserModal] = useState(null)
  const [userForm, setUserForm] = useState({ nume: '', parola: '', rol: 'curatenie', activ: true })
  const [userSaving, setUserSaving] = useState(false)
  const [showParola, setShowParola] = useState({})

  // Culori
  const [culori, setCulori] = useState({ primary: '#0F2344', accent: '#1A7A4A', bg: '#F6F7F9' })
  const [culoriSaved, setCuloriSaved] = useState(false)

  // Notificari
  const [notif, setNotif] = useState({
    elib_fara_curatenie: true, liber_zile: 3, mentenanta_zile: 7,
    email_manageri: ''
  })
  const [notifSaved, setNotifSaved] = useState(false)

  // Locatii
  const [locatii, setLocatii] = useState([])
  const [locForm, setLocForm] = useState({ nume: '', adresa: '', email: '' })
  const [locSaving, setLocSaving] = useState(false)

  // Log
  const [log, setLog] = useState([])
  const [logLoading, setLogLoading] = useState(false)

  useEffect(() => {
    loadUtilizatori()
    loadSetari()
  }, [])

  async function loadUtilizatori() {
    setLoadingUsers(true)
    const { data } = await supabase.from('utilizatori').select('*').order('rol').order('nume')
    setUtilizatori(data || [])
    setLoadingUsers(false)
  }

  async function loadSetari() {
    const { data } = await supabase.from('setari').select('*')
    if (!data) return
    data.forEach(r => {
      if (r.id === 'culori') setCulori(r.valoare)
      if (r.id === 'notificari') setNotif({
        ...r.valoare,
        email_manageri: Array.isArray(r.valoare.email_manageri)
          ? r.valoare.email_manageri.join(', ') : r.valoare.email_manageri || ''
      })
      if (r.id === 'locatii') setLocatii(r.valoare || [])
    })
  }

  async function loadLog() {
    setLogLoading(true)
    const { data } = await supabase.from('log_actiuni').select('*')
      .order('created_at', { ascending: false }).limit(50)
    setLog(data || [])
    setLogLoading(false)
  }

  // ── Utilizatori ──────────────────────────────────────────
  async function saveUser() {
    if (!userForm.nume.trim() || !userForm.parola.trim()) {
      alert('Completează numele și parola!'); return
    }
    setUserSaving(true)
    if (userModal === 'add') {
      await supabase.from('utilizatori').insert({
        nume: userForm.nume.trim(),
        parola: userForm.parola.trim(),
        rol: userForm.rol,
        activ: userForm.activ
      })
    } else {
      const updates = { nume: userForm.nume.trim(), rol: userForm.rol, activ: userForm.activ }
      if (userForm.parola.trim() !== '••••••') updates.parola = userForm.parola.trim()
      await supabase.from('utilizatori').update(updates).eq('id', userModal)
    }
    await loadUtilizatori()
    setUserModal(null)
    setUserSaving(false)
  }

  async function toggleActiv(user) {
    await supabase.from('utilizatori').update({ activ: !user.activ }).eq('id', user.id)
    setUtilizatori(prev => prev.map(u => u.id === user.id ? { ...u, activ: !u.activ } : u))
  }

  async function deleteUser(user) {
    if (!window.confirm(`Ștergi utilizatorul "${user.nume}"? Acțiunea nu poate fi anulată.`)) return
    await supabase.from('utilizatori').delete().eq('id', user.id)
    setUtilizatori(prev => prev.filter(u => u.id !== user.id))
  }

  // ── Culori ───────────────────────────────────────────────
  async function saveCulori() {
    await supabase.from('setari').upsert({ id: 'culori', valoare: culori, updated_at: new Date().toISOString() })
    // Aplica live in CSS
    document.documentElement.style.setProperty('--navy', culori.primary)
    document.documentElement.style.setProperty('--navy-mid', culori.primary + 'CC')
    document.documentElement.style.setProperty('--green', culori.accent)
    document.documentElement.style.setProperty('--bg', culori.bg)
    setCuloriSaved(true)
    setTimeout(() => setCuloriSaved(false), 2500)
  }

  function aplicaTema(tema) {
    setCulori({ primary: tema.primary, accent: tema.accent, bg: tema.bg })
  }

  // ── Notificari ───────────────────────────────────────────
  async function saveNotif() {
    const val = {
      ...notif,
      email_manageri: notif.email_manageri.split(',').map(e => e.trim()).filter(Boolean)
    }
    await supabase.from('setari').upsert({ id: 'notificari', valoare: val, updated_at: new Date().toISOString() })
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2500)
  }

  // ── Locatii ──────────────────────────────────────────────
  async function addLocatie() {
    if (!locForm.nume.trim()) { alert('Completează numele locației!'); return }
    setLocSaving(true)
    const noua = { id: `loc${Date.now()}`, ...locForm }
    const noi = [...locatii, noua]
    await supabase.from('setari').upsert({ id: 'locatii', valoare: noi, updated_at: new Date().toISOString() })
    setLocatii(noi)
    setLocForm({ nume: '', adresa: '', email: '' })
    setLocSaving(false)
  }

  async function deleteLocatie(id) {
    if (!window.confirm('Ștergi locația?')) return
    const noi = locatii.filter(l => l.id !== id)
    await supabase.from('setari').upsert({ id: 'locatii', valoare: noi, updated_at: new Date().toISOString() })
    setLocatii(noi)
  }

  // ── Export date ──────────────────────────────────────────
  async function exportDate() {
    const [apts, cur, ist, ut] = await Promise.all([
      supabase.from('apartamente').select('*'),
      supabase.from('curatenie').select('*'),
      supabase.from('istoric_firme').select('*'),
      supabase.from('utilizatori').select('id, nume, rol, activ')
    ])
    const backup = {
      exportat_la: new Date().toISOString(),
      versiune: '1.0',
      apartamente: apts.data || [],
      curatenie: cur.data || [],
      istoric_firme: ist.data || [],
      utilizatori: ut.data || []
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ezel-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const TABS_SETARI = [
    { key: 'utilizatori', label: '👥 Utilizatori' },
    { key: 'vizual', label: '🎨 Vizual' },
    { key: 'locatii', label: '📍 Locații' },
    { key: 'notificari', label: '🔔 Notificări' },
    { key: 'sistem', label: '⚙️ Sistem' },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0F2344', marginBottom: 4 }}>
          ⚙️ Setări
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>
          Acces restricționat — doar super-admin
        </div>
      </div>

      {/* Sub-navigare */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F1F5F9',
        borderRadius: 14, padding: 4, flexWrap: 'wrap' }}>
        {TABS_SETARI.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); if (t.key === 'sistem') loadLog() }}
            style={{ padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, transition: 'all .15s',
              background: activeTab === t.key ? '#fff' : 'transparent',
              color: activeTab === t.key ? '#0F2344' : '#64748B',
              boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB UTILIZATORI ── */}
      {activeTab === 'utilizatori' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-p"
              onClick={() => { setUserForm({ nume: '', parola: '', rol: 'curatenie', activ: true }); setUserModal('add') }}>
              + Utilizator nou
            </button>
          </div>

          {loadingUsers ? (
            <div className="loading">Se încarcă...</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {utilizatori.map((u, i) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', borderBottom: i < utilizatori.length-1 ? '1px solid #F1F5F9' : 'none',
                  opacity: u.activ ? 1 : .5 }}>
                  {/* Avatar */}
                  <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: ROL_COLORS[u.rol] || '#F1F5F9',
                    color: ROL_TEXT[u.rol] || '#64748B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700 }}>
                    {u.nume?.charAt(0)?.toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#0F2344', fontSize: 13 }}>{u.nume}</span>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 500,
                        background: ROL_COLORS[u.rol] || '#F1F5F9',
                        color: ROL_TEXT[u.rol] || '#64748B' }}>
                        {ROL_LABELS[u.rol] || u.rol}
                      </span>
                      {!u.activ && <span style={{ fontSize: 10, color: '#94A3B8', background: '#F1F5F9',
                        padding: '2px 7px', borderRadius: 99 }}>Inactiv</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>Parolă:</span>
                      <span style={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                        {showParola[u.id] ? u.parola : '••••••'}
                      </span>
                      <button onClick={() => setShowParola(p => ({ ...p, [u.id]: !p[u.id] }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94A3B8', padding: 0 }}>
                        {showParola[u.id] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  {/* Actiuni */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleActiv(u)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E9EDF4',
                        background: u.activ ? '#FEF3C7' : '#E8F7EF',
                        color: u.activ ? '#B45309' : '#1A7A4A',
                        fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                      {u.activ ? 'Dezactivează' : 'Activează'}
                    </button>
                    <button onClick={() => {
                      setUserForm({ ...u, parola: '••••••' })
                      setUserModal(u.id)
                    }}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #E9EDF4',
                        background: '#F8FAFC', fontSize: 11, cursor: 'pointer', color: '#475569' }}>
                      ✏️ Editează
                    </button>
                    <button onClick={() => deleteUser(u)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #FECACA',
                        background: '#FEE2E2', fontSize: 11, cursor: 'pointer', color: '#B91C1C' }}>
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal add/edit user */}
          {userModal && (
            <div className="overlay" onClick={() => setUserModal(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="mhdr">
                  <div className="mtitle">{userModal === 'add' ? 'Utilizator nou' : 'Editează utilizator'}</div>
                  <button onClick={() => setUserModal(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#94A3B8' }}>✕</button>
                </div>
                <div className="fg">
                  <label className="fl">Nume complet</label>
                  <input className="fi" value={userForm.nume} onChange={e => setUserForm({...userForm, nume: e.target.value})}
                    placeholder="ex: Olar Svitlana" />
                </div>
                <div className="fg">
                  <label className="fl">Parolă</label>
                  <input className="fi" value={userForm.parola}
                    onChange={e => setUserForm({...userForm, parola: e.target.value})}
                    placeholder={userModal === 'add' ? 'Parolă nouă' : 'Lasă neschimbată dacă nu modifici'} />
                </div>
                <div className="fg">
                  <label className="fl">Rol</label>
                  <select className="fi" value={userForm.rol} onChange={e => setUserForm({...userForm, rol: e.target.value})}>
                    {ROLURI.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: '#F8FAFC', borderRadius: 12, marginBottom: 14, cursor: 'pointer' }}
                  onClick={() => setUserForm({...userForm, activ: !userForm.activ})}>
                  <div style={{ width: 20, height: 20, borderRadius: 6,
                    background: userForm.activ ? '#0F2344' : '#E9EDF4',
                    border: `2px solid ${userForm.activ ? '#0F2344' : '#D1D9E6'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {userForm.activ && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: '#0F2344', fontWeight: 500 }}>Cont activ</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-p" style={{ flex: 1 }} onClick={saveUser} disabled={userSaving}>
                    {userSaving ? 'Se salvează...' : 'Salvează'}
                  </button>
                  <button className="btn" onClick={() => setUserModal(null)}>Anulează</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB VIZUAL ── */}
      {activeTab === 'vizual' && (
        <div>
          {/* Teme rapide */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 14, fontSize: 13 }}>
              🎨 Teme predefinite
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TEME_PREDEFINITE.map(t => (
                <div key={t.nume} onClick={() => aplicaTema(t)}
                  style={{ padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${culori.primary === t.primary ? t.primary : '#E9EDF4'}`,
                    background: t.bg, display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all .15s' }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.primary }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.accent }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: t.primary }}>{t.nume}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Picker culori */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 16, fontSize: 13 }}>
              🖌️ Culori personalizate
            </div>
            <ColorPicker label="Culoare principală (topbar, butoane, nav activ)"
              value={culori.primary} onChange={v => setCulori({...culori, primary: v})} />
            <ColorPicker label="Culoare accent (verde - statusuri OK, butoane secundare)"
              value={culori.accent} onChange={v => setCulori({...culori, accent: v})} />
            <ColorPicker label="Fundal aplicație"
              value={culori.bg} onChange={v => setCulori({...culori, bg: v})} />

            {/* Preview */}
            <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid #E9EDF4' }}>
              <div style={{ background: culori.primary, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>EZEL</span>
                <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>Preview topbar</span>
              </div>
              <div style={{ background: culori.bg, padding: 12, display: 'flex', gap: 8 }}>
                <div style={{ background: culori.primary, color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                  Buton principal
                </div>
                <div style={{ background: culori.accent, color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                  Buton accent
                </div>
                <div style={{ background: '#fff', border: `1px solid ${culori.primary}33`, color: culori.primary, padding: '6px 12px', borderRadius: 8, fontSize: 11 }}>
                  Badge status
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-p" style={{ flex: 1 }} onClick={saveCulori}>
              {culoriSaved ? '✓ Salvat!' : '💾 Salvează & Aplică'}
            </button>
            <button className="btn" onClick={() => {
              setCulori({ primary: '#0F2344', accent: '#1A7A4A', bg: '#F6F7F9' })
            }}>Reset implicit</button>
          </div>
        </div>
      )}

      {/* ── TAB LOCATII ── */}
      {activeTab === 'locatii' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            {locatii.map(l => (
              <div key={l.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EEF4FF',
                    color: '#1A3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0 }}>📍</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#0F2344', fontSize: 13 }}>{l.nume}</div>
                    {l.adresa && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{l.adresa}</div>}
                    {l.email && <div style={{ fontSize: 11, color: '#94A3B8' }}>✉️ {l.email}</div>}
                  </div>
                  <button onClick={() => deleteLocatie(l.id)}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #FECACA',
                      background: '#FEE2E2', fontSize: 11, cursor: 'pointer', color: '#B91C1C' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 14, fontSize: 13 }}>
              + Locație nouă
            </div>
            <div className="fg">
              <label className="fl">Nume locație</label>
              <input className="fi" value={locForm.nume}
                onChange={e => setLocForm({...locForm, nume: e.target.value})}
                placeholder="ex: Piața Unirii" />
            </div>
            <div className="fg">
              <label className="fl">Adresă completă</label>
              <input className="fi" value={locForm.adresa}
                onChange={e => setLocForm({...locForm, adresa: e.target.value})}
                placeholder="ex: str. Republicii nr. 5, Oradea" />
            </div>
            <div className="fg">
              <label className="fl">Email rapoarte</label>
              <input className="fi" value={locForm.email}
                onChange={e => setLocForm({...locForm, email: e.target.value})}
                placeholder="ex: manager@ezel.ro" />
            </div>
            <button className="btn btn-p" onClick={addLocatie} disabled={locSaving}>
              {locSaving ? 'Se adaugă...' : '+ Adaugă locație'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB NOTIFICARI ── */}
      {activeTab === 'notificari' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 16, fontSize: 13 }}>🔔 Tipuri de alerte</div>

            {[
              { key: 'elib_fara_curatenie', label: 'Eliberare mâine fără curățenie programată', icon: '🚨', tip: 'critica' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0F2344' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Alertă {item.tip}</div>
                </div>
                <div onClick={() => setNotif({...notif, [item.key]: !notif[item.key]})}
                  style={{ width: 44, height: 24, borderRadius: 99, cursor: 'pointer', transition: 'all .2s',
                    background: notif[item.key] ? '#0F2344' : '#E9EDF4', position: 'relative' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, transition: 'left .2s',
                    left: notif[item.key] ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 14 }}>
              <label className="fl">Alertă apartament liber după (zile)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1,2,3,5,7].map(z => (
                  <div key={z} onClick={() => setNotif({...notif, liber_zile: z})}
                    style={{ width: 36, height: 36, borderRadius: 10, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      fontWeight: 600, fontSize: 13, border: '2px solid',
                      borderColor: notif.liber_zile === z ? '#0F2344' : '#E9EDF4',
                      background: notif.liber_zile === z ? '#0F2344' : '#fff',
                      color: notif.liber_zile === z ? '#fff' : '#475569' }}>
                    {z}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="fl">Alertă mentenanță nerezolvată după (zile)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[3,5,7,14].map(z => (
                  <div key={z} onClick={() => setNotif({...notif, mentenanta_zile: z})}
                    style={{ width: 36, height: 36, borderRadius: 10, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      fontWeight: 600, fontSize: 13, border: '2px solid',
                      borderColor: notif.mentenanta_zile === z ? '#0F2344' : '#E9EDF4',
                      background: notif.mentenanta_zile === z ? '#0F2344' : '#fff',
                      color: notif.mentenanta_zile === z ? '#fff' : '#475569' }}>
                    {z}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 14, fontSize: 13 }}>✉️ Email manageri</div>
            <div className="fg">
              <label className="fl">Adrese email (separate cu virgulă)</label>
              <input className="fi" value={notif.email_manageri}
                onChange={e => setNotif({...notif, email_manageri: e.target.value})}
                placeholder="ex: dani@ezel.ro, david@ezel.ro" />
            </div>
          </div>

          <button className="btn btn-p" onClick={saveNotif}>
            {notifSaved ? '✓ Salvat!' : '💾 Salvează setări'}
          </button>
        </div>
      )}

      {/* ── TAB SISTEM ── */}
      {activeTab === 'sistem' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 14, fontSize: 13 }}>💾 Date & Backup</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>
              Exportă toate datele din aplicație ca fișier JSON. Util pentru backup sau migrare.
            </div>
            <button className="btn btn-p" onClick={exportDate}>
              ⬇️ Export complet JSON
            </button>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: '#0F2344', marginBottom: 4, fontSize: 13 }}>ℹ️ Sistem</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              {[
                { l: 'Versiune aplicație', v: 'EZEL v1.8.0' },
                { l: 'Stack', v: 'React + Supabase' },
                { l: 'Deploy', v: 'Vercel' },
                { l: 'Ultima actualizare', v: new Date().toLocaleDateString('ro-RO') },
              ].map(r => (
                <div key={r.l} style={{ padding: '10px 14px', background: '#F8FAFC',
                  borderRadius: 12, border: '1px solid #E9EDF4' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase',
                    letterSpacing: '.04em', marginBottom: 3 }}>{r.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0F2344', fontFamily: 'monospace' }}>{r.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: '#0F2344', fontSize: 13 }}>📋 Log activitate recent</div>
              <button className="btn" style={{ fontSize: 11 }} onClick={loadLog}>Reîncarcă</button>
            </div>
            {logLoading ? (
              <div style={{ color: '#94A3B8', fontSize: 12 }}>Se încarcă...</div>
            ) : log.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: 12 }}>Nicio activitate înregistrată.</div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {log.map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                    <div style={{ color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(l.created_at).toLocaleString('ro-RO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </div>
                    <div style={{ color: '#475569' }}>
                      <span style={{ fontWeight: 500, color: '#0F2344' }}>{l.user_tip}</span>
                      {' · '}{l.actiune}
                      {l.detalii && <span style={{ color: '#94A3B8' }}> — {l.detalii}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
