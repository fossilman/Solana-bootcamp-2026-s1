import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, List, Space, message, Modal, Descriptions, Tag, Popconfirm } from 'antd'
import { UserOutlined, TeamOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import { useAuthStore } from '../store/authStore'
import { getUserDisplayName } from '../utils/userDisplay'

export default function TeamDetail() {
  const { t } = useTranslation()
  const { id, teamId } = useParams()
  const navigate = useNavigate()
  const { participantId } = useAuthStore()
  const [team, setTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (teamId) {
      fetchTeamDetail()
    }
  }, [teamId])

  const fetchTeamDetail = async () => {
    try {
      setLoading(true)
      const data = await request.get(`/teams/${teamId}`)
      setTeam(data)
    } catch (error) {
      message.error(t('team.fetchDetailFailed'))
      navigate(`/hackathons/${id}/teams`)
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveTeam = async () => {
    try {
      await request.post(`/teams/${teamId}/leave`)
      message.success(t('team.leaveSuccess'))
      navigate(`/hackathons/${id}/teams`)
    } catch (error: any) {
      message.error(error.message || t('team.leaveFailed'))
    }
  }

  const handleDissolveTeam = async () => {
    try {
      await request.delete(`/teams/${teamId}`)
      message.success(t('team.dissolveSuccess'))
      navigate(`/hackathons/${id}/teams`)
    } catch (error: any) {
      message.error(error.message || t('team.dissolveFailed'))
    }
  }

  if (loading) {
    return <div>{t('common.loading')}</div>
  }

  if (!team) {
    return <div>{t('team.notFound')}</div>
  }

  const isLeader = team.leader_id === participantId
  const isMember = team.members?.some((member: any) => member.participant_id === participantId)
  const hasOtherMembers = team.members?.filter((member: any) => member.participant_id !== team.leader_id).length > 0

  return (
    <div className="page-content" data-testid="team-detail-page">
      <div className="page-container" data-testid="team-detail-container">
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TeamOutlined style={{ fontSize: '24px', color: 'var(--primary-color)' }} />
              <span>{team.name}</span>
            </div>
          }
          extra={
            <Space>
              {isLeader && (
                <Popconfirm
                  title={t('team.dissolveConfirmTitle')}
                  description={hasOtherMembers ? t('team.dissolveConfirmDescriptionHasMembers') : t('team.dissolveConfirmDescription')}
                  onConfirm={handleDissolveTeam}
                  okText={t('confirm')}
                  cancelText={t('cancel')}
                  disabled={hasOtherMembers}
                >
                  <Button 
                    danger 
                    disabled={hasOtherMembers}
                    data-testid="team-detail-dissolve-button"
                  >
                    {t('team.dissolve')}
                  </Button>
                </Popconfirm>
              )}
              {isMember && !isLeader && (
                <Popconfirm
                  title={t('team.leaveConfirmTitle')}
                  description={t('team.leaveConfirmDescription')}
                  onConfirm={handleLeaveTeam}
                  okText={t('confirm')}
                  cancelText={t('cancel')}
                >
                  <Button 
                    danger
                    data-testid="team-detail-leave-button"
                  >
                    {t('team.leave')}
                  </Button>
                </Popconfirm>
              )}
              <Button onClick={() => navigate(`/hackathons/${id}/teams`)}>
                {t('team.backToList')}
              </Button>
            </Space>
          }
          data-testid="team-detail-card"
        >
          <Descriptions column={2} bordered data-testid="team-detail-info">
            <Descriptions.Item label={t('team.teamName')}>
              <span data-testid="team-detail-name">{team.name}</span>
            </Descriptions.Item>
            <Descriptions.Item label={t('team.status')}>
              <Tag color={team.status === 'recruiting' ? 'blue' : 'default'} data-testid="team-detail-status">
                {team.status === 'recruiting' ? t('team.statusRecruiting') : t('team.statusLocked')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('team.memberCount')}>
              <span data-testid="team-detail-member-count">
                {team.members?.length || 0}/{team.max_size}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label={t('team.createdAt')}>
              <span data-testid="team-detail-created-at">
                {new Date(team.created_at).toLocaleString()}
              </span>
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 16 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              {t('team.memberList')}
            </h3>
            <List
              dataSource={team.members || []}
              renderItem={(member: any) => (
                <List.Item
                  data-testid={`team-detail-member-${member.id}`}
                  actions={[
                    member.role === 'leader' && (
                      <Tag color="gold" key="leader">
                        {t('team.leader')}
                      </Tag>
                    ),
                    member.role === 'member' && (
                      <Tag key="member">{t('team.member')}</Tag>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span data-testid={`team-detail-member-name-${member.id}`}>
                        {getUserDisplayName(member.participant)}
                      </span>
                    }
                    description={
                      <span data-testid={`team-detail-member-joined-${member.id}`}>
                        {t('team.joinedAt')}: {new Date(member.joined_at).toLocaleString()}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

