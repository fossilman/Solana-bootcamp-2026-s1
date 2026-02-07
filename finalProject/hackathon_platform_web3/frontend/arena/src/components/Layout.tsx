import { Outlet, useNavigate } from 'react-router-dom'
import { Layout as AntLayout, Button, Space, Avatar, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { TrophyOutlined, WalletOutlined, LogoutOutlined, UserOutlined, AppstoreOutlined, HistoryOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/authStore'
import { getUserDisplayName } from '../utils/userDisplay'
import LanguageSwitcher from './LanguageSwitcher'
import { message, Modal } from 'antd'
import request from '../api/request'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import {
  getAvailableWalletOptions,
  connectWithProvider,
  connectWithPhantomSolana,
  type WalletOption,
} from '../utils/wallet'

const { Header, Content } = AntLayout

export default function Layout() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { walletAddress, token, participant, connectWallet, setParticipant, clearAuth } = useAuthStore()
  const [sponsors, setSponsors] = useState<any[]>([])

  // 获取长期赞助商
  useEffect(() => {
    const fetchLongTermSponsors = async () => {
      try {
        const data = await request.get('/sponsors/long-term')
        setSponsors(data || [])
      } catch (error) {
        // 忽略错误
      }
    }
    fetchLongTermSponsors()
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

  const handleLogout = () => {
    clearAuth()
    message.success(t('common.disconnected'))
    navigate('/')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('nav.logout'),
      danger: true,
      onClick: handleLogout,
      'data-testid': 'arena-menu-logout',
    },
  ]

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }} data-testid="arena-layout">
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--gradient-primary)',
          color: 'var(--text-inverse)',
          padding: '0 var(--spacing-xl)',
          boxShadow: 'var(--shadow-md)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: '64px',
        }}
        data-testid="arena-header"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            cursor: 'pointer',
            transition: 'opacity var(--transition-fast)',
          }}
          onClick={() => navigate('/')}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          data-testid="arena-header-title"
        >
          <TrophyOutlined style={{ fontSize: '24px' }} />
          <span
            style={{
              color: 'var(--text-inverse)',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            Hackathon Arena Platform
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }} data-testid="arena-header-actions">
          <LanguageSwitcher />
          {walletAddress ? (
            <Space size="middle">
              {/* 菜单顺序：我的活动，活动集锦，个人中心 */}
              <Button
                type="text"
                icon={<AppstoreOutlined />}
                style={{ 
                  color: 'var(--text-inverse)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-md)',
                }}
                onClick={() => navigate('/my-hackathons')}
                data-testid="nav-my-hackathons"
                aria-label={t('nav.myHackathons')}
              >
                {t('nav.myHackathons')}
              </Button>
              <Button
                type="text"
                icon={<HistoryOutlined />}
                style={{ 
                  color: 'var(--text-inverse)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-md)',
                }}
                onClick={() => navigate('/hackathons/archive')}
                data-testid="nav-archive"
                aria-label={t('nav.archive')}
              >
                {t('nav.archive')}
              </Button>
              {/* 合并个人中心和用户名显示 */}
              <Button
                type="text"
                style={{ 
                  color: 'var(--text-inverse)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--spacing-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-md)',
                }}
                onClick={() => navigate('/profile')}
                data-testid="nav-profile"
                aria-label={t('nav.profile')}
              >
                <Avatar
                  size="small"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'var(--text-inverse)',
                  }}
                  icon={<UserOutlined />}
                  data-testid="arena-user-avatar"
                />
                <span>{getUserDisplayName(participant, walletAddress)}</span>
              </Button>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  style={{ 
                    color: 'var(--text-inverse)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  data-testid="arena-user-menu-button"
                  aria-label={t('nav.userMenu')}
                >
                  {t('nav.logout')}
                </Button>
              </Dropdown>
            </Space>
          ) : (
            <Button
              type="primary"
              icon={<WalletOutlined />}
              onClick={handleConnectWallet}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'var(--text-inverse)',
                backdropFilter: 'blur(10px)',
              }}
              data-testid="arena-connect-button"
              aria-label={t('common.connectWallet')}
            >
              {t('common.connectWallet')}
            </Button>
          )}
        </div>
      </Header>
      <Content
        style={{
          background: 'var(--bg-tertiary)',
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-testid="arena-content"
      >
        <div style={{ flex: 1 }}>
          <Outlet />
        </div>
        
        {/* 长期赞助商展示 - 在所有页面底部，透明容器，仅显示Logo */}
        {sponsors.length > 0 && (
          <div style={{ 
            padding: 'var(--spacing-xl)', 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--spacing-2xl)',
            flexWrap: 'wrap',
            background: 'transparent',
            borderTop: '1px solid var(--border-light)',
            marginTop: 'auto',
          }}>
            {sponsors.map((sponsor) => (
              <img
                key={sponsor.id}
                src={sponsor.logo_url}
                alt={sponsor.user?.name || 'Sponsor'}
                style={{ 
                  height: '60px', 
                  maxWidth: '200px', 
                  objectFit: 'contain',
                  cursor: 'pointer',
                  opacity: 0.8,
                  transition: 'opacity var(--transition-base)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                onClick={() => {
                  // 可以添加跳转逻辑
                }}
              />
            ))}
          </div>
        )}
      </Content>

      <Modal
        title={t('common.chooseWallet')}
        open={walletModalOpen}
        onCancel={() => setWalletModalOpen(false)}
        footer={null}
        data-testid="layout-wallet-select-modal"
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
                data-testid={`layout-wallet-option-${option.type}`}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </Modal>
    </AntLayout>
  )
}

