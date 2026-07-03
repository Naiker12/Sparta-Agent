import { useMemo, Children, isValidElement, cloneElement } from 'react'
import type { ReactNode } from 'react'
import type { ThinkingStatus, PipelineStep } from '@/types'

interface ReasoningSegment {
  content: string
  status: ThinkingStatus
  tokensUsed: number
  pipelineSteps?: PipelineStep[]
}

interface ReasoningAccordionGroupProps {
  segments: ReasoningSegment[]
  children?: ReactNode
  messageId?: string
  className?: string
}

export function ReasoningAccordionGroup({ segments, children, messageId, className }: ReasoningAccordionGroupProps) {
  const hasContent = useMemo(
    () => segments.some((s) => s.content.length > 0 || s.status === 'streaming' || s.status === 'starting'),
    [segments]
  )

  if (!hasContent && segments.every((s) => s.status === 'completed' || s.status === 'idle')) {
    return null
  }

  const mergedContent = useMemo(
    () => segments.map((s) => s.content).filter(Boolean).join('\n'),
    [segments]
  )

  const mergedStatus = useMemo((): ThinkingStatus => {
    if (segments.some((s) => s.status === 'streaming')) return 'streaming'
    if (segments.some((s) => s.status === 'starting')) return 'starting'
    if (segments.some((s) => s.status === 'completed')) return 'completed'
    return 'idle'
  }, [segments])

  const totalTokens = useMemo(
    () => segments.reduce((sum, s) => sum + (s.tokensUsed ?? 0), 0),
    [segments]
  )

  const mergedSteps = useMemo(
    () => segments.flatMap((s) => s.pipelineSteps ?? []),
    [segments]
  )

  if (children) {
    const childArray = Children.toArray(children)
    const validChildren = childArray.filter(
      (child) => isValidElement(child) && child.props?.content
    )
    if (validChildren.length === 0) return null
    if (validChildren.length === 1) return <>{validChildren[0]}</>

    const firstChild = validChildren[0] as React.ReactElement
    const enhancedProps = {
      content: mergedContent,
      status: mergedStatus,
      tokensUsed: totalTokens,
      pipelineSteps: mergedSteps,
      messageId,
      className,
    }

    return cloneElement(firstChild, enhancedProps)
  }

  return null
}
