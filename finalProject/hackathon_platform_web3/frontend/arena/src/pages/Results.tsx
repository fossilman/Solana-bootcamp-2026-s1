import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Table, Tag, message, Row, Col } from 'antd'
import { TrophyOutlined, TeamOutlined, FileTextOutlined, LikeOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { StatCard, PageHeader } from '@shared/components'
import request from '../api/request'

export default function Results() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [results, setResults] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>({})

  useEffect(() => {
    if (id) {
      fetchResults()
    }
  }, [id])

  const fetchResults = async () => {
    try {
      const data = await request.get(`/hackathons/${id}/results`)
      setResults(data.rankings || [])
      setStatistics(data.statistics || {})
    } catch (error: any) {
      message.error(error.message || t('results.fetchFailed'))
    }
  }

  const columns = [
    { 
      title: t('results.rank'), 
      dataIndex: 'rank', 
      key: 'rank',
      width: 80,
      render: (text: any) => (
        <span 
          data-testid={`results-table-rank-${text}`}
          style={{ 
            fontWeight: text <= 3 ? 600 : 400,
            color: text === 1 ? '#ffd700' : text === 2 ? '#c0c0c0' : text === 3 ? '#cd7f32' : 'inherit'
          }}
        >
          {text === 1 && '🥇 '}
          {text === 2 && '🥈 '}
          {text === 3 && '🥉 '}
          {text}
        </span>
      )
    },
    { 
      title: t('results.teamName'), 
      dataIndex: ['team', 'name'], 
      key: 'team_name',
      render: (text: any) => <span data-testid={`results-table-team-${text}`}>{text}</span>
    },
    { 
      title: t('results.submissionName'), 
      dataIndex: ['submission', 'name'], 
      key: 'submission_name',
      render: (text: any) => <span data-testid={`results-table-submission-${text}`}>{text}</span>
    },
    { 
      title: t('results.voteCount'), 
      dataIndex: 'vote_count', 
      key: 'vote_count',
      width: 100,
      render: (text: any, record: any) => (
        <span data-testid={`results-table-votes-${record.rank}`}>
          <LikeOutlined style={{ marginRight: 4, color: 'var(--primary-color)' }} />
          {text}
        </span>
      )
    },
    {
      title: t('results.award'),
      key: 'award',
      render: (_: any, record: any) => (
        record.award ? (
          <Tag color="gold" data-testid={`results-table-award-${record.rank}`}>
            {record.award.name} - {record.award.prize}
          </Tag>
        ) : (
          <span data-testid={`results-table-award-${record.rank}`}>-</span>
        )
      ),
    },
  ]

  return (
    <div className="page-content" data-testid="results-page">
      <div className="page-container" data-testid="results-container">
        <PageHeader
          title={
            <>
            <TrophyOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
            {t('results.title')}
            </>
          }
          testId="results-header"
        />

        {/* 统计信息卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }} data-testid="results-statistics">
          <Col xs={24} sm={12} lg={8}>
            <StatCard
                title={t('results.totalVotes')}
                value={statistics.total_votes || 0}
                prefix={<LikeOutlined />}
              iconColor="var(--primary-color)"
              testId="results-stat-votes"
              />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <StatCard
                title={t('results.totalTeams')}
                value={statistics.total_teams || 0}
                prefix={<TeamOutlined />}
              iconColor="var(--success-color)"
              testId="results-stat-teams"
              />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <StatCard
                title={t('results.totalSubmissions')}
                value={statistics.total_submissions || 0}
                prefix={<FileTextOutlined />}
              iconColor="var(--warning-color)"
              testId="results-stat-submissions"
              />
          </Col>
        </Row>

        {/* 排名表格 */}
        <Card 
          title={t('results.ranking')} 
          data-testid="results-card"
          style={{ marginTop: 24 }}
        >
          <Table
            columns={columns}
            dataSource={results}
            rowKey="rank"
            pagination={false}
            data-testid="results-table"
          />
        </Card>
      </div>
    </div>
  )
}

