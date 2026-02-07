import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { useTranslation } from 'react-i18next'
import './i18n'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import HackathonList from './pages/HackathonList'
import HackathonDetail from './pages/HackathonDetail'
import HackathonCreate from './pages/HackathonCreate'
import HackathonStages from './pages/HackathonStages'
import Profile from './pages/Profile'
import SponsorApply from './pages/SponsorApply'
import SponsorReview from './pages/SponsorReview'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/ProtectedRoute'

// 首页重定向组件
function IndexRedirect() {
  return <Navigate to="/dashboard" replace />
}

function App() {
  const { token } = useAuthStore()
  const { i18n } = useTranslation()

  // 根据i18n语言设置Ant Design语言
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN

  return (
    <ConfigProvider locale={antdLocale}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* 赞助商申请页面 - 无需登录 */}
        <Route path="/sponsor/apply" element={<SponsorApply />} />
        <Route
          path="/"
          element={token ? <Layout /> : <Navigate to="/login" />}
        >
          <Route
            index
            element={<IndexRedirect />}
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'organizer', 'sponsor']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="hackathons"
            element={
              <ProtectedRoute allowedRoles={['admin', 'organizer']}>
                <HackathonList />
              </ProtectedRoute>
            }
          />
          <Route
            path="hackathons/create"
            element={
              <ProtectedRoute allowedRoles={['organizer']}>
                <HackathonCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="hackathons/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'organizer']}>
                <HackathonDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="hackathons/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['organizer']}>
                <HackathonCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="hackathons/:id/stages"
            element={
              <ProtectedRoute allowedRoles={['organizer']}>
                <HackathonStages />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute allowedRoles={['admin', 'organizer', 'sponsor']}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="sponsors/pending"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SponsorReview />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </ConfigProvider>
  )
}

export default App

