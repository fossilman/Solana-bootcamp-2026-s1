import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, List, Space, message, Modal, Input } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'

export default function TeamList() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [userTeam, setUserTeam] = useState<any>(null)

  useEffect(() => {
    if (id) {
      fetchTeams()
      fetchUserTeam()
    }
  }, [id])

  const fetchTeams = async () => {
    try {
      const data = await request.get(`/hackathons/${id}/teams`)
      // 处理分页响应：data 可能是 { list: [...], pagination: {...} } 或直接是数组
      if (data && data.list) {
        setTeams(data.list || [])
      } else if (Array.isArray(data)) {
        setTeams(data)
      } else {
        setTeams([])
      }
    } catch (error) {
      console.error('获取队伍列表失败:', error)
      message.error(t('team.fetchFailed'))
      setTeams([])
    }
  }

  const fetchUserTeam = async () => {
    try {
      const data = await request.get(`/hackathons/${id}/teams/my-team`)
      setUserTeam(data)
    } catch (error) {
      // 用户不在任何队伍中，忽略错误
      setUserTeam(null)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      message.error(t('team.teamNameRequired'))
      return
    }
    try {
      await request.post(`/hackathons/${id}/teams`, {
        name: teamName.trim(),
        max_size: 3,
      })
      message.success(t('team.createSuccess'))
      setModalVisible(false)
      setTeamName('')
      // 刷新列表和用户队伍信息
      await Promise.all([fetchTeams(), fetchUserTeam()])
    } catch (error: any) {
      console.error('创建队伍失败:', error)
      const errorMessage = error?.response?.data?.message || error?.message || t('team.createFailed')
      message.error(errorMessage)
      // 即使创建失败，也刷新列表（可能数据库已插入成功）
      fetchTeams()
      fetchUserTeam()
    }
  }

  const handleJoinTeam = async (teamId: number) => {
    try {
      await request.post(`/teams/${teamId}/join`)
      message.success(t('team.joinSuccess'))
      fetchTeams()
      fetchUserTeam()
    } catch (error: any) {
      message.error(error.message || t('team.joinFailed'))
    }
  }

  const handleViewTeam = (teamId: number) => {
    navigate(`/hackathons/${id}/teams/${teamId}`)
  }

  const isInTeam = userTeam !== null

  return (
    <div className="page-content" data-testid="team-list-page">
      <div className="page-container" data-testid="team-list-container">
        <div className="page-header" data-testid="team-list-header">
          <h2 className="page-title" data-testid="team-list-title">{t('team.title')}</h2>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setModalVisible(true)}
            disabled={isInTeam}
            data-testid="team-list-create-button"
            aria-label={t('team.createTeam')}
          >
            {t('team.createTeam')}
          </Button>
        </div>
        <Card data-testid="team-list-card">
        <List
          dataSource={teams}
          data-testid="team-list"
          renderItem={(team) => (
            <List.Item data-testid={`team-list-item-${team.id}`}>
              <List.Item.Meta
                title={
                  <span 
                    style={{ cursor: 'pointer', color: '#1890ff' }}
                    onClick={() => handleViewTeam(team.id)}
                    data-testid={`team-list-item-${team.id}-name`}
                  >
                    {team.name}
                  </span>
                }
                description={
                  <span data-testid={`team-list-item-${team.id}-members`}>
                    {t('team.memberCount')}: {team.members?.length || 0}/{team.max_size}
                  </span>
                }
              />
              <Space>
                <Button 
                  onClick={() => handleViewTeam(team.id)}
                  data-testid={`team-list-view-button-${team.id}`}
                  aria-label={`${t('team.view')}: ${team.name}`}
                >
                  {t('team.view')}
                </Button>
                <Button 
                  onClick={() => handleJoinTeam(team.id)}
                  disabled={isInTeam}
                  data-testid={`team-list-join-button-${team.id}`}
                  aria-label={`${t('team.join')}: ${team.name}`}
                >
                  {t('team.join')}
                </Button>
              </Space>
            </List.Item>
          )}
        />
        </Card>

        <Modal
        title={t('team.createTeam')}
        open={modalVisible}
        onOk={handleCreateTeam}
        onCancel={() => setModalVisible(false)}
        data-testid="team-list-create-modal"
        aria-label={t('team.createTeam')}
      >
        <Input
          placeholder={t('team.teamNamePlaceholder')}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          data-testid="team-list-create-modal-name-input"
          aria-label={t('team.teamName')}
        />
        </Modal>
      </div>
    </div>
  )
}

