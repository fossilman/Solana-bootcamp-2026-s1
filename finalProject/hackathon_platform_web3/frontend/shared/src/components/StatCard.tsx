// @ts-nocheck
import { Card, Statistic } from 'antd'
import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: number | string
  prefix?: ReactNode
  suffix?: ReactNode
  valueStyle?: React.CSSProperties
  iconColor?: string
  onClick?: () => void
  hoverable?: boolean
  testId?: string
  className?: string
}

/**
 * 统一的统计卡片组件
 * 用于展示统计数据，支持点击交互
 */
export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  valueStyle,
  iconColor,
  onClick,
  hoverable = false,
  testId,
  className = 'stat-card',
}: StatCardProps) {
  const cardStyle: React.CSSProperties = onClick ? { cursor: 'pointer' } : {}
  
  const iconWithColor = prefix && iconColor
    ? <span style={{ color: iconColor }}>{prefix}</span>
    : prefix

  return (
    <Card
      className={className}
      hoverable={hoverable}
      onClick={onClick}
      style={cardStyle}
      data-testid={testId}
    >
      <Statistic
        title={title}
        value={value}
        prefix={iconWithColor}
        suffix={suffix}
        valueStyle={{
          color: 'var(--text-primary)',
          fontWeight: 600,
          ...valueStyle,
        }}
        data-testid={testId ? `${testId}-value` : undefined}
      />
    </Card>
  )
}

