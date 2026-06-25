import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface ChannelDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, topic?: string) => void
}

export function ChannelDialog({ open, onClose, onSubmit }: ChannelDialogProps) {
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setTopic('')
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const clean = name.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-')
    onSubmit(clean, topic.trim() || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo canal</DialogTitle>
            <DialogDescription>
              Los canales son espacios de conversación por tema.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  marginBottom: 4,
                }}
              >
                Nombre
              </label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="general"
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  marginBottom: 4,
                }}
              >
                Tópico (opcional)
              </label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="De qué habla este canal"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter style={{ marginTop: 16 }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Crear canal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
