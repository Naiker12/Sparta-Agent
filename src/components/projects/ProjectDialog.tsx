import { useState, useEffect } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

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
    <Modal open={open} onClose={onClose} width={460} maxHeight={360}>
      <ModalHeader
        title="Nuevo proyecto"
        description="Los proyectos agrupan sesiones, memoria y servidores MCP."
        onClose={onClose}
      />

      <form id="project-form" onSubmit={handleSubmit}>
        <ModalBody style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              marginBottom: 4,
            }}>
              Nombre
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mi-proyecto"
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              marginBottom: 4,
            }}>
              Descripción (opcional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿De qué trata este proyecto?"
              rows={3}
            />
          </div>
        </ModalBody>
      </form>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button form="project-form" type="submit" disabled={!name.trim()}>
          Crear proyecto
        </Button>
      </ModalFooter>
    </Modal>
  )
}
