import { useState } from 'react'
import { Form, Input, Button, Card, message, Select, Space, Upload } from 'antd'
import { SearchOutlined, UploadOutlined, WalletOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { UploadFile, UploadProps } from 'antd'
import { PublicKey } from '@solana/web3.js'
import request from '../api/request'
import { getSolanaExplorerAddressUrl } from '../config/solana'
import {
  getLatestBlockhash,
  signTransactionWithPhantom,
  buildSponsorApplyTransaction,
  solToLamports,
  type PrepareSponsorApplyData,
} from '../utils/solanaPublish'
import '../index.css'

const { Option } = Select

export default function SponsorApply() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryResult, setQueryResult] = useState<any>(null)
  const [sponsorType, setSponsorType] = useState<string>('')
  const [publishedHackathons, setPublishedHackathons] = useState<any[]>([])
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([])
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)

  // 获取已发布的活动列表
  const fetchPublishedHackathons = async () => {
    try {
      const response = await request.get('/sponsor/published-hackathons', {
        params: { page: 1, page_size: 100 },
      })
      const data = response as any
      // 处理不同的响应格式
      if (Array.isArray(data)) {
        setPublishedHackathons(data)
      } else if (data.list) {
        setPublishedHackathons(data.list)
      } else {
        setPublishedHackathons([])
      }
    } catch (error: any) {
      console.error('获取活动列表失败', error)
      // 不显示错误提示，避免干扰用户体验
      setPublishedHackathons([])
    }
  }

  // 连接 Phantom 钱包（用于赞助金额转入金库）
  const handleConnectWallet = async () => {
    const phantom = (window as any).phantom?.solana
    if (!phantom || typeof phantom.connect !== 'function') {
      message.error(t('sponsor.walletRequired'))
      return
    }
    setWalletLoading(true)
    try {
      const { publicKey } = await phantom.connect()
      setWalletAddress(publicKey.toBase58())
    } catch (e: any) {
      message.error(e?.message || t('sponsor.walletRequired'))
    } finally {
      setWalletLoading(false)
    }
  }

  // 当选择活动指定赞助时，获取活动列表
  const handleSponsorTypeChange = (value: string) => {
    setSponsorType(value)
    if (value === 'event_specific') {
      fetchPublishedHackathons()
    }
  }

  // 将图片文件转换为base64
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  // 处理Logo上传
  const handleLogoUpload: UploadProps['beforeUpload'] = async (file) => {
    // 验证文件类型
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      message.error(t('sponsor.logoTypeInvalid'))
      return false
    }

    // 验证文件大小（5MB）
    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      message.error(t('sponsor.logoSizeInvalid'))
      return false
    }

    try {
      // 转换为base64
      const base64 = await getBase64(file)
      
      // 创建文件对象用于显示（不包含预览URL）
      const fileObj = {
        uid: file.uid,
        name: file.name,
        status: 'done' as const,
        originFileObj: file,
      }
      
      // 确保 logo_url 是字符串类型
      const logoUrlString = typeof base64 === 'string' ? base64 : String(base64)
      form.setFieldsValue({ logo_url: logoUrlString })
      setLogoFileList([fileObj])
    } catch (error) {
      message.error(t('sponsor.logoUploadFailed'))
    }

    // 阻止自动上传
    return false
  }

  // 处理Logo移除
  const handleLogoRemove = () => {
    setLogoFileList([])
    form.setFieldsValue({ logo_url: '' })
  }

  // 提交申请：先创建后端申请拿到 application_id，再构建并签名 sponsor_apply 交易，金额转入金库
  const handleSubmit = async (values: any) => {
    if (!walletAddress) {
      message.error(t('sponsor.walletRequired'))
      return
    }
    const amountSol = Number(values.amount_sol)
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      message.error(t('sponsor.amountInvalid'))
      return
    }

    const logoUrl = values.logo_url
    if (!logoUrl || (typeof logoUrl === 'string' && !logoUrl.trim())) {
      message.error(t('sponsor.logoRequired'))
      return
    }

    setLoading(true)
    try {
      const logoUrlString = typeof logoUrl === 'string' ? logoUrl : String(logoUrl || '')
      const payload = {
        phone: String(values.phone || ''),
        logo_url: logoUrlString,
        sponsor_type: String(values.sponsor_type || ''),
        event_ids: values.sponsor_type === 'event_specific' ? (values.event_ids || []) : [],
        amount_sol: amountSol,
        wallet_address: walletAddress,
      }

      const createRes = await request.post('/sponsor/applications', payload) as { application_id: number }
      const applicationId = createRes.application_id

      const prepare = await request.get('/sponsor/apply/prepare') as PrepareSponsorApplyData
      const blockhash = await getLatestBlockhash(prepare.rpc_url)
      const programId = new PublicKey(prepare.program_id)
      const sponsorPk = new PublicKey(walletAddress)
      const amountLamports = solToLamports(amountSol)

      const transaction = buildSponsorApplyTransaction(
        programId,
        applicationId,
        amountLamports,
        sponsorPk,
        blockhash
      )
      const signedBase64 = await signTransactionWithPhantom(transaction)
      await request.post('/sponsor/applications/submit-transaction', {
        signed_transaction: signedBase64,
      })

      message.success(t('sponsor.submitSuccess'))
      form.resetFields()
      setLogoFileList([])
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || t('sponsor.submitFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 查询申请结果
  const handleQuery = async () => {
    const phone = form.getFieldValue('phone')
    if (!phone || !phone.trim()) {
      message.error(t('sponsor.queryPhoneRequired'))
      return
    }

    setQueryLoading(true)
    try {
      const result = await request.get('/sponsor/applications/query', {
        params: { phone },
      })
      setQueryResult(result)
      // 不再显示弹框，直接展示在页面
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('sponsor.queryFailed'))
      setQueryResult(null)
    } finally {
      setQueryLoading(false)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }}>
            {t('sponsor.applyTitle')}
          </div>
        }
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item label={t('sponsor.connectWallet')}>
            <Space>
              <Button
                type={walletAddress ? 'default' : 'primary'}
                icon={<WalletOutlined />}
                onClick={handleConnectWallet}
                loading={walletLoading}
              >
                {walletAddress ? `${t('sponsor.walletConnected')}: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : t('sponsor.connectWallet')}
              </Button>
            </Space>
          </Form.Item>

          <Form.Item
            name="amount_sol"
            label={t('sponsor.amountSol')}
            rules={[
              { required: true, message: t('sponsor.amountRequired') },
              {
                validator: (_, v) => {
                  const n = Number(v)
                  if (!Number.isFinite(n) || n <= 0) return Promise.reject(new Error(t('sponsor.amountInvalid')))
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Input type="number" placeholder={t('sponsor.amountPlaceholder')} min={0} step={0.01} />
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('sponsor.phone')}
            rules={[
              { required: true, message: t('sponsor.phoneRequired') },
              { pattern: /^1[3-9]\d{9}$/, message: t('sponsor.phoneInvalid') },
            ]}
          >
            <Input placeholder={t('sponsor.phonePlaceholder')} maxLength={11} />
          </Form.Item>

          <Form.Item
            name="logo_url"
            label={t('sponsor.logo')}
            rules={[
              { required: true, message: t('sponsor.logoRequired') },
            ]}
          >
            <div>
              <Input type="hidden" />
              <Upload
                fileList={logoFileList}
                beforeUpload={handleLogoUpload}
                onRemove={handleLogoRemove}
                accept="image/*"
                maxCount={1}
                showUploadList={true}
              >
                <Button icon={<UploadOutlined />}>{t('sponsor.uploadLogo')}</Button>
              </Upload>
            </div>
          </Form.Item>

          <Form.Item
            name="sponsor_type"
            label={t('sponsor.type')}
            rules={[{ required: true, message: t('sponsor.typeRequired') }]}
          >
            <Select
              placeholder={t('sponsor.typePlaceholder')}
              onChange={handleSponsorTypeChange}
            >
              <Option value="long_term">{t('sponsor.longTerm')}</Option>
              <Option value="event_specific">{t('sponsor.eventSpecific')}</Option>
            </Select>
          </Form.Item>

          {sponsorType === 'event_specific' && (
            <Form.Item
              name="event_ids"
              label={t('sponsor.selectEvent')}
              rules={[{ required: true, message: t('sponsor.eventRequired') }]}
            >
              <Select
                mode="multiple"
                placeholder={t('sponsor.eventPlaceholder')}
                showSearch
                filterOption={(input, option) => {
                  const children = option?.children
                  const text = typeof children === 'string' ? children : String(children || '')
                  return text.toLowerCase().includes(input.toLowerCase())
                }}
              >
                {publishedHackathons.map((hackathon) => (
                  <Option key={hackathon.id} value={hackathon.id}>
                    {hackathon.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('sponsor.submit')}
              </Button>
              <Button
                icon={<SearchOutlined />}
                onClick={handleQuery}
                loading={queryLoading}
              >
                {t('sponsor.query')}
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {/* 查询申请结果区域 */}
        {queryResult && (
          <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px', marginTop: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>{t('sponsor.queryResult')}</div>
            <div>{queryResult.message}</div>
            {queryResult.status && (
              <div style={{ marginTop: '8px', color: '#666' }}>
                {t('sponsor.status')}{queryResult.status === 'pending' ? t('sponsor.statusPending') : queryResult.status === 'approved' ? t('sponsor.statusApproved') : t('sponsor.statusRejected')}
              </div>
            )}
            {queryResult.vault_address && (
              <div style={{ marginTop: '12px' }}>
                <span style={{ color: '#666', marginRight: '8px' }}>{t('sponsor.vaultAddress')}:</span>
                <a
                  href={getSolanaExplorerAddressUrl(queryResult.vault_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {queryResult.vault_address.slice(0, 8)}...{queryResult.vault_address.slice(-8)}
                </a>
                <span style={{ marginLeft: '8px', color: '#1890ff', fontSize: '12px' }}>{t('sponsor.viewOnExplorer')}</span>
              </div>
            )}
            {queryResult.sponsor_config_address && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ color: '#666', marginRight: '8px' }}>{t('sponsor.sponsorConfigAddress')}:</span>
                <a
                  href={getSolanaExplorerAddressUrl(queryResult.sponsor_config_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {queryResult.sponsor_config_address.slice(0, 8)}...{queryResult.sponsor_config_address.slice(-8)}
                </a>
                <span style={{ marginLeft: '8px', color: '#1890ff', fontSize: '12px' }}>{t('sponsor.viewOnExplorer')}</span>
              </div>
            )}
            {queryResult.sponsor_application_address && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ color: '#666', marginRight: '8px' }}>{t('sponsor.sponsorApplicationAddress')}:</span>
                <a
                  href={getSolanaExplorerAddressUrl(queryResult.sponsor_application_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {queryResult.sponsor_application_address.slice(0, 8)}...{queryResult.sponsor_application_address.slice(-8)}
                </a>
                <span style={{ marginLeft: '8px', color: '#1890ff', fontSize: '12px' }}>{t('sponsor.viewOnExplorer')}</span>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

