import { motion, AnimatePresence } from 'framer-motion'

interface ThinkingStatusLineProps {
  text: string
}

export function ThinkingStatusLine({ text }: ThinkingStatusLineProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 0.75, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          fontSize: 11,
          fontStyle: 'italic',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          padding: '2px 6px 4px',
        }}
      >
        {text}
      </motion.div>
    </AnimatePresence>
  )
}
