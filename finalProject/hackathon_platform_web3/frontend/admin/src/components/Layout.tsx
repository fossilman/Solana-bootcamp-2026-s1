import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import type { MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import LanguageSwitcher from './LanguageSwitcher'
import {
  UserOutlined,
  TrophyOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'

const { Header, Content, Sider } = AntLayout

export default function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const menuItems: MenuProps['items'] = []

  // 根据角色显示不同的菜单
  if (user?.role === 'admin') {
    // Admin角色：活动概览、人员管理、赞助商审核
    menuItems.push({
      key: '/dashboard',
      icon: <TrophyOutlined />,
      label: t('nav.dashboard'),
      'data-testid': 'admin-menu-dashboard',
    })
    menuItems.push({
      key: '/users',
      icon: <UserOutlined />,
      label: t('nav.userManagement'),
      'data-testid': 'admin-menu-users',
    })
    menuItems.push({
      key: '/sponsors/pending',
      icon: <SettingOutlined />,
      label: t('nav.sponsorReview'),
      'data-testid': 'admin-menu-sponsors',
    })
  } else if (user?.role === 'organizer') {
    // 主办方角色：活动概览、活动管理
    menuItems.push({
      key: '/dashboard',
      icon: <TrophyOutlined />,
      label: t('nav.dashboard'),
      'data-testid': 'admin-menu-dashboard',
    })
    menuItems.push({
      key: '/hackathons',
      icon: <TrophyOutlined />,
      label: t('nav.hackathonManagement'),
      'data-testid': 'admin-menu-hackathons',
    })
  } else if (user?.role === 'sponsor') {
    // 赞助商角色：活动概览
    menuItems.push({
      key: '/dashboard',
      icon: <TrophyOutlined />,
      label: t('nav.dashboard'),
      'data-testid': 'admin-menu-dashboard',
    })
  }

  // 所有角色都有个人中心菜单
  menuItems.push({
    key: '/profile',
    icon: <UserOutlined />,
    label: t('nav.profile'),
    'data-testid': 'admin-menu-profile',
  })

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('nav.logout'),
      danger: true,
      onClick: handleLogout,
      'data-testid': 'admin-menu-logout',
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }} data-testid="admin-layout">
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
        data-testid="admin-header"
      >
        <div
          style={{
            color: 'var(--text-inverse)',
            fontSize: '20px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
          data-testid="admin-header-title"
        >
          <TrophyOutlined style={{ fontSize: '24px' }} />
          <span>Hackathon Admin Platform</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }} data-testid="admin-header-actions">
          <LanguageSwitcher />
          <span style={{ fontSize: '14px', opacity: 0.95, fontWeight: 500 }} data-testid="admin-user-name">{user?.name}</span>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button
              type="text"
              icon={<LogoutOutlined />}
              style={{ 
                color: 'var(--text-inverse)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
              }}
              data-testid="admin-user-menu-button"
              aria-label={t('nav.userMenu')}
            >
              {t('nav.logout')}
            </Button>
          </Dropdown>
        </div>
      </Header>
      <AntLayout>
        <Sider
          width={240}
          style={{
            background: 'var(--bg-primary)',
            boxShadow: 'var(--shadow-sm)',
            borderRight: '1px solid var(--border-light)',
          }}
          data-testid="admin-sider"
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              height: '100%',
              borderRight: 0,
              paddingTop: 'var(--spacing-lg)',
              background: 'transparent',
            }}
            data-testid="admin-sidebar-menu"
          />
        </Sider>
        <Content
          style={{
            padding: 'var(--spacing-2xl)',
            background: 'var(--bg-tertiary)',
            minHeight: 'calc(100vh - 64px)',
          }}
          data-testid="admin-content"
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

