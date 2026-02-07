import { Card, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { CalendarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

interface HackathonCardProps {
  hackathon: {
    id: number
    name: string
    description: string
    status: string
    start_time: string
    end_time: string
  }
  statusMap: Record<string, string>
  statusColorMap?: Record<string, string>
  testIdPrefix: string
  showDateIcon?: boolean
}

export default function HackathonCard({ 
  hackathon, 
  statusMap, 
  statusColorMap,
  testIdPrefix,
  showDateIcon = false
}: HackathonCardProps) {
  const navigate = useNavigate()

  return (
    <Card
      key={hackathon.id}
      title={
        <span style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)' }}>
          {hackathon.name}
        </span>
      }
      extra={
        <Tag 
          color={statusColorMap?.[hackathon.status]}
          data-testid={`${testIdPrefix}-card-${hackathon.id}-status`}
        >
          {statusMap[hackathon.status] || hackathon.status}
        </Tag>
      }
      hoverable
      onClick={() => navigate(`/hackathons/${hackathon.id}`)}
      data-testid={`${testIdPrefix}-card-${hackathon.id}`}
      aria-label={`活动卡片: ${hackathon.name}`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      <p 
        style={{ 
          color: 'var(--text-secondary)', 
            margin: 0,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)'
        }} 
        data-testid={`${testIdPrefix}-card-${hackathon.id}-date`}
      >
          {showDateIcon && <CalendarOutlined style={{ color: 'var(--primary-color)' }} />} 
        {dayjs(hackathon.start_time).format('YYYY-MM-DD')} - {dayjs(hackathon.end_time).format('YYYY-MM-DD')}
      </p>
      <p 
        style={{ 
          fontSize: '14px', 
            color: 'var(--text-tertiary)',
          lineHeight: '1.6',
            margin: 0,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical'
        }} 
        data-testid={`${testIdPrefix}-card-${hackathon.id}-description`}
      >
          {hackathon.description?.substring(0, 150) || ''}
          {hackathon.description && hackathon.description.length > 150 ? '...' : ''}
      </p>
      </div>
    </Card>
  )
}

