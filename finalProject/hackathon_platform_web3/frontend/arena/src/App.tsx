import { Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { useTranslation } from 'react-i18next'
import './i18n'
import Home from './pages/Home'
import HackathonDetail from './pages/HackathonDetail'
import TeamList from './pages/TeamList'
import TeamDetail from './pages/TeamDetail'
import SubmissionForm from './pages/SubmissionForm'
import SubmissionList from './pages/SubmissionList'
import Results from './pages/Results'
import MyHackathons from './pages/MyHackathons'
import Profile from './pages/Profile'
import Archive from './pages/Archive'
import Poster from './pages/Poster'
import Layout from './components/Layout'

function App() {
  const { i18n } = useTranslation()

  // 根据i18n语言设置Ant Design语言
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN

  return (
    <ConfigProvider locale={antdLocale}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="my-hackathons" element={<MyHackathons />} />
          <Route path="profile" element={<Profile />} />
          <Route path="hackathons/archive" element={<Archive />} />
          <Route path="hackathons/archive/:id" element={<Archive />} />
          <Route path="hackathons/:id" element={<HackathonDetail />} />
          <Route path="hackathons/:id/teams" element={<TeamList />} />
          <Route path="hackathons/:id/teams/:teamId" element={<TeamDetail />} />
          <Route path="hackathons/:id/submit" element={<SubmissionForm />} />
          <Route path="hackathons/:id/submissions" element={<SubmissionList />} />
          <Route path="hackathons/:id/results" element={<Results />} />
        </Route>
        <Route path="/posters/:id" element={<Poster />} />
      </Routes>
    </ConfigProvider>
  )
}

export default App

