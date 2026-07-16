import { useState, useEffect } from 'react'
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

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, description?: string) => void
}

export function ProjectDialog({ open, onClose, onSubmit }: ProjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim(), description.trim() || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Los proyectos agrupan sesiones, memoria y servidores MCP.
          </DialogDescription>
        </DialogHeader>

        <form id="project-form" onSubmit={handleSubmit} className="px-6 pb-2 flex flex-col gap-4">
          <div>
            <label style={{
              display: 'block', fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', marginBottom: 4,
            }}>
              Nombre
            </label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="mi-proyecto" />
          </div>
          <div>
            <label style={{
              display: 'block', fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)', marginBottom: 4,
            }}>
              Descripción (opcional)
            </label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿De qué trata este proyecto?" rows={3} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button form="project-form" type="submit" disabled={!name.trim()}>Crear proyecto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
