import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, message, Modal } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@shared/components'
import request from '../api/request'
import { useAuthStore } from '../store/authStore'
import HackathonCard from '../components/HackathonCard'
import {
  getAvailableWalletOptions,
  connectWithProvider,
  connectWithPhantomSolana,
  type WalletOption,
} from '../utils/wallet'

interface Hackathon {
  id: number
  name: string
  description: string
  status: string
  start_time: string
  end_time: string
}

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { walletAddress, connectWallet, setParticipant } = useAuthStore()
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(false)

  const fetchHackathons = async () => {
    setLoading(true)
    try {
      const data = await request.get('/hackathons', {
        params: { page: 1, page_size: 100 },
      })
      setHackathons(data.list || [])
    } catch (error) {
      message.error(t('hackathon.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHackathons()
  }, [])

  const walletOptions = getAvailableWalletOptions()
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  const doConnect = async (option: WalletOption) => {
    try {
      const res = option.type === 'phantom'
        ? await connectWithPhantomSolana(option.solana)
        : await connectWithProvider(option.provider)
      connectWallet(res.address, res.token, res.participant.id, res.participant)
      try {
        const fullParticipant = await request.get('/profile')
        setParticipant(fullParticipant)
      } catch {
        console.warn('获取完整用户信息失败，使用基本信息')
      }
      message.success(t('common.connected'))
    } catch (error: any) {
      message.error(error?.message || t('common.error'))
    }
  }

  const handleConnectWallet = async () => {
    if (walletOptions.length === 0) {
      message.error(t('common.pleaseInstallWallet'))
      return
    }
    if (walletOptions.length > 1) {
      setWalletModalOpen(true)
      return
    }
    doConnect(walletOptions[0])
  }

  const handleSelectWallet = (option: WalletOption) => {
    setWalletModalOpen(false)
    doConnect(option)
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

  return (
    <div className="page-content" data-testid="home-page">
      <PageHeader
        title={
          <>
          <TrophyOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
          {t('home.title')}
          </>
        }
        actions={
          !walletAddress ? (
          <Button 
            type="primary" 
            onClick={handleConnectWallet}
            data-testid="home-connect-button"
            aria-label={t('common.connectWallet')}
          >
            {t('common.connectWallet')}
          </Button>
          ) : undefined
        }
        testId="home-header"
      />

      <Modal
        title={t('common.chooseWallet')}
        open={walletModalOpen}
        onCancel={() => setWalletModalOpen(false)}
        footer={null}
        data-testid="home-wallet-select-modal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
          {walletOptions.map((option, index) => {
            const label = option.type === 'phantom'
              ? t('common.walletPhantomSolana')
              : t('common.walletMetaMask')
            return (
              <Button
                key={index}
                size="large"
                block
                onClick={() => handleSelectWallet(option)}
                data-testid={`home-wallet-option-${option.type}`}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </Modal>

      {loading ? (
        <div 
          style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            color: 'var(--text-secondary)',
            fontSize: '16px'
          }} 
          data-testid="home-loading"
        >
          {t('home.loading')}
        </div>
      ) : (
        <div 
          className="grid-container"
          data-testid="home-hackathon-list"
        >
          {hackathons.map((hackathon) => (
            <HackathonCard
              key={hackathon.id}
              hackathon={hackathon}
              statusMap={statusMap}
              statusColorMap={statusColorMap}
              testIdPrefix="home-hackathon"
            />
          ))}
        </div>
      )}
    </div>
  )
}

