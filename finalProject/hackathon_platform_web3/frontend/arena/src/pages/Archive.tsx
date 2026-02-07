import { useState, useEffect } from 'react'
import { Card, Row, Col, Input, Select, Button, Pagination, Tag, message, Spin, Descriptions, Table, Divider } from 'antd'
import { SearchOutlined, TrophyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@shared/components'
import request from '../api/request'
import dayjs from 'dayjs'

const { Search } = Input
const { Option } = Select

interface ArchiveHackathon {
  id: number
  name: string
  description: string
  start_time: string
  end_time: string
  status: string
}

export default function Archive() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [hackathons, setHackathons] = useState<ArchiveHackathon[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [timeRange, setTimeRange] = useState('all')
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 12,
    total: 0,
  })
  const [archiveDetail, setArchiveDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchArchiveHackathons = async (page = 1, pageSize = 12) => {
    setLoading(true)
    try {
      const data = await request.get('/hackathons/archive', {
        params: { page, page_size: pageSize, keyword: keyword || undefined, time_range: timeRange },
      })
      setHackathons(data.list || [])
      setPagination({
        current: page,
        pageSize,
        total: data.pagination?.total || data.total || 0,
      })
    } catch (error) {
      message.error(t('archive.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchArchiveDetail()
    } else {
      fetchArchiveHackathons(1, pagination.pageSize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, id])

  const fetchArchiveDetail = async () => {
    if (!id) return
    setDetailLoading(true)
    try {
      const data = await request.get(`/hackathons/archive/${id}`)
      setArchiveDetail(data)
    } catch (error) {
      message.error(t('archive.fetchDetailFailed'))
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSearch = () => {
    fetchArchiveHackathons(1, pagination.pageSize)
  }

  // 如果是详情页面
  if (id && archiveDetail) {
    return (
      <div className="page-content">
        <div className="page-container">
          <Button
            onClick={() => navigate('/hackathons/archive')}
            style={{ marginBottom: 'var(--spacing-xl)' }}
          >
            {t('archive.backToList')}
          </Button>
          <Card loading={detailLoading}>
            <h1 className="page-title" style={{ marginBottom: 'var(--spacing-xl)' }}>
              {archiveDetail.hackathon?.name}
            </h1>
            <Descriptions column={2} bordered>
              <Descriptions.Item label={t('archive.hackathonTime')}>
                {dayjs(archiveDetail.hackathon?.start_time).format('YYYY-MM-DD')} -{' '}
                {dayjs(archiveDetail.hackathon?.end_time).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label={t('archive.stats')}>
                <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                  <span>{t('archive.registration')}: <strong>{archiveDetail.stats?.registration_count || 0}</strong></span>
                  <span>{t('archive.checkin')}: <strong>{archiveDetail.stats?.checkin_count || 0}</strong></span>
                  <span>{t('archive.teams')}: <strong>{archiveDetail.stats?.team_count || 0}</strong></span>
                  <span>{t('archive.submissions')}: <strong>{archiveDetail.stats?.submission_count || 0}</strong></span>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label={t('archive.description')} span={2}>
                <div dangerouslySetInnerHTML={{ __html: archiveDetail.hackathon?.description }} />
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: 'var(--spacing-2xl) 0' }}>{t('archive.submissionList')}</Divider>
            <Table
              dataSource={archiveDetail.submissions || []}
              rowKey="id"
              columns={[
                { title: t('archive.submissionName'), dataIndex: 'name', key: 'name' },
                { title: t('archive.teamName'), dataIndex: ['team', 'name'], key: 'team_name' },
                { title: t('archive.votes'), dataIndex: 'vote_count', key: 'vote_count', render: (count) => count || 0 },
                { title: t('archive.submitTime'), dataIndex: 'created_at', key: 'created_at', render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm') },
              ]}
              pagination={false}
            />

            {archiveDetail.final_results && archiveDetail.final_results.length > 0 && (
              <>
                <Divider style={{ margin: 'var(--spacing-2xl) 0' }}>{t('archive.results')}</Divider>
                {archiveDetail.final_results.map((result: any, index: number) => (
                  <Card key={index} style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
                      {result.award_name}
                    </h3>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                      {t('archive.prize')}: <strong style={{ color: 'var(--primary-color)' }}>{result.prize}</strong>
                    </div>
                    {result.winners && result.winners.length > 0 && (
                      <div style={{ marginTop: 'var(--spacing-lg)' }}>
                        {result.winners.map((winner: any, wIndex: number) => (
                          <div 
                            key={wIndex} 
                            style={{ 
                              marginTop: 'var(--spacing-md)',
                              padding: 'var(--spacing-md)',
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-light)'
                            }}
                          >
                            <strong style={{ color: 'var(--text-primary)' }}>{winner.team_name}</strong> - {winner.submission_name} 
                            <span style={{ color: 'var(--text-secondary)', marginLeft: 'var(--spacing-sm)' }}>
                              ({t('archive.voteCount')}: {winner.vote_count})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </>
            )}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-container">
        <PageHeader
          title={
            <>
              <TrophyOutlined style={{ marginRight: 'var(--spacing-sm)', color: 'var(--primary-color)' }} />
            {t('archive.title')}
            </>
          }
          actions={
            <div className="search-input-wrapper">
            <Search
                className="search-input"
              placeholder={t('archive.searchPlaceholder')}
              allowClear
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
            />
            <Select
              value={timeRange}
              onChange={setTimeRange}
              style={{ width: 200 }}
            >
              <Option value="all">{t('archive.all')}</Option>
              <Option value="month">{t('archive.month')}</Option>
              <Option value="quarter">{t('archive.quarter')}</Option>
              <Option value="half_year">{t('archive.halfYear')}</Option>
            </Select>
          </div>
          }
          testId="archive-header"
        />

        <Spin spinning={loading}>
          {hackathons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-3xl)', color: 'var(--text-tertiary)' }}>
              {t('archive.noEndedHackathons')}
            </div>
          ) : (
            <>
              <div className="grid-container">
                {hackathons.map((hackathon) => (
                    <Card
                    key={hackathon.id}
                      hoverable
                      onClick={() => navigate(`/hackathons/archive/${hackathon.id}`)}
                    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}>
                          {hackathon.name}
                        </h3>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: 'var(--spacing-md)' }}>
                          {dayjs(hackathon.start_time).format('YYYY-MM-DD')} - {dayjs(hackathon.end_time).format('YYYY-MM-DD')}
                        </div>
                        <Tag color="green">{t('archive.ended')}</Tag>
                      </div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', flex: 1, lineHeight: '1.6' }}>
                        {hackathon.description?.substring(0, 120)}
                        {hackathon.description && hackathon.description.length > 120 ? '...' : ''}
                      </div>
                      <Button
                        type="primary"
                        block
                        style={{ marginTop: 'var(--spacing-lg)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/hackathons/archive/${hackathon.id}`)
                        }}
                      >
                        {t('archive.viewDetail')}
                      </Button>
                    </div>
                    </Card>
                ))}
              </div>
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Pagination
                  current={pagination.current}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  showSizeChanger
                  showTotal={(total) => t('archive.totalRecords', { total })}
                  onChange={(page, pageSize) => {
                    fetchArchiveHackathons(page, pageSize)
                  }}
                  onShowSizeChange={(current, size) => {
                    fetchArchiveHackathons(1, size)
                  }}
                />
              </div>
            </>
          )}
        </Spin>
      </div>
    </div>
  )
}

