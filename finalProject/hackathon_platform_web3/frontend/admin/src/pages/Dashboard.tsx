import { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  message,
  Spin,
} from 'antd'
import {
  TrophyOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import { useAuthStore } from '../store/authStore'
import { StatCard, PageHeader } from '@shared/components'
import dayjs from 'dayjs'

export default function Dashboard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const { user } = useAuthStore()

  const statusMap: Record<string, { label: string; color: string }> = {
    preparation: { label: t('dashboard.statusPreparation'), color: 'default' },
    published: { label: t('dashboard.statusPublished'), color: 'blue' },
    registration: { label: t('dashboard.statusRegistration'), color: 'cyan' },
    checkin: { label: t('dashboard.statusCheckin'), color: 'orange' },
    team_formation: { label: t('dashboard.statusTeamFormation'), color: 'purple' },
    submission: { label: t('dashboard.statusSubmission'), color: 'geekblue' },
    voting: { label: t('dashboard.statusVoting'), color: 'magenta' },
    results: { label: t('dashboard.statusResults'), color: 'green' },
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const data = await request.get('/dashboard')
      setDashboard(data)
    } catch (error) {
      message.error(t('dashboard.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (loading || !dashboard) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }} data-testid="dashboard-loading">
        <Spin size="large" />
      </div>
    )
  }

  const recentColumns = [
    {
      title: t('dashboard.hackathonName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('dashboard.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = statusMap[status] || { label: status, color: 'default' }
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      },
    },
    {
      title: t('dashboard.startTime'),
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('dashboard.createdTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
  ]

  return (
    <div className="page-container" data-testid="dashboard-page">
      <PageHeader 
        title={t('dashboard.title')} 
        testId="dashboard-header"
      />

      {/* 系统概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--spacing-xl)' }} data-testid="dashboard-overview">
        <Col xs={24} sm={12} lg={6}>
          <StatCard
              title={t('dashboard.totalHackathons')}
              value={dashboard.system_overview?.total_hackathons || 0}
              prefix={<TrophyOutlined />}
            iconColor="var(--primary-color)"
            testId="dashboard-stat-total-hackathons"
            />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
              title={t('dashboard.activeHackathons')}
              value={dashboard.system_overview?.active_hackathons || 0}
              prefix={<TrophyOutlined />}
            iconColor="var(--success-color)"
            testId="dashboard-stat-active-hackathons"
            />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
              title={t('dashboard.totalUsers')}
              value={dashboard.system_overview?.total_users || 0}
              prefix={<UserOutlined />}
            iconColor="var(--info-color)"
            testId="dashboard-stat-total-users"
            />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
              title={t('dashboard.totalParticipants')}
              value={dashboard.system_overview?.total_participants || 0}
              prefix={<TeamOutlined />}
            iconColor="var(--warning-color)"
            testId="dashboard-stat-total-participants"
            />
        </Col>
      </Row>

      {/* 人员统计（仅Admin） */}
      {user?.role === 'admin' && dashboard.user_stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 'var(--spacing-xl)' }} data-testid="dashboard-user-stats">
          <Col xs={24} sm={12} lg={12}>
            <StatCard
                title={t('dashboard.totalOrganizers')}
                value={dashboard.user_stats.total_organizers || 0}
                prefix={<UserOutlined />}
              iconColor="var(--primary-color)"
              testId="dashboard-stat-organizers"
              />
          </Col>
          <Col xs={24} sm={12} lg={12}>
            <StatCard
                title={t('dashboard.totalSponsors')}
                value={dashboard.user_stats.total_sponsors || 0}
                prefix={<UserOutlined />}
              iconColor="var(--primary-color)"
              testId="dashboard-stat-sponsors"
              />
          </Col>
        </Row>
      )}

      {/* 活动状态统计 */}
      <Card 
        title={t('dashboard.statusStats')} 
        style={{ marginBottom: 'var(--spacing-xl)' }}
        data-testid="dashboard-status-stats"
      >
        <Row gutter={[16, 16]}>
          {Object.entries(dashboard.hackathon_stats?.by_status || {}).map(
            ([status, count]) => {
              const statusInfo = statusMap[status] || { label: status, color: 'default' }
              return (
                <Col xs={12} sm={8} lg={6} key={status}>
                  <StatCard
                      title={statusInfo.label}
                      value={count as number}
                      valueStyle={{ fontSize: '20px' }}
                    testId={`dashboard-status-stat-${status}`}
                    className="stat-card"
                    />
                </Col>
              )
            }
          )}
        </Row>
      </Card>

      {/* 最近活动 */}
      <Card title={t('dashboard.recentHackathons')} data-testid="dashboard-recent-hackathons">
        <Table
          columns={recentColumns}
          dataSource={dashboard.hackathon_stats?.recent || []}
          rowKey="id"
          pagination={false}
          size="small"
          data-testid="dashboard-recent-hackathons-table"
        />
      </Card>
    </div>
  )
}

