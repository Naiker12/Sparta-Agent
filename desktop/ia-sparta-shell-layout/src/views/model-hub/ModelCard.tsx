import { Heart, ArrowDown, Check } from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import { useTheme } from 'ia-sparta-core'
import type { ModelHubItem } from './types'

interface ModelCardProps {
  model: ModelHubItem
  isSelected: boolean
  onClick: () => void
  onSelect?: () => void
}

export function ModelCard({ model, isSelected, onClick }: ModelCardProps) {
  const { isDark } = useTheme()

  const bg = isDark
    ? isSelected
      ? '#1B2230'
      : 'transparent'
    : isSelected
      ? '#F0ECE4'
      : 'transparent'

  const borderColor = isDark
    ? isSelected
      ? '#2B384E'
      : 'transparent'
    : isSelected
      ? '#D8D0C2'
      : 'transparent'

  const titleColor = isDark
    ? isSelected
      ? '#FFFFFF'
      : '#E2E8F0'
    : isSelected
      ? '#1C1713'
      : '#2A241E'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 10,
        backgroundColor: bg,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        userSelect: 'none',
        gap: 12,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = isDark ? '#141822' : '#F5EFE6'
          e.currentTarget.style.borderColor = isDark ? '#1E2533' : '#EAE3D8'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }
      }}
    >
      {/* Left side: Avatar + Model Name + Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: isDark ? '#161B26' : '#FFFFFF',
            border: `1px solid ${isDark ? '#252D3D' : '#EAE3D8'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <BrandIcon vendor={model.vendor || 'unsloth'} size={20} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Title + Status Dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: titleColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
            >
              {model.displayName}
            </span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#38BDF8',
                flexShrink: 0,
              }}
            />
          </div>

          {/* Author with Verified Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#786C5E' }}>
              {model.author}
            </span>
            {model.authorVerified && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                }}
              >
                <Check size={8} strokeWidth={3.5} />
              </span>
            )}
            {model.isLocalAvailable && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 3,
                  backgroundColor: isDark ? '#064E3B' : '#DCFCE7',
                  color: isDark ? '#34D399' : '#166534',
                  fontFamily: 'monospace',
                  marginLeft: 4,
                }}
              >
                ON DISK
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Likes, Downloads & Time */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: isDark ? '#64748B' : '#8A7D6F' }}>
          {model.likes && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Heart size={10} color={isDark ? '#64748B' : '#8A7D6F'} />
              <span>{model.likes}</span>
            </span>
          )}
          {model.downloads && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <ArrowDown size={10} color={isDark ? '#64748B' : '#8A7D6F'} />
              <span>{model.downloads}</span>
            </span>
          )}
        </div>

        {model.updatedAt && (
          <span style={{ fontSize: 10, color: isDark ? '#475569' : '#A39686' }}>
            {model.updatedAt}
          </span>
        )}
      </div>
    </div>
  )
}
