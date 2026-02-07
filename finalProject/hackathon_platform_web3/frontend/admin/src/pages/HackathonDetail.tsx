import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Button,
  Space,
  message,
  Tag,
  Spin,
  Divider,
  Row,
  Col,
  Table,
  Tabs,
  Timeline,
  Modal,
  Input,
  Image,
  Popover,
} from 'antd'
import {
  EditOutlined,
  RocketOutlined,
  ArrowRightOutlined,
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { PublicKey } from '@solana/web3.js'
import { StatCard } from '@shared/components'
import request from '../api/request'
import { useAuthStore } from '../store/authStore'
import dayjs from 'dayjs'
import { getSolanaExplorerAddressUrl } from '../config/solana'
import {
  buildPublishActivityTransaction,
  buildSwitchStageTransaction,
  signTransactionWithPhantom,
  getLatestBlockhash,
  type PreparePublishData,
  type PrepareSwitchStageData,
} from '../utils/solanaPublish'

export default function HackathonDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [hackathon, setHackathon] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailType, setDetailType] = useState<string>('')
  const [detailData, setDetailData] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailKeyword, setDetailKeyword] = useState('')
  const [detailPagination, setDetailPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })
  const [posterInfo, setPosterInfo] = useState<any>(null)
  const [publishLoading, setPublishLoading] = useState(false)
  const [switchStageLoading, setSwitchStageLoading] = useState(false)
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

  const stageFlow = [
    { from: 'preparation', to: 'published', label: t('dashboard.statusPublished') },
    { from: 'published', to: 'registration', label: t('dashboard.statusRegistration') },
    { from: 'registration', to: 'checkin', label: t('dashboard.statusCheckin') },
    { from: 'checkin', to: 'team_formation', label: t('dashboard.statusTeamFormation') },
    { from: 'team_formation', to: 'submission', label: t('dashboard.statusSubmission') },
    { from: 'submission', to: 'voting', label: t('dashboard.statusVoting') },
    { from: 'voting', to: 'results', label: t('dashboard.statusResults') },
  ]

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const [hackathonData, statsData, stagesData] = await Promise.all([
        request.get(`/hackathons/${id}`),
        request.get(`/hackathons/${id}/stats`),
        request.get(`/hackathons/${id}/stages`),
      ])
      setHackathon(hackathonData)
      setStats(statsData)
      setStages(Array.isArray(stagesData) ? stagesData : [])
      
      // 如果活动已发布，获取海报二维码
      if (hackathonData && String(hackathonData.status) !== 'preparation') {
        try {
          const posterData = await request.get(`/hackathons/${id}/poster/qrcode`)
          setPosterInfo(posterData)
        } catch (error) {
          // 如果获取失败，使用默认URL
          setPosterInfo({
            poster_url: `/posters/${id}`,
            qr_code_url: '',
          })
        }
      }
    } catch (error) {
      message.error(t('hackathon.fetchDetailFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchDetail()
    }
  }, [id])

  const handlePublish = async () => {
    setPublishLoading(true)
    try {
      const prepare = await request.get(`/hackathons/${id}/publish/prepare`) as PreparePublishData
      const phantom = (window as any).phantom?.solana
      if (!phantom || typeof phantom.connect !== 'function') {
        message.error(t('hackathon.publishNeedPhantom'))
        return
      }
      const { publicKey } = await phantom.connect()
      const authority = new PublicKey(publicKey.toBase58())
      const blockhash = await getLatestBlockhash(prepare.rpc_url)
      const { transaction, activityPDA } = buildPublishActivityTransaction(prepare, authority, blockhash)
      const signedBase64 = await signTransactionWithPhantom(transaction)
      const result = await request.post(`/hackathons/${id}/publish`, {
        signed_transaction: signedBase64,
        activity_pda: activityPDA.toBase58(),
      })
      message.success(t('hackathon.publishSuccess'))
      setPosterInfo(result)
      await fetchDetail()
    } catch (err: any) {
      if (!err?.response) {
        message.error(t('hackathon.publishFailed'))
      }
    } finally {
      setPublishLoading(false)
    }
  }

  // 下载二维码
  const handleDownloadQRCode = () => {
    if (!posterInfo?.qr_code_url) return
    
    const link = document.createElement('a')
    link.href = posterInfo.qr_code_url
    link.download = `hackathon-${id}-qrcode.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSwitchStage = async (stage: string) => {
    // 切换到「已发布」与发布按钮逻辑完全一致：调用同一套发布接口
    if (stage === 'published') {
      await handlePublish()
      return
    }
    setSwitchStageLoading(true)
    try {
      const prepare = (await request.get(
        `/hackathons/${id}/stages/${stage}/switch/prepare`
      )) as PrepareSwitchStageData

      if (prepare.need_chain_update && prepare.rpc_url && prepare.chain_instruction) {
        const phantom = (window as any).phantom?.solana
        if (!phantom || typeof phantom.connect !== 'function') {
          message.error(t('hackathon.publishNeedPhantom'))
          return
        }
        const { publicKey } = await phantom.connect()
        const authority = new PublicKey(publicKey.toBase58())
        const blockhash = await getLatestBlockhash(prepare.rpc_url)
        const transaction = buildSwitchStageTransaction(prepare, authority, blockhash)
        const signedBase64 = await signTransactionWithPhantom(transaction)
        await request.post(`/hackathons/${id}/stages/${stage}/switch`, {
          signed_transaction: signedBase64,
        })
      } else {
        await request.post(`/hackathons/${id}/stages/${stage}/switch`)
      }
      message.success(t('hackathon.switchStageSuccess'))
      await fetchDetail()
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('hackathon.switchStageFailed')
      message.error(msg)
    } finally {
      setSwitchStageLoading(false)
    }
  }

  // 获取统计详情
  const fetchStatsDetail = async (type: string, page = 1, pageSize = 20, keyword = '') => {
    setDetailLoading(true)
    try {
      const response = await request.get(`/hackathons/${id}/stats/${type}`, {
        params: { page, page_size: pageSize, keyword },
      })
      const data = response as any
      setDetailData(data.list || [])
      setDetailPagination({
        current: page,
        pageSize,
        total: data.pagination?.total || data.total || 0,
      })
    } catch (error) {
      message.error(t('hackathon.fetchDetailFailed'))
    } finally {
      setDetailLoading(false)
    }
  }

  // 打开统计详情弹窗
  const handleOpenDetail = (type: string) => {
    setDetailType(type)
    setDetailModalVisible(true)
    setDetailKeyword('')
    setDetailPagination({ current: 1, pageSize: 20, total: 0 })
    fetchStatsDetail(type, 1, 20, '')
  }

  // 搜索统计详情
  const handleDetailSearch = () => {
    fetchStatsDetail(detailType, 1, detailPagination.pageSize, detailKeyword)
  }

  // 获取详情表格列
  const getDetailColumns = () => {
    switch (detailType) {
      case 'registrations':
        return [
          { title: t('hackathon.nickname'), dataIndex: 'nickname', key: 'nickname' },
          { title: t('hackathon.walletAddress'), dataIndex: 'wallet_address', key: 'wallet_address' },
          { title: t('hackathon.registrationTime'), dataIndex: 'created_at', key: 'created_at', render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm') },
        ]
      case 'checkins':
        return [
          { title: t('hackathon.nickname'), dataIndex: 'nickname', key: 'nickname' },
          { title: t('hackathon.walletAddress'), dataIndex: 'wallet_address', key: 'wallet_address' },
          { title: t('hackathon.checkinTime'), dataIndex: 'created_at', key: 'created_at', render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm') },
        ]
      case 'teams':
        return [
          { title: t('hackathon.teamName'), dataIndex: 'team_name', key: 'team_name' },
          { title: t('hackathon.leader'), dataIndex: 'leader', key: 'leader' },
          { title: t('hackathon.memberCount'), dataIndex: 'member_count', key: 'member_count' },
          { title: t('hackathon.createdTime'), dataIndex: 'created_at', key: 'created_at', render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm') },
        ]
      case 'submissions':
        return [
          { title: t('hackathon.submissionName'), dataIndex: 'submission_name', key: 'submission_name' },
          { title: t('hackathon.teamName'), dataIndex: 'team_name', key: 'team_name' },
          { title: t('hackathon.submitTime'), dataIndex: 'created_at', key: 'created_at', render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm') },
          { title: t('hackathon.voteCount'), dataIndex: 'vote_count', key: 'vote_count' },
        ]
      default:
        return []
    }
  }

  const getDetailTitle = () => {
    const titles: Record<string, string> = {
      registrations: t('hackathon.registrationDetail'),
      checkins: t('hackathon.checkinDetail'),
      teams: t('hackathon.teamDetail'),
      submissions: t('hackathon.submissionDetail'),
    }
    return titles[detailType] || t('hackathon.detailTitle')
  }

  const getNextStage = () => {
    return stageFlow.find((flow) => flow.from === hackathon?.status)
  }

  const isCreator = hackathon?.organizer_id === user?.id
  const canEdit = isCreator && hackathon?.status === 'preparation'
  const canManageStages = isCreator
  
  // 检查阶段时间是否已设置（需要所有5个阶段都设置）
  const hasStageTimes = stages && stages.length >= 5
  const canPublish = isCreator && hackathon?.status === 'preparation' && hasStageTimes

  const stageLabels: Record<string, string> = {
    registration: t('hackathon.registrationStage'),
    checkin: t('hackathon.checkinStage'),
    team_formation: t('hackathon.teamFormationStage'),
    submission: t('hackathon.submissionStage'),
    voting: t('hackathon.votingStage'),
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }} data-testid="hackathon-detail-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!hackathon) {
    return <div data-testid="hackathon-detail-empty">{t('common.loading')}</div>
  }

  const statusInfo = statusMap[hackathon.status] || {
    label: hackathon.status,
    color: 'default',
  }
  const nextStage = getNextStage()

  return (
    <div className="page-container" data-testid="hackathon-detail-page">
      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }} data-testid="hackathon-detail-title">
            {hackathon.name}
          </div>
        }
        extra={
          <Space data-testid="hackathon-detail-actions">
            {canEdit && (
              <>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/hackathons/${id}/edit`)}
                  data-testid="hackathon-detail-edit-button"
                  aria-label={t('hackathon.edit')}
                >
                  {t('hackathon.edit')}
                </Button>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={handlePublish}
                  loading={publishLoading}
                  disabled={!canPublish || publishLoading}
                  data-testid="hackathon-detail-publish-button"
                  aria-label={t('hackathon.publish')}
                  title={!hasStageTimes ? t('hackathon.stages') : ''}
                >
                  {t('hackathon.publish')}
                </Button>
              </>
            )}
            {canManageStages && (
              <Button
                icon={<SettingOutlined />}
                onClick={() => navigate(`/hackathons/${id}/stages`)}
                data-testid="hackathon-detail-stages-button"
                aria-label={t('hackathon.stages')}
              >
                {t('hackathon.stages')}
              </Button>
            )}
          </Space>
        }
        data-testid="hackathon-detail-card"
      >
        <Descriptions column={2} bordered data-testid="hackathon-detail-descriptions">
          <Descriptions.Item label={t('hackathon.status')} data-testid="hackathon-detail-status">
            <Tag color={statusInfo.color} style={{ fontSize: '14px' }} data-testid="hackathon-detail-status-tag">
              {statusInfo.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('hackathon.startTime')} data-testid="hackathon-detail-start-time">
            {dayjs(hackathon.start_time).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label={t('hackathon.endTime')} data-testid="hackathon-detail-end-time">
            {dayjs(hackathon.end_time).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label={t('hackathon.locationType')} data-testid="hackathon-detail-location-type">
            {hackathon.location_type === 'online'
              ? t('hackathon.locationOnline')
              : hackathon.location_type === 'offline'
              ? t('hackathon.locationOffline')
              : t('hackathon.locationHybrid')}
          </Descriptions.Item>
          {hackathon.location_detail && (
            <Descriptions.Item label={t('hackathon.address')} span={2} data-testid="hackathon-detail-location-detail">
              {hackathon.location_detail}
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('hackathon.chainActivityAddress')} span={2} data-testid="hackathon-detail-chain-address">
            {hackathon.chain_activity_address ? (
              <a
                href={getSolanaExplorerAddressUrl(hackathon.chain_activity_address)}
                target="_blank"
                rel="noopener noreferrer"
                title={hackathon.chain_activity_address}
              >
                <LinkOutlined /> {t('hackathon.viewOnChain')} (
                {hackathon.chain_activity_address.length > 16
                  ? `${hackathon.chain_activity_address.slice(0, 8)}...${hackathon.chain_activity_address.slice(-8)}`
                  : hackathon.chain_activity_address}
                )
              </a>
            ) : (
              <span className="text-secondary">{t('hackathon.chainActivityAddressNotOnChain')}</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('hackathon.chainCheckInsAddress')} span={2} data-testid="hackathon-detail-chain-checkins-address">
            {hackathon.chain_check_ins_address ? (
              <a
                href={getSolanaExplorerAddressUrl(hackathon.chain_check_ins_address)}
                target="_blank"
                rel="noopener noreferrer"
                title={hackathon.chain_check_ins_address}
              >
                <LinkOutlined /> {t('hackathon.viewOnChain')} (
                {hackathon.chain_check_ins_address.length > 16
                  ? `${hackathon.chain_check_ins_address.slice(0, 8)}...${hackathon.chain_check_ins_address.slice(-8)}`
                  : hackathon.chain_check_ins_address}
                )
              </a>
            ) : (
              <span className="text-secondary">{t('hackathon.chainCheckInsAddressNotUploaded')}</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('hackathon.chainVoteTallyAddress')} span={2} data-testid="hackathon-detail-chain-vote-tally-address">
            {hackathon.chain_vote_tally_address ? (
              <a
                href={getSolanaExplorerAddressUrl(hackathon.chain_vote_tally_address)}
                target="_blank"
                rel="noopener noreferrer"
                title={hackathon.chain_vote_tally_address}
              >
                <LinkOutlined /> {t('hackathon.viewOnChain')} (
                {hackathon.chain_vote_tally_address.length > 16
                  ? `${hackathon.chain_vote_tally_address.slice(0, 8)}...${hackathon.chain_vote_tally_address.slice(-8)}`
                  : hackathon.chain_vote_tally_address}
                )
              </a>
            ) : (
              <span className="text-secondary">{t('hackathon.chainVoteTallyAddressNotUploaded')}</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('hackathon.description')} span={2} data-testid="hackathon-detail-description">
            <div
              dangerouslySetInnerHTML={{ __html: hackathon.description }}
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '12px',
                background: '#fafafa',
                borderRadius: '8px',
              }}
              data-testid="hackathon-detail-description-content"
            />
          </Descriptions.Item>
        </Descriptions>

        {/* 活动海报二维码（仅已发布的活动显示） */}
        {hackathon.status === 'published' && (
          <>
            <Divider orientation="left" style={{ marginTop: '32px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>{t('hackathon.poster')}</span>
            </Divider>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Card style={{ display: 'inline-block', padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <strong>{t('hackathon.scanQRCode')}</strong>
                </div>
                {posterInfo?.qr_code_url && (
                  <Popover
                    content={
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <Button
                            type="link"
                            onClick={() => {
                              const posterUrl = posterInfo.poster_url || `/posters/${id}`
                              window.open(`http://localhost:3001${posterUrl}`, '_blank')
                            }}
                          >
                            {t('hackathon.viewPoster')}
                          </Button>
                        </div>
                        <Button size="small" onClick={handleDownloadQRCode}>
                          {t('hackathon.downloadQRCode')}
                        </Button>
                      </div>
                    }
                    title={t('hackathon.posterInfo')}
                  >
                    <Image
                      src={posterInfo.qr_code_url}
                      alt={t('hackathon.qrCode')}
                      width={200}
                      style={{ cursor: 'pointer' }}
                    />
                  </Popover>
                )}
                <div style={{ marginTop: '16px', color: '#666', fontSize: '12px' }}>
                  {t('hackathon.posterLink')}:
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const posterUrl = posterInfo?.poster_url || `/posters/${id}`
                      window.open(`http://localhost:3001${posterUrl}`, '_blank')
                    }}
                    style={{ padding: 0, height: 'auto' }}
                  >
                    {posterInfo?.poster_url || `/posters/${id}`}
                  </Button>
                </div>
              </Card>
            </div>
          </>
        )}

        {/* 统计信息 */}
        <Divider orientation="left" style={{ marginTop: '32px' }} data-testid="hackathon-detail-stats-divider">
          <span style={{ fontSize: '16px', fontWeight: 600 }}>{t('hackathon.stats')}</span>
        </Divider>
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }} data-testid="hackathon-detail-stats">
          <Col xs={12} sm={8} lg={6}>
            <StatCard
              title={t('hackathon.registrationCount')}
              value={stats?.registration_count || 0}
              prefix={<UserOutlined />}
              hoverable
              onClick={() => handleOpenDetail('registrations')}
              testId="hackathon-detail-stat-registration"
              />
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <StatCard
              title={t('hackathon.checkinCount')}
              value={stats?.checkin_count || 0}
              prefix={<UserOutlined />}
              hoverable
              onClick={() => handleOpenDetail('checkins')}
              testId="hackathon-detail-stat-checkin"
              />
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <StatCard
              title={t('hackathon.teamCount')}
              value={stats?.team_count || 0}
              prefix={<TeamOutlined />}
              hoverable
              onClick={() => handleOpenDetail('teams')}
              testId="hackathon-detail-stat-team"
              />
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <StatCard
              title={t('hackathon.submissionCount')}
              value={stats?.submission_count || 0}
              prefix={<FileTextOutlined />}
              hoverable
              onClick={() => handleOpenDetail('submissions')}
              testId="hackathon-detail-stat-submission"
              />
          </Col>
        </Row>

        {/* 阶段时间轴 */}
        {stages.length > 0 && (
          <>
            <Divider orientation="left" style={{ marginTop: '32px' }} data-testid="hackathon-detail-timeline-divider">
              <span style={{ fontSize: '16px', fontWeight: 600 }}>{t('hackathon.stageTime')}</span>
            </Divider>
            <Card style={{ marginTop: '16px' }} data-testid="hackathon-detail-timeline-card">
              <Timeline data-testid="hackathon-detail-timeline">
                {stages.map((stage) => (
                  <Timeline.Item
                    key={stage.stage}
                    color={hackathon.status === stage.stage ? 'green' : 'blue'}
                    data-testid={`hackathon-detail-timeline-item-${stage.stage}`}
                  >
                    <div>
                      <strong>{stageLabels[stage.stage] || stage.stage}</strong>
                      <div style={{ marginTop: '8px', color: '#8c8c8c' }}>
                        {dayjs(stage.start_time).format('YYYY-MM-DD HH:mm')} -{' '}
                        {dayjs(stage.end_time).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </>
        )}

        {/* 阶段切换 */}
        {nextStage && canManageStages && (
          <>
            <Divider orientation="left" style={{ marginTop: '32px' }} data-testid="hackathon-detail-stage-switch-divider">
              <span style={{ fontSize: '16px', fontWeight: 600 }}>{t('hackathon.switchStage')}</span>
            </Divider>
            <div style={{ marginTop: '16px' }} data-testid="hackathon-detail-stage-switch">
              <Space>
                <span style={{ color: '#8c8c8c' }}>{t('hackathon.currentStage')}:</span>
                <Tag color={statusInfo.color} data-testid="hackathon-detail-current-stage-tag">{statusInfo.label}</Tag>
                <ArrowRightOutlined style={{ color: '#8c8c8c' }} />
                <span style={{ color: '#8c8c8c' }}>{t('hackathon.nextStage')}:</span>
                <Tag color={statusMap[nextStage.to]?.color || 'default'} data-testid="hackathon-detail-next-stage-tag">
                  {nextStage.label}
                </Tag>
                <Button
                  type="primary"
                  loading={nextStage.to === 'published' ? publishLoading : switchStageLoading}
                  onClick={() => handleSwitchStage(nextStage.to)}
                  disabled={!hasStageTimes || (nextStage.to === 'published' ? publishLoading : switchStageLoading)}
                  style={{ marginLeft: '16px' }}
                  data-testid="hackathon-detail-switch-stage-button"
                  aria-label={`${t('hackathon.switchTo')} ${nextStage.label}`}
                  title={!hasStageTimes ? t('hackathon.stages') : ''}
                >
                  {t('hackathon.switchTo')} {nextStage.label}
                </Button>
              </Space>
            </div>
          </>
        )}
      </Card>

      {/* 统计详情弹窗 */}
      <Modal
        title={getDetailTitle()}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setDetailData([])
          setDetailKeyword('')
        }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <Input.Search
            className="search-input"
            placeholder={t('common.search')}
            value={detailKeyword}
            onChange={(e) => setDetailKeyword(e.target.value)}
            onSearch={handleDetailSearch}
          />
        </div>
        <Table
          columns={getDetailColumns()}
          dataSource={detailData}
          loading={detailLoading}
          rowKey={(record, index) => `${detailType}-${index}`}
          pagination={{
            current: detailPagination.current,
            pageSize: detailPagination.pageSize,
            total: detailPagination.total,
            showSizeChanger: true,
            showTotal: (total) => t('hackathon.totalRecords', { total }),
            onChange: (page, pageSize) => {
              fetchStatsDetail(detailType, page, pageSize, detailKeyword)
            },
            onShowSizeChange: (current, size) => {
              fetchStatsDetail(detailType, 1, size, detailKeyword)
            },
          }}
        />
      </Modal>
    </div>
  )
}

