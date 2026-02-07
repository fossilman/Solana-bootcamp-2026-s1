import { useState, useEffect, useRef } from 'react'
import { Table, Button, Select, Space, message, Card, Tag, Input } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PlusOutlined, EyeOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/authStore'
import { getSolanaExplorerAddressUrl } from '../config/solana'

interface Hackathon {
  id: number
  name: string
  status: string
  start_time: string
  end_time: string
  created_at: string
  organizer_id?: number
  chain_activity_address?: string | null
}

export default function HackathonList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

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
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
    total: 0,
  })
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  
  const isOrganizer = user?.role === 'organizer'

  const fetchHackathons = async (page = 1, pageSize = 100) => {
    setLoading(true)
    try {
      const response = await request.get('/hackathons', {
        params: { page, page_size: pageSize, status, keyword: keyword || undefined },
      })
      const data = response as any
      setHackathons(data.list || [])
      setPagination({
        current: page,
        pageSize: pageSize,
        total: data.pagination?.total || data.total || 0,
      })
    } catch (error) {
      message.error(t('hackathon.fetchListFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 防抖搜索
  const handleSearchChange = (value: string) => {
    setKeyword(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchHackathons(1, pagination.pageSize)
    }, 500)
  }

  // 当搜索框清空时，立即触发搜索
  const handleSearchClear = () => {
    setKeyword('')
    fetchHackathons(1, pagination.pageSize)
  }

  useEffect(() => {
    // 当筛选改变时，重置到第一页
    fetchHackathons(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: t('hackathon.name'),
      dataIndex: 'name',
      key: 'name',
      width: 250,
      ellipsis: true,
    },
    {
      title: t('hackathon.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const statusInfo = statusMap[status] || { label: status, color: 'default' }
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      },
    },
    {
      title: t('hackathon.startTime'),
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('hackathon.endTime'),
      dataIndex: 'end_time',
      key: 'end_time',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('hackathon.chainActivityAddress'),
      dataIndex: 'chain_activity_address',
      key: 'chain_activity_address',
      width: 180,
      ellipsis: true,
      render: (addr: string | null | undefined, record: Hackathon) => {
        const address = record.chain_activity_address
        if (!address) {
          return <span className="text-secondary">{t('hackathon.chainActivityAddressNotOnChain')}</span>
        }
        const url = getSolanaExplorerAddressUrl(address)
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={address}
            data-testid={`hackathon-list-chain-link-${record.id}`}
          >
            <LinkOutlined /> {address.slice(0, 6)}...{address.slice(-4)}
          </a>
        )
      },
    },
    {
      title: t('hackathon.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Hackathon) => (
        <Space size="small" data-testid={`hackathon-list-actions-${record.id}`}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/hackathons/${record.id}`)}
            size="small"
            data-testid={`hackathon-list-view-button-${record.id}`}
            aria-label={`${t('hackathon.view')} ${record.name}`}
          >
            {t('hackathon.view')}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container" data-testid="hackathon-list-page">
      <div className="page-header">
        <div>
          <h2 className="page-title" data-testid="hackathon-list-title">{t('hackathon.list')}</h2>
          <Space style={{ marginTop: 'var(--spacing-md)' }} size="middle" data-testid="hackathon-list-filters" className="search-input-wrapper">
            <Input
              className="search-input"
              placeholder={t('hackathon.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => handleSearchChange(e.target.value)}
              onClear={handleSearchClear}
              allowClear
              data-testid="hackathon-list-search-input"
              aria-label={t('hackathon.searchPlaceholder')}
            />
            <Select
              placeholder={t('hackathon.filterStatus')}
              allowClear
              style={{ width: 200 }}
              value={status}
              onChange={setStatus}
              data-testid="hackathon-list-status-filter"
              aria-label={t('hackathon.filterStatus')}
            >
              {Object.entries(statusMap).map(([key, value]) => (
                <Select.Option key={key} value={key} data-testid={`hackathon-list-status-option-${key}`}>
                  {value.label}
                </Select.Option>
              ))}
            </Select>
          </Space>
        </div>
        {isOrganizer && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/hackathons/create')}
            size="large"
            data-testid="hackathon-list-create-button"
            aria-label={t('hackathon.createButton')}
          >
            {t('hackathon.createButton')}
          </Button>
        )}
      </div>
      <Card data-testid="hackathon-list-table-card" style={{ marginTop: 'var(--spacing-xl)' }}>
        <Table
          columns={columns}
          dataSource={hackathons}
          loading={loading}
          rowKey="id"
          scroll={{ x: 820 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => t('hackathon.totalRecords', { total }),
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              fetchHackathons(page, pageSize)
            },
            onShowSizeChange: (current, size) => {
              fetchHackathons(1, size)
            },
          }}
          data-testid="hackathon-list-table"
        />
      </Card>
    </div>
  )
}

