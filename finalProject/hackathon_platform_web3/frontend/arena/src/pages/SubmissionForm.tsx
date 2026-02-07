import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Space, message, Alert, Descriptions, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import { useAuthStore } from '../store/authStore'

export default function SubmissionForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { participantId } = useAuthStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [existingSubmission, setExistingSubmission] = useState<any>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (id && participantId) {
      checkPermission()
    } else {
      setChecking(false)
    }
  }, [id, participantId])

  const checkPermission = async () => {
    try {
      setChecking(true)
      // 获取用户队伍信息
      const team = await request.get(`/hackathons/${id}/teams/my-team`)
      setUserTeam(team)

      // 检查是否已有提交
      try {
        const submissions = await request.get(`/hackathons/${id}/submissions`)
        const submissionList = Array.isArray(submissions) ? submissions : (submissions.list || [])
        const teamSubmission = submissionList.find((s: any) => s.team_id === team?.id)
        if (teamSubmission) {
          setExistingSubmission(teamSubmission)
          // 如果已有提交，填充表单
          form.setFieldsValue({
            name: teamSubmission.name,
            description: teamSubmission.description,
            link: teamSubmission.link,
          })
        }
      } catch (error) {
        // 没有提交，忽略错误
      }
    } catch (error) {
      message.error(t('submission.fetchTeamFailed'))
    } finally {
      setChecking(false)
    }
  }

  const isLeader = userTeam?.leader_id === participantId || 
                   userTeam?.members?.some((m: any) => m.participant_id === participantId && m.role === 'leader')
  const canSubmit = isLeader && !existingSubmission // 只有队长可以初次提交

  const handleSubmit = async (values: any) => {
    if (!canSubmit && !existingSubmission) {
      message.error(t('submission.leaderOnly'))
      return
    }

    setLoading(true)
    try {
      if (existingSubmission) {
        // 更新已有提交
        await request.put(`/submissions/${existingSubmission.id}`, {
          ...values,
          draft: 0, // 0-已提交，1-草稿
        })
        message.success(t('submission.updateSuccess'))
      } else {
        // 创建新提交
        await request.post(`/hackathons/${id}/submissions`, {
          ...values,
          draft: 0, // 0-已提交，1-草稿
        })
        message.success(t('submission.submitSuccess'))
      }
      navigate(`/hackathons/${id}`)
    } catch (error: any) {
      message.error(error.message || t('submission.submitFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="page-content" data-testid="submission-form-page">
        <div className="page-container" style={{ maxWidth: '800px' }} data-testid="submission-form-container">
          <Card data-testid="submission-form-card">{t('submission.loading')}</Card>
        </div>
      </div>
    )
  }

  if (!userTeam) {
    return (
      <div className="page-content" data-testid="submission-form-page">
        <div className="page-container" style={{ maxWidth: '800px' }} data-testid="submission-form-container">
          <Card data-testid="submission-form-card">
            <Alert
              message={t('submission.noTeam')}
              description={t('submission.noTeamDescription')}
              type="warning"
              showIcon
              action={
                <Button size="small" onClick={() => navigate(`/hackathons/${id}/teams`)}>
                  {t('submission.goToTeam')}
                </Button>
              }
            />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content" data-testid="submission-form-page">
      <div className="page-container" style={{ maxWidth: '800px' }} data-testid="submission-form-container">
        <div className="page-header" data-testid="submission-form-header">
          <h2 className="page-title" data-testid="submission-form-title">
            {existingSubmission ? t('submission.modify') : t('submission.submit')}
          </h2>
        </div>
        <Card data-testid="submission-form-card">
        {!canSubmit && !existingSubmission && (
          <Alert
            message={t('submission.leaderOnly')}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {existingSubmission && (
          <Card 
            type="inner" 
            title={t('submission.currentSubmission')} 
            style={{ marginBottom: 16 }}
            data-testid="submission-form-current-submission"
          >
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('submission.submissionName')}>
                <span data-testid="submission-form-current-name">{existingSubmission.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('submission.submissionDescription')}>
                <div 
                  data-testid="submission-form-current-description"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {existingSubmission.description}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label={t('submission.submissionLink')}>
                <a 
                  href={existingSubmission.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-testid="submission-form-current-link"
                >
                  {existingSubmission.link}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label={t('submission.submitTime')}>
                <span data-testid="submission-form-current-time">
                  {new Date(existingSubmission.created_at).toLocaleString()}
                </span>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12 }}>
              <Tag color="blue" data-testid="submission-form-current-status">{t('submission.submitted')}</Tag>
              <span style={{ marginLeft: 8, color: '#666', fontSize: '12px' }}>
                {t('submission.leaderAndMembersCanModify')}
              </span>
            </div>
          </Card>
        )}
        <Form form={form} onFinish={handleSubmit} layout="vertical" data-testid="submission-form">
          <Form.Item
            name="name"
            label={t('submission.submissionName')}
            rules={[{ required: true, message: t('submission.nameRequired') }]}
            data-testid="submission-form-name-item"
          >
            <Input 
              data-testid="submission-form-name-input"
              aria-label={t('submission.submissionName')}
              placeholder={t('submission.namePlaceholder')}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('submission.submissionDescription')}
            rules={[{ required: true, message: t('submission.descriptionPlaceholder') }]}
            data-testid="submission-form-description-item"
          >
            <Input.TextArea 
              rows={6}
              data-testid="submission-form-description-input"
              aria-label={t('submission.submissionDescription')}
              placeholder={t('submission.descriptionPlaceholder')}
            />
          </Form.Item>
          <Form.Item
            name="link"
            label={t('submission.submissionLink')}
            rules={[
              { required: true, message: t('submission.linkPlaceholder') },
              { type: 'url', message: t('submission.linkPlaceholder') },
            ]}
            data-testid="submission-form-link-item"
          >
            <Input 
              placeholder={t('submission.linkPlaceholder')}
              data-testid="submission-form-link-input"
              aria-label={t('submission.submissionLink')}
            />
          </Form.Item>
          <Form.Item data-testid="submission-form-actions">
            <Space data-testid="submission-form-buttons">
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                disabled={!canSubmit && !existingSubmission}
                data-testid="submission-form-submit-button"
                aria-label={existingSubmission ? t('submission.modify') : t('submission.submit')}
              >
                {existingSubmission ? t('common.update') : t('submission.submit')}
              </Button>
              <Button 
                onClick={() => navigate(`/hackathons/${id}`)}
                data-testid="submission-form-cancel-button"
                aria-label={t('cancel')}
              >
                {t('cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
        </Card>
      </div>
    </div>
  )
}

