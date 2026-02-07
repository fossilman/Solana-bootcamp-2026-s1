import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Space,
  Divider,
  Modal,
  Table,
  Popconfirm,
} from 'antd'
import { UserOutlined, LockOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import { useAuthStore } from '../store/authStore'

interface Wallet {
  id: number
  address: string
  wallet_type?: string
  created_at: string
}

export default function Profile() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const { user, setAuth } = useAuthStore()

  useEffect(() => {
    fetchProfile()
    fetchWallets()
  }, [])

  const fetchProfile = async () => {
    try {
      const data = await request.get('/profile')
      form.setFieldsValue(data)
    } catch (error) {
      message.error(t('profile.fetchFailed'))
    }
  }

  const fetchWallets = async () => {
    try {
      const data = await request.get('/profile/wallets')
      setWallets(data || [])
    } catch (error) {
      message.error(t('profile.fetchWalletsFailed'))
    }
  }

  const handleDeleteWallet = async (id: number) => {
    try {
      await request.delete(`/profile/wallets/${id}`)
      message.success(t('profile.deleteWalletSuccess'))
      fetchWallets()
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('profile.deleteWalletFailed'))
    }
  }

  const handleUpdateProfile = async (values: any) => {
    setLoading(true)
    try {
      // 过滤掉 role 字段，不允许修改角色
      const { role, ...updateData } = values
      await request.patch('/profile', updateData)
      message.success(t('profile.updateSuccess'))
      // 更新store中的用户信息
      const token = useAuthStore.getState().token
      if (user && token) {
        const updatedUser = { ...user, ...updateData }
        setAuth(token, updatedUser)
      }
      fetchProfile()
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('profile.updateFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    setLoading(true)
    try {
      // 只发送 old_password 和 new_password，不发送 confirm_password
      await request.post('/profile/change-password', {
        old_password: values.old_password,
        new_password: values.new_password,
      })
      message.success(t('profile.changePasswordSuccess'))
      setPasswordModalVisible(false)
      passwordForm.resetFields()
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('profile.changePasswordFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container" data-testid="profile-page">
      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }} data-testid="profile-title">
            <UserOutlined /> {t('profile.title')}
          </div>
        }
        data-testid="profile-card"
      >
        <Form
          form={form}
          onFinish={handleUpdateProfile}
          layout="vertical"
          size="large"
          data-testid="profile-form"
        >
          <Form.Item
            name="name"
            label={t('profile.name')}
            rules={[{ required: true, message: t('profile.nameRequired') }]}
          >
            <Input 
              placeholder={t('profile.namePlaceholder')} 
              data-testid="profile-form-name-input"
              aria-label={t('profile.name')}
            />
          </Form.Item>


          <Form.Item
            name="phone"
            label={t('profile.phone')}
            rules={[
              { pattern: /^1[3-9]\d{9}$/, message: t('profile.phoneInvalid') },
            ]}
          >
            <Input 
              placeholder={t('profile.phonePlaceholder')} 
              data-testid="profile-form-phone-input"
              aria-label={t('profile.phone')}
            />
          </Form.Item>

          <Form.Item
            name="role"
            label={t('profile.role')}
          >
            <Input 
              placeholder={t('profile.role')} 
              disabled
              data-testid="profile-form-role-input"
              aria-label={t('profile.role')}
            />
          </Form.Item>

          <Form.Item>
            <Space data-testid="profile-form-actions">
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                data-testid="profile-form-submit-button"
                aria-label={t('profile.save')}
              >
                {t('profile.save')}
              </Button>
              <Button
                icon={<LockOutlined />}
                onClick={() => setPasswordModalVisible(true)}
                data-testid="profile-form-change-password-button"
                aria-label={t('profile.changePassword')}
              >
                {t('profile.changePassword')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }} data-testid="profile-wallets-title">
            {t('profile.walletManagement')}
          </div>
        }
        style={{ marginTop: '24px' }}
        data-testid="profile-wallets-card"
      >
        <Table
          dataSource={wallets}
          rowKey="id"
          columns={[
            {
              title: t('profile.walletAddress'),
              dataIndex: 'address',
              key: 'address',
              ellipsis: true,
            },
            {
              title: t('profile.walletType'),
              dataIndex: 'wallet_type',
              key: 'wallet_type',
              width: 120,
              render: (type: string) => type === 'phantom' ? t('login.walletPhantom') : t('login.walletMetaMask'),
            },
            {
              title: t('profile.bindTime'),
              dataIndex: 'created_at',
              key: 'created_at',
              width: 180,
              render: (time: string) => new Date(time).toLocaleString('zh-CN'),
            },
            {
              title: t('profile.actions'),
              key: 'action',
              width: 100,
              render: (_: any, record: Wallet) => (
                <Popconfirm
                  title={t('profile.confirmDeleteWallet')}
                  onConfirm={() => handleDeleteWallet(record.id)}
                  okText={t('confirm')}
                  cancelText={t('cancel')}
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    data-testid={`profile-wallets-delete-button-${record.id}`}
                  >
                    {t('profile.delete')}
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
          pagination={false}
          data-testid="profile-wallets-table"
        />
      </Card>

      <Modal
        title={t('profile.changePassword')}
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false)
          passwordForm.resetFields()
        }}
        onOk={async () => {
          try {
            await passwordForm.validateFields()
            passwordForm.submit()
          } catch (error) {
            // 表单验证失败，不关闭对话框
          }
        }}
        okText={t('confirm')}
        cancelText={t('cancel')}
        width={500}
        destroyOnClose
        data-testid="profile-change-password-modal"
        aria-label={t('profile.changePassword')}
      >
        <Form
          form={passwordForm}
          onFinish={handleChangePassword}
          layout="vertical"
          size="large"
          data-testid="profile-change-password-form"
        >
          <Form.Item
            name="old_password"
            label={t('profile.oldPassword')}
            rules={[{ required: true, message: t('profile.oldPasswordRequired') }]}
          >
            <Input.Password 
              placeholder={t('profile.oldPasswordPlaceholder')} 
              data-testid="profile-change-password-form-old-password-input"
              aria-label={t('profile.oldPassword')}
            />
          </Form.Item>

          <Form.Item
            name="new_password"
            label={t('profile.newPassword')}
            rules={[
              { required: true, message: t('profile.newPasswordRequired') },
              { min: 8, message: t('user.passwordMin') },
            ]}
          >
            <Input.Password 
              placeholder={t('profile.newPasswordPlaceholder')} 
              data-testid="profile-change-password-form-new-password-input"
              aria-label={t('profile.newPassword')}
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label={t('profile.confirmPassword')}
            dependencies={['new_password']}
            rules={[
              { required: true, message: t('profile.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error(t('profile.passwordMismatch')))
                },
              }),
            ]}
          >
            <Input.Password 
              placeholder={t('profile.confirmPasswordPlaceholder')} 
              data-testid="profile-change-password-form-confirm-password-input"
              aria-label={t('profile.confirmPassword')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

