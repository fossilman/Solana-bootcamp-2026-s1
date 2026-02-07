import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Space, message } from 'antd'
import { UserOutlined, WalletOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import request from '../api/request'

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { walletAddress, participant, setParticipant } = useAuthStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!walletAddress) {
      message.error(t('profile.notLoggedIn'))
      navigate('/')
      return
    }
    fetchProfile()
  }, [walletAddress, navigate, t])

  const fetchProfile = async () => {
    try {
      setFetching(true)
      const data = await request.get('/profile')
      form.setFieldsValue({
        nickname: data.nickname || '',
      })
      setParticipant(data)
    } catch (error) {
      message.error(t('profile.fetchFailed'))
    } finally {
      setFetching(false)
    }
  }

  const handleUpdate = async (values: any) => {
    setLoading(true)
    try {
      await request.patch('/profile', values)
      message.success(t('profile.updateSuccess'))
      const updatedParticipant = { ...participant, ...values } as any
      setParticipant(updatedParticipant)
    } catch (error: any) {
      message.error(error.message || t('profile.updateFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!walletAddress) {
    return null
  }

  return (
    <div className="page-content" data-testid="profile-page">
      <div className="page-container" style={{ maxWidth: '800px' }} data-testid="profile-container">
        <div className="page-header" data-testid="profile-header">
          <h1 className="page-title" data-testid="profile-title">
            <UserOutlined style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
            {t('profile.title')}
          </h1>
        </div>

        <Card data-testid="profile-info-card" loading={fetching}>
        <Form 
          form={form} 
          onFinish={handleUpdate} 
          layout="vertical" 
          data-testid="profile-form"
        >
          <Form.Item
            name="nickname"
            label={t('profile.nickname')}
            rules={[{ max: 50, message: t('profile.nicknameMaxLength') }]}
            data-testid="profile-nickname-item"
          >
            <Input 
              placeholder={t('profile.nicknamePlaceholder')}
              prefix={<UserOutlined />}
              data-testid="profile-nickname-input"
              aria-label={t('profile.nickname')}
            />
          </Form.Item>

          <Form.Item label={t('profile.walletAddress')} data-testid="profile-address-item">
            <Input 
              value={walletAddress}
              disabled
              prefix={<WalletOutlined />}
              data-testid="profile-address-input"
              aria-label={t('profile.walletAddress')}
            />
          </Form.Item>

          <Form.Item data-testid="profile-actions">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              data-testid="profile-update-button"
              aria-label={t('profile.update')}
            >
              {t('profile.update')}
            </Button>
          </Form.Item>
        </Form>
        </Card>
      </div>
    </div>
  )
}

