import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'

// ── Context global ────────────────────────────────────────────
const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ type = 'info', message, duration = 3500, action }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, message, duration, action }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Helpers
  const toast = {
    success: (msg, opts) => addToast({ type: 'success', message: msg, ...opts }),
    error:   (msg, opts) => addToast({ type: 'error',   message: msg, duration: 6000, ...opts }),
    warning: (msg, opts) => addToast({ type: 'warning', message: msg, ...opts }),
    info:    (msg, opts) => addToast({ type: 'info',    message: msg, ...opts }),
    confirm: (msg, onConfirm, opts) => addToast({ type: 'confirm', message: msg, action: onConfirm, duration: 0, ...opts }),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ── Icons ─────────────────────────────────────────────────────
const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
  confirm: '?',
}

const STYLES = {
  success: { bg: '#0F2344', accent: '#1A7A4A', bar: '#1A7A4A' },
  error:   { bg: '#7F1D1D', accent: '#B91C1C', bar: '#EF4444' },
  warning: { bg: '#78350F', accent: '#B45309', bar: '#F59E0B' },
  info:    { bg: '#0F2344', accent: '#1A3A6B', bar: '#3B82F6' },
  confirm: { bg: '#1E1B4B', accent: '#5B21B6', bar: '#8B5CF6' },
}

// ── Toast Item ────────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const s = STYLES[toast.type] || STYLES.info

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true))

    if (toast.duration === 0) return // confirm — non auto-dismiss

    // Progress bar
    const interval = setInterval(() => {
      setProgress(p => Math.max(0, p - (100 / (toast.duration / 50))))
    }, 50)

    // Auto dismiss
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration)

    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [toast.id, toast.duration, onRemove])

  function dismiss() {
    setVisible(false)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div style={{
      background: s.bg,
      borderRadius: 14,
      padding: '12px 16px',
      marginBottom: 8,
      minWidth: 300,
      maxWidth: 420,
      boxShadow: '0 8px 32px rgba(0,0,0,.25)',
      transform: visible ? 'translateX(0)' : 'translateX(120%)',
      opacity: visible ? 1 : 0,
      transition: 'all .3s cubic-bezier(.34,1.3,.64,1)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Bară progres */}
      {toast.duration > 0 && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${progress}%`,
          background: s.bar, borderRadius: 99, transition: 'width .05s linear' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Icon */}
        <div style={{ width: 28, height: 28, borderRadius: 8, background: s.accent + '33',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: s.bar, flexShrink: 0 }}>
          {ICONS[toast.type]}
        </div>

        {/* Message */}
        <div style={{ flex: 1, paddingTop: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.4 }}>
            {toast.message}
          </div>

          {/* Confirm buttons */}
          {toast.type === 'confirm' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { toast.action?.(); dismiss() }}
                style={{ padding: '5px 14px', borderRadius: 8, background: s.bar,
                  color: '#fff', border: 'none', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer' }}>
                Confirmă
              </button>
              <button onClick={dismiss}
                style={{ padding: '5px 14px', borderRadius: 8, background: 'rgba(255,255,255,.12)',
                  color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>
                Anulează
              </button>
            </div>
          )}
        </div>

        {/* Close */}
        <button onClick={dismiss}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)',
            cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Container ─────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 9999, display: 'flex', flexDirection: 'column-reverse',
      alignItems: 'flex-end',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}
