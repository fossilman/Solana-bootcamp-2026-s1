import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Space, message, Tag, Empty, Spin } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import request from '../api/request'
import HackathonCard from '../components/HackathonCard'

interface Hackathon {
  id: number
  name: string
  description: string
  status: string
  start_time: string
  end_time: string
}

export default function MyHackathons() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token, walletAddress } = useAuthStore()
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      message.error(t('myHackathons.notLoggedIn'))
      navigate('/')
      return
    }
    fetchHackathons()
  }, [token, navigate, t])

  const fetchHackathons = async () => {
    setLoading(true)
    try {
      const data = await request.get('/my-hackathons', {
        params: { page: 1, page_size: 100 },
      })
      setHackathons(data.list || [])
    } catch (error) {
      message.error(t('myHackathons.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  const statusMap: Record<string, string> = {
    published: t('hackathon.statusPublished'),
    registration: t('hackathon.statusRegistration'),
    checkin: t('hackathon.statusCheckin'),
    team_formation: t('hackathon.statusTeamFormation'),
    submission: t('hackathon.statusSubmission'),
    voting: t('hackathon.statusVoting'),
    results: t('hackathon.statusResults'),
  }

  // 活动状态配色（与 Admin 系统保持一致）
  const statusColorMap: Record<string, string> = {
    preparation: 'default',
    published: 'blue',
    registration: 'cyan',
    checkin: 'orange',
    team_formation: 'purple',
    submission: 'geekblue',
    voting: 'magenta',
    results: 'green',
  }

  if (!token) {
    return null
  }

  return (
    <div className="page-content" data-testid="my-hackathons-page">
      <div className="page-header" data-testid="my-hackathons-header">
        <h1 className="page-title" data-testid="my-hackathons-title" style={{ fontSize: '28px' }}>
          <TrophyOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
          {t('myHackathons.title')}
        </h1>
      </div>

      <Spin spinning={loading}>
        {hackathons.length === 0 ? (
          <div className="page-container">
            <Empty
              description={t('myHackathons.noHackathons')}
              data-testid="my-hackathons-empty"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button 
                type="primary" 
                onClick={() => navigate('/')}
                data-testid="my-hackathons-empty-browse-button"
                aria-label={t('myHackathons.browseHackathons')}
              >
                {t('myHackathons.browseHackathons')}
              </Button>
            </Empty>
          </div>
        ) : (
          <div 
            className="grid-container"
            data-testid="my-hackathons-list"
          >
            {hackathons.map((hackathon) => (
              <HackathonCard
                key={hackathon.id}
                hackathon={hackathon}
                statusMap={statusMap}
                statusColorMap={statusColorMap}
                testIdPrefix="my-hackathons"
                showDateIcon={true}
              />
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}

