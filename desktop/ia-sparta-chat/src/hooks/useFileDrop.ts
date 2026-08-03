import { useState, useCallback, type DragEvent } from 'react'
import { processFile, type ProcessedAttachment } from '../lib/attachment-pipeline'

export function useFileDrop(onAttach?: (attachments: ProcessedAttachment[]) => void) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    try {
      const list: ProcessedAttachment[] = []
      for (const file of files) {
        const processed = await processFile(file)
        list.push(processed)
      }

      if (list.length > 0 && onAttach) {
        onAttach(list)
      }
    } catch (err) {
      console.error('Error processing dropped files:', err)
    }
  }, [onAttach])

  return {
    isDragging,
    dropProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}
