import { useState } from 'react'
import { X, Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useCronStore, type CronJob, type CronFrequency } from '@/stores/cron.store'

interface CronStatusDialogProps {
  open: boolean
  onClose: () => void
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatNextRun(ts: number): string {
  const diff = ts - Date.now()
  if (diff <= 0) return 'Ahora'
  if (diff < 3600000) return `en ${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `en ${Math.floor(diff / 3600000)}h`
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatSchedule(job: CronJob): string {
  switch (job.frequency) {
    case 'hourly':
      return 'Cada hora'
    case 'every_n_hours':
      return `Cada ${job.intervalHours ?? 1}h`
    case 'daily':
      return `Diario a las ${job.hour ?? 8}:00`
    case 'weekly':
      return `${DAY_LABELS[job.dayOfWeek ?? 1] ?? '?'} a las ${job.hour ?? 8}:00`
    default:
      return '\u2014'
  }
}

export function CronStatusDialog({ open, onClose }: CronStatusDialogProps) {
  const jobs = useCronStore((s) => s.jobs)
  const addJob = useCronStore((s) => s.addJob)
  const removeJob = useCronStore((s) => s.removeJob)
  const toggleJob = useCronStore((s) => s.toggleJob)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    frequency: 'daily' as CronFrequency,
    hour: 8,
    dayOfWeek: 1,
    intervalHours: 2,
    agentTaskTemplate: '',
  })

  const activeCount = jobs.filter((j) => j.enabled).length

  function handleSubmit() {
    if (!form.name.trim() || !form.agentTaskTemplate.trim()) return
    addJob({
      name: form.name.trim(),
      frequency: form.frequency,
      hour: form.frequency === 'daily' || form.frequency === 'weekly' ? form.hour : undefined,
      dayOfWeek: form.frequency === 'weekly' ? form.dayOfWeek : undefined,
      intervalHours: form.frequency === 'every_n_hours' ? form.intervalHours : undefined,
      agentTaskTemplate: form.agentTaskTemplate.trim(),
      enabled: true,
    })
    setForm({ name: '', frequency: 'daily', hour: 8, dayOfWeek: 1, intervalHours: 2, agentTaskTemplate: '' })
    setShowForm(false)
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={() => { onClose(); setShowForm(false) }}
    >
      <div
        style={{
          width: 460, maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0', flexShrink: 0,
        }}>
          <h3 style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Automatizaciones (Cron)
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
              {activeCount} activos
            </span>
          </h3>
          <button onClick={() => { onClose(); setShowForm(false) }} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 20px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {jobs.length === 0 && !showForm ? (
            <div style={{
              padding: '24px 0', textAlign: 'center', fontSize: 12,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
            }}>
              <Clock size={24} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 8 }} />
              <div>No hay automatizaciones programadas.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    opacity: job.enabled ? 1 : 0.5,
                  }}
                >
                  <button
                    onClick={() => toggleJob(job.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: job.enabled ? 'var(--status-ok)' : 'var(--text-muted)', flexShrink: 0,
                    }}
                  >
                    {job.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                      {job.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                      {formatSchedule(job)}
                    </div>
                    {job.lastRun && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                        Última ejecución: {new Date(job.lastRun).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {formatNextRun(job.nextRun)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeJob(job.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'var(--text-muted)', flexShrink: 0,
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
              borderRadius: 'var(--radius-md)', background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
            }}>
              <input
                placeholder="Nombre de la automatización"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{
                  padding: '6px 10px', fontSize: 12, background: 'var(--bg-surface)',
                  border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', outline: 'none',
                }}
              />
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as CronFrequency })}
                style={{
                  padding: '6px 10px', fontSize: 12, background: 'var(--bg-surface)',
                  border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', outline: 'none',
                }}
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="hourly">Cada hora</option>
                <option value="every_n_hours">Cada N horas</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                {(form.frequency === 'daily' || form.frequency === 'weekly') && (
                  <input
                    type="number" min={0} max={23}
                    value={form.hour}
                    onChange={(e) => setForm({ ...form, hour: parseInt(e.target.value) || 8 })}
                    style={{
                      width: 60, padding: '6px 10px', fontSize: 12,
                      background: 'var(--bg-surface)', border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)', outline: 'none',
                    }}
                    placeholder="Hora"
                  />
                )}
                {form.frequency === 'weekly' && (
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                    style={{
                      padding: '6px 10px', fontSize: 12, background: 'var(--bg-surface)',
                      border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', outline: 'none',
                    }}
                  >
                    {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                )}
                {form.frequency === 'every_n_hours' && (
                  <input
                    type="number" min={1} max={24}
                    value={form.intervalHours}
                    onChange={(e) => setForm({ ...form, intervalHours: parseInt(e.target.value) || 2 })}
                    style={{
                      width: 60, padding: '6px 10px', fontSize: 12,
                      background: 'var(--bg-surface)', border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)', outline: 'none',
                    }}
                    placeholder="Cada N h"
                  />
                )}
              </div>
              <textarea
                placeholder="¿Qué tarea debe ejecutar el agente?"
                value={form.agentTaskTemplate}
                onChange={(e) => setForm({ ...form, agentTaskTemplate: e.target.value })}
                rows={2}
                style={{
                  padding: '6px 10px', fontSize: 12, background: 'var(--bg-surface)',
                  border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
                  outline: 'none', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                    background: 'var(--bg-hover)', border: '1px solid var(--border-normal)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                    background: 'var(--accent)', border: 'none',
                    borderRadius: 'var(--radius-sm)', color: 'white',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Crear
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', fontSize: 12,
                background: 'var(--bg-hover)', border: '1px dashed var(--border-normal)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'var(--font-ui)', justifyContent: 'center', width: '100%',
              }}
            >
              <Plus size={14} />
              Nueva automatización
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
