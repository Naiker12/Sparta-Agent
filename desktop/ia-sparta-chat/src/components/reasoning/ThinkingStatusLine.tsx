import { motion, AnimatePresence } from 'framer-motion'
import { Marker, MarkerIcon, MarkerContent } from '@/components/ui/marker'
import { Brain } from 'lucide-react'

interface ThinkingStatusLineProps {
  text: string
}

export function ThinkingStatusLine({ text }: ThinkingStatusLineProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="my-1"
      >
        <Marker role="status" variant="border" className="bg-muted/20 border-border/30 py-1 px-3 rounded-md">
          <MarkerIcon>
            <Brain className="size-3.5 text-accent animate-pulse" />
          </MarkerIcon>
          <MarkerContent shimmer className="text-foreground/80 font-mono text-[11px]">
            {text}
          </MarkerContent>
        </Marker>
      </motion.div>
    </AnimatePresence>
  )
}
