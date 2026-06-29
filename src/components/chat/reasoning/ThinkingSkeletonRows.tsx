import { motion } from 'framer-motion'

export function ThinkingSkeletonRows() {
  return (
    <div className="thinking-skeleton">
      {[80, 60, 90].map((width, i) => (
        <motion.div
          key={i}
          className="thinking-skeleton-row"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  )
}
