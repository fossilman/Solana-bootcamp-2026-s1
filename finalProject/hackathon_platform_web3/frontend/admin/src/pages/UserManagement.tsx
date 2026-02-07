import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Popconfirm,
  Card,
  Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, UndoOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'

interface User {
  id: number
  name: string
  role: string
  phone: string
  status: number // 1-启用，0-禁用
}

export default function UserManagement() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
    total: 0,
  })

  const roleMap: Record<string, { label: string; color: string }> = {
    organizer: { label: t('user.roleOrganizer'), color: 'blue' },
    sponsor: { label: t('user.roleSponsor'), color: 'green' },
    admin: { label: t('user.roleAdmin'), color: 'red' },
  }

  const fetchUsers = async (page = 1, pageSize = 100) => {
    setLoading(true)
    try {
      const data = await request.get('/users', {
        params: { page, page_size: pageSize, include_deleted: true },
      })
      setUsers(data.list || [])
      setPagination({
        current: page,
        pageSize: pageSize,
        total: data.pagination?.total || data.total || 0,
      })
    } catch (error) {
      message.error(t('user.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    fetchUsers(pagination.current, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue(user)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/users/${id}`)
      message.success(t('user.disableSuccess'))
      fetchUsers(pagination.current, pagination.pageSize)
    } catch (error) {
      message.error(t('user.disableFailed'))
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await request.post(`/users/${id}/restore`)
      message.success(t('user.enableSuccess'))
      fetchUsers(pagination.current, pagination.pageSize)
    } catch (error) {
      message.error(t('user.enableFailed'))
    }
  }

  const handleResetPassword = (user: User) => {
    setResettingUser(user)
    passwordForm.resetFields()
    setPasswordModalVisible(true)
  }

  const handleResetPasswordSubmit = async (values: any) => {
    if (!resettingUser) return
    try {
      await request.post(`/users/${resettingUser.id}/reset-password`, {
        password: values.password,
      })
      message.success(t('user.resetPasswordSuccess'))
      setPasswordModalVisible(false)
      passwordForm.resetFields()
    } catch (error) {
      message.error(t('user.resetPasswordFailed'))
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        await request.patch(`/users/${editingUser.id}`, values)
        message.success(t('user.updateSuccess'))
      } else {
        await request.post('/users', values)
        message.success(t('user.createSuccess'))
      }
      setModalVisible(false)
      form.resetFields()
      // 刷新表格，如果是新建用户，跳转到第一页以确保能看到新用户
      if (!editingUser) {
        await fetchUsers(1, pagination.pageSize)
      } else {
        await fetchUsers(pagination.current, pagination.pageSize)
      }
    } catch (error) {
      message.error(editingUser ? t('user.updateFailed') : t('user.createFailed'))
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: t('user.name'),
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: t('user.role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => {
        const roleInfo = roleMap[role] || { label: role, color: 'default' }
        return <Tag color={roleInfo.color}>{roleInfo.label}</Tag>
      },
    },
    {
      title: t('user.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
    },
    {
      title: t('user.status'),
      key: 'status',
      width: 100,
      render: (_: any, record: User) => {
        if (record.status === 0) {
          return <Tag color="red">{t('user.disabled')}</Tag>
        }
        return <Tag color="green">{t('user.enabled')}</Tag>
      },
    },
    {
      title: t('user.actions'),
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: User) => {
        const isDisabled = record.status === 0
        return (
          <Space size="small" data-testid={`user-management-actions-${record.id}`} wrap>
            {!isDisabled && (
              <>
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                  size="small"
                  data-testid={`user-management-edit-button-${record.id}`}
                  aria-label={`${t('user.edit')} ${record.name}`}
                >
                  {t('user.edit')}
                </Button>
                <Button
                  type="link"
                  icon={<LockOutlined />}
                  onClick={() => handleResetPassword(record)}
                  size="small"
                  data-testid={`user-management-reset-password-button-${record.id}`}
                  aria-label={`${t('user.resetPassword')} ${record.name}`}
                >
                  {t('user.resetPassword')}
                </Button>
                <Popconfirm
                  title={t('user.confirmDisable')}
                  description={t('user.disableDescription')}
                  onConfirm={() => handleDelete(record.id)}
                  okText={t('confirm')}
                  cancelText={t('cancel')}
                  data-testid={`user-management-delete-confirm-${record.id}`}
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    data-testid={`user-management-delete-button-${record.id}`}
                    aria-label={`${t('user.disable')} ${record.name}`}
                  >
                    {t('user.disable')}
                  </Button>
                </Popconfirm>
              </>
            )}
            {isDisabled && (
              <Button
                type="link"
                icon={<UndoOutlined />}
                onClick={() => handleRestore(record.id)}
                size="small"
                data-testid={`user-management-restore-button-${record.id}`}
                aria-label={`${t('user.enable')} ${record.name}`}
              >
                {t('user.enable')}
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="page-container" data-testid="user-management-page">
      <div className="page-header">
        <h2 className="page-title" data-testid="user-management-title">{t('user.title')}</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          size="large"
          data-testid="user-management-create-button"
          aria-label={t('user.addUser')}
        >
          {t('user.addUser')}
        </Button>
      </div>
      <Card data-testid="user-management-table-card">
        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          rowKey="id"
          scroll={{ x: 800 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => t('user.totalRecords', { total }),
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              fetchUsers(page, pageSize)
            },
            onShowSizeChange: (current, size) => {
              fetchUsers(1, size)
            },
          }}
          data-testid="user-management-table"
        />
      </Card>
      <Modal
        title={editingUser ? t('user.editUser') : t('user.addUser')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        width={600}
        destroyOnClose
        data-testid="user-management-form-modal"
        aria-label={editingUser ? t('user.editUser') : t('user.addUser')}
      >
        <Form 
          form={form} 
          onFinish={handleSubmit} 
          layout="vertical" 
          size="large"
          data-testid="user-management-form"
        >
          <Form.Item
            name="name"
            label={t('user.name')}
            rules={[{ required: true, message: t('user.nameRequired') }]}
          >
            <Input 
              placeholder={t('user.namePlaceholder')} 
              data-testid="user-management-form-name-input"
              aria-label={t('user.name')}
            />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t('user.phone')}
            rules={[
              { required: true, message: t('user.phoneRequired') },
              { pattern: /^1[3-9]\d{9}$/, message: t('user.phoneInvalid') },
            ]}
          >
            <Input 
              placeholder={t('user.phonePlaceholder')} 
              disabled={!!editingUser}
              data-testid="user-management-form-phone-input"
              aria-label={t('user.phone')}
            />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label={t('user.password')}
              rules={[
                { required: true, message: t('user.passwordRequired') },
                { min: 8, message: t('user.passwordMin') },
              ]}
            >
              <Input.Password 
                placeholder={t('user.passwordPlaceholder')} 
                data-testid="user-management-form-password-input"
                aria-label={t('user.password')}
              />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label={t('user.role')}
            rules={[{ required: true, message: t('user.roleRequired') }]}
          >
            <Select 
              placeholder={t('user.rolePlaceholder')} 
              disabled={!!editingUser}
              data-testid="user-management-form-role-select"
              aria-label={t('user.role')}
            >
              <Select.Option value="organizer" data-testid="user-management-form-role-organizer">{t('user.roleOrganizer')}</Select.Option>
              <Select.Option value="sponsor" data-testid="user-management-form-role-sponsor">{t('user.roleSponsor')}</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${t('user.resetPasswordTitle')} - ${resettingUser?.name}`}
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false)
          passwordForm.resetFields()
        }}
        onOk={() => passwordForm.submit()}
        width={500}
        destroyOnClose
        data-testid="user-management-reset-password-modal"
        aria-label={t('user.resetPasswordTitle')}
      >
        <Form
          form={passwordForm}
          onFinish={handleResetPasswordSubmit}
          layout="vertical"
          size="large"
          data-testid="user-management-reset-password-form"
        >
          <Form.Item
            name="password"
            label={t('user.newPassword')}
            rules={[
              { required: true, message: t('user.newPasswordRequired') },
              { min: 8, message: t('user.passwordMin') },
            ]}
          >
            <Input.Password 
              placeholder={t('user.newPasswordPlaceholder')} 
              data-testid="user-management-reset-password-input"
              aria-label={t('user.newPassword')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

