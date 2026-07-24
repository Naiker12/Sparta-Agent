import { useState, useEffect } from 'react'
import { Hash, Bot, Globe, BookOpen, Code, Terminal, Users, Bell, Star, Camera, MessageCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'ia-sparta-design-system'
import { Input } from 'ia-sparta-design-system'
import { Textarea } from 'ia-sparta-design-system'
import { Button } from 'ia-sparta-design-system'

const ICON_OPTIONS = [
  { name: 'Hash', component: Hash },
  { name: 'Bot', component: Bot },
  { name: 'Globe', component: Globe },
  { name: 'BookOpen', component: BookOpen },
  { name: 'Code', component: Code },
  { name: 'Terminal', component: Terminal },
  { name: 'Users', component: Users },
  { name: 'Bell', component: Bell },
  { name: 'Star', component: Star },
  { name: 'Camera', component: Camera },
  { name: 'MessageCircle', component: MessageCircle },
]

interface ChannelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, topic?: string, icon?: string) => void
}

export function ChannelDialog({ open, onClose, onSubmit }: ChannelDialogProps) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [icon, setIcon] = useState('Hash')

  useEffect(() => {
    if (open) {
      setName('')
      setTopic('')
      setIcon('Hash')
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const clean = name.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-')
    onSubmit(clean, topic.trim() || undefined, icon)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo canal</DialogTitle>
          <DialogDescription>
            Los canales son espacios de conversación por tema.
          </DialogDescription>
        </DialogHeader>

        <form id="channel-form" onSubmit={handleSubmit} className="py-1 flex flex-col gap-3.5">
          <div>
            <label style={{
              display: 'block', fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', marginBottom: 4,
            }}>
              Nombre
            </label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="general" />
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', marginBottom: 4,
            }}>
              Icono
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map(({ name: n, component: Icon }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  style={{
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: icon === n ? 'var(--bg-active)' : 'var(--bg-input)',
                    border: icon === n ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    color: icon === n ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', marginBottom: 4,
            }}>
              Tópico (opcional)
            </label>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="De qué habla este canal" rows={2} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button form="channel-form" type="submit" disabled={!name.trim()}>Crear canal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
