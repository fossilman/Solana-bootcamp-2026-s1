import { useState, useEffect } from 'react'
import { Table, Button, Card, message, Modal, Tabs, Tag, Image, Space, Descriptions } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { PublicKey } from '@solana/web3.js'
import request from '../api/request'
import dayjs from 'dayjs'
import {
  getLatestBlockhash,
  signTransactionWithPhantom,
  buildApproveSponsorTransaction,
  buildRejectSponsorTransaction,
  type PrepareSponsorReviewData,
} from '../utils/solanaPublish'

const { TabPane } = Tabs

interface SponsorApplication {
  id: number
  phone: string
  logo_url: string
  sponsor_type: string
  event_ids: string
  wallet_address?: string
  status: string
  created_at: string
  reviewed_at?: string
  reviewer_id?: number
}

export default function SponsorReview() {
  const { t } = useTranslation()
  const [pendingApplications, setPendingApplications] = useState<SponsorApplication[]>([])
  const [reviewedApplications, setReviewedApplications] = useState<SponsorApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState<number | null>(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })
  const [reviewedPagination, setReviewedPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [hackathonsMap, setHackathonsMap] = useState<Record<number, any>>({})
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedHackathon, setSelectedHackathon] = useState<any>(null)

  const statusMap: Record<string, { label: string; color: string }> = {
    preparation: { label: t('hackathon.statusPreparation'), color: 'default' },
    published: { label: t('hackathon.statusPublished'), color: 'blue' },
    registration: { label: t('hackathon.statusRegistration'), color: 'cyan' },
    checkin: { label: t('hackathon.statusCheckin'), color: 'orange' },
    team_formation: { label: t('hackathon.statusTeamFormation'), color: 'purple' },
    submission: { label: t('hackathon.statusSubmission'), color: 'geekblue' },
    voting: { label: t('hackathon.statusVoting'), color: 'magenta' },
    results: { label: t('hackathon.statusResults'), color: 'green' },
  }

  // 获取待审核列表
  const fetchPendingApplications = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const response = await request.get('/sponsor/applications/pending', {
        params: { page, page_size: pageSize },
      })
      const data = response as any
      setPendingApplications(data.list || [])
      setPagination({
        current: page,
        pageSize,
        total: data.pagination?.total || data.total || 0,
      })
    } catch (error) {
      message.error(t('sponsorReview.fetchPendingFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 获取已审核列表
  const fetchReviewedApplications = async (page = 1, pageSize = 20, status = 'all') => {
    setLoading(true)
    try {
      const response = await request.get('/sponsor/applications/reviewed', {
        params: { page, page_size: pageSize, status },
      })
      const data = response as any
      setReviewedApplications(data.list || [])
      setReviewedPagination({
        current: page,
        pageSize,
        total: data.pagination?.total || data.total || 0,
      })
    } catch (error) {
      message.error(t('sponsorReview.fetchReviewedFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 解析活动ID列表
  const parseEventIds = (eventIdsStr: string): number[] => {
    try {
      return JSON.parse(eventIdsStr || '[]')
    } catch {
      return []
    }
  }

  // 获取活动信息
  const fetchHackathons = async (eventIds: number[]) => {
    if (eventIds.length === 0) return
    
    const missingIds = eventIds.filter(id => !hackathonsMap[id])
    if (missingIds.length === 0) return

    try {
      const promises = missingIds.map(id => 
        request.get(`/hackathons/${id}`).catch(() => null)
      )
      const results = await Promise.all(promises)
      
      const newMap: Record<number, any> = { ...hackathonsMap }
      results.forEach((hackathon, index) => {
        if (hackathon) {
          newMap[missingIds[index]] = hackathon
        }
      })
      setHackathonsMap(newMap)
    } catch (error) {
      // 忽略错误
    }
  }

  useEffect(() => {
    fetchPendingApplications()
    fetchReviewedApplications(1, 20, statusFilter)
  }, [statusFilter])

  // 当数据加载后，获取活动信息
  useEffect(() => {
    const allEventIds: number[] = []
    pendingApplications.forEach(app => {
      const ids = parseEventIds(app.event_ids)
      allEventIds.push(...ids)
    })
    reviewedApplications.forEach(app => {
      const ids = parseEventIds(app.event_ids)
      allEventIds.push(...ids)
    })
    if (allEventIds.length > 0) {
      fetchHackathons([...new Set(allEventIds)])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingApplications, reviewedApplications])

  // 审核申请：主办方用钱包签名链上指令，再提交后端更新 DB
  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    Modal.confirm({
      title: action === 'approve' ? t('sponsorReview.confirmApprove') : t('sponsorReview.confirmReject'),
      content: (
        <>
          <p>{action === 'approve' ? t('sponsorReview.approveContent') : t('sponsorReview.rejectContent')}</p>
          <p style={{ marginTop: 8, color: '#666' }}>{t('sponsorReview.signWithWalletTip')}</p>
        </>
      ),
      onOk: async () => {
        setReviewLoading(id)
        try {
          const prepare = await request.get('/sponsor/review/prepare', {
            params: { application_id: id },
          }) as PrepareSponsorReviewData

          const phantom = (window as any).phantom?.solana
          if (!phantom || typeof phantom.connect !== 'function') {
            message.error(t('sponsorReview.phantomRequired'))
            return
          }
          const { publicKey } = await phantom.connect()
          const authority = new PublicKey(publicKey.toBase58())
          const blockhash = await getLatestBlockhash(prepare.rpc_url)
          const transaction = action === 'approve'
            ? buildApproveSponsorTransaction(prepare, authority, blockhash)
            : buildRejectSponsorTransaction(prepare, authority, blockhash)
          const signedBase64 = await signTransactionWithPhantom(transaction)

          await request.post(`/sponsor/applications/${id}/review`, {
            action,
            signed_transaction: signedBase64,
          })
          message.success(t('sponsorReview.reviewSuccess'))
          fetchPendingApplications(pagination.current, pagination.pageSize)
          fetchReviewedApplications(reviewedPagination.current, reviewedPagination.pageSize, statusFilter)
        } catch (error: any) {
          message.error(error?.response?.data?.message || error?.message || t('sponsorReview.reviewFailed'))
        } finally {
          setReviewLoading(null)
        }
      },
    })
  }

  // 获取活动名称
  const getEventNames = (eventIds: number[]): React.ReactNode => {
    if (eventIds.length === 0) return '-'
    
    return (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {eventIds.map((id) => {
          const hackathon = hackathonsMap[id]
          const name = hackathon?.name || `${t('sponsorReview.eventIdPrefix')}: ${id}`
          return (
            <Button
              key={id}
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewHackathon(id)}
              style={{ padding: 0, height: 'auto' }}
            >
              {name}
            </Button>
          )
        })}
      </Space>
    )
  }

  // 查看活动详情
  const handleViewHackathon = async (id: number) => {
    let hackathon = hackathonsMap[id]
    
    if (!hackathon) {
      try {
        hackathon = await request.get(`/hackathons/${id}`)
        setHackathonsMap({ ...hackathonsMap, [id]: hackathon })
      } catch (error) {
        message.error(t('hackathon.fetchDetailFailed'))
        return
      }
    }
    
    setSelectedHackathon(hackathon)
    setDetailModalVisible(true)
  }

  const pendingColumns = [
    {
      title: t('sponsorReview.applicationTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('sponsorReview.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: t('sponsorReview.logo'),
      dataIndex: 'logo_url',
      key: 'logo_url',
      width: 100,
      render: (url: string) => (
        <Image
          src={url}
          alt={t('sponsorReview.logo')}
          width={50}
          height={50}
          style={{ objectFit: 'contain' }}
          preview={false}
        />
      ),
    },
    {
      title: t('sponsorReview.sponsorType'),
      dataIndex: 'sponsor_type',
      key: 'sponsor_type',
      width: 150,
      render: (type: string) => (
        <Tag color={type === 'long_term' ? 'blue' : 'green'}>
          {type === 'long_term' ? t('sponsor.longTerm') : t('sponsor.eventSpecific')}
        </Tag>
      ),
    },
    {
      title: t('sponsorReview.amountSol'),
      dataIndex: 'amount_sol',
      key: 'amount_sol',
      width: 120,
      render: (v: number) => (v != null && Number.isFinite(v) ? `${v} SOL` : '-'),
    },
    {
      title: t('sponsorReview.relatedEvents'),
      dataIndex: 'event_ids',
      key: 'event_ids',
      width: 200,
      render: (eventIds: string) => {
        const ids = parseEventIds(eventIds)
        return ids.length > 0 ? getEventNames(ids) : '-'
      },
    },
    {
      title: t('sponsorReview.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: SponsorApplication) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            size="small"
            onClick={() => handleReview(record.id, 'approve')}
            loading={reviewLoading === record.id}
          >
            {t('sponsorReview.approve')}
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            size="small"
            onClick={() => handleReview(record.id, 'reject')}
            loading={reviewLoading === record.id}
          >
            {t('sponsorReview.reject')}
          </Button>
        </Space>
      ),
    },
  ]

  const reviewedColumns = [
    ...pendingColumns.slice(0, -1), // 移除操作列
    {
      title: t('sponsorReview.reviewTime'),
      dataIndex: 'reviewed_at',
      key: 'reviewed_at',
      width: 180,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('sponsorReview.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'approved' ? 'green' : 'red'}>
          {status === 'approved' ? t('sponsorReview.approved') : t('sponsorReview.rejected')}
        </Tag>
      ),
    },
  ]

  return (
    <div className="page-container">
      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }}>
            {t('sponsorReview.title')}
          </div>
        }
      >
        <Tabs defaultActiveKey="pending">
          <TabPane tab={t('sponsorReview.pending')} key="pending">
            <Table
              columns={pendingColumns}
              dataSource={pendingApplications}
              loading={loading}
              rowKey="id"
              scroll={{ x: 1000 }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => t('sponsorReview.totalRecords', { total }),
                onChange: (page, pageSize) => {
                  fetchPendingApplications(page, pageSize)
                },
                onShowSizeChange: (current, size) => {
                  fetchPendingApplications(1, size)
                },
              }}
            />
          </TabPane>
          <TabPane tab={t('sponsorReview.reviewed')} key="reviewed">
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <span>{t('sponsorReview.filter')}:</span>
                <Button
                  type={statusFilter === 'all' ? 'primary' : 'default'}
                  onClick={() => setStatusFilter('all')}
                >
                  {t('sponsorReview.all')}
                </Button>
                <Button
                  type={statusFilter === 'approved' ? 'primary' : 'default'}
                  onClick={() => setStatusFilter('approved')}
                >
                  {t('sponsorReview.approved')}
                </Button>
                <Button
                  type={statusFilter === 'rejected' ? 'primary' : 'default'}
                  onClick={() => setStatusFilter('rejected')}
                >
                  {t('sponsorReview.rejected')}
                </Button>
              </Space>
            </div>
            <Table
              columns={reviewedColumns}
              dataSource={reviewedApplications}
              loading={loading}
              rowKey="id"
              scroll={{ x: 1000 }}
              pagination={{
                current: reviewedPagination.current,
                pageSize: reviewedPagination.pageSize,
                total: reviewedPagination.total,
                showSizeChanger: true,
                showTotal: (total) => t('sponsorReview.totalRecords', { total }),
                onChange: (page, pageSize) => {
                  fetchReviewedApplications(page, pageSize, statusFilter)
                },
                onShowSizeChange: (current, size) => {
                  fetchReviewedApplications(1, size, statusFilter)
                },
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 活动详情弹窗 */}
      <Modal
        title={t('hackathon.detail')}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            {t('cancel')}
          </Button>,
        ]}
        width={800}
      >
        {selectedHackathon && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label={t('hackathon.name')}>
              {selectedHackathon.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('hackathon.status')}>
              <Tag color={statusMap[selectedHackathon.status]?.color || 'default'}>
                {statusMap[selectedHackathon.status]?.label || selectedHackathon.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('hackathon.startTime')}>
              {dayjs(selectedHackathon.start_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('hackathon.endTime')}>
              {dayjs(selectedHackathon.end_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('hackathon.description')} span={2}>
              <div dangerouslySetInnerHTML={{ __html: selectedHackathon.description || '-' }} />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

