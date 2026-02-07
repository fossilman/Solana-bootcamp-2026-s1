import { useState } from 'react'
import { Form, Input, Button, Card, message, Tabs, Alert, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { login, loginWithWallet } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import '../index.css'

type WalletProviderType = 'metamask' | 'phantom'

interface InjectedProvider {
  isMetaMask?: boolean
  isPhantom?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

interface PhantomSolanaProvider {
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>
  signMessage: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array }>
}

declare global {
  interface Window {
    ethereum?: InjectedProvider & { providers?: InjectedProvider[] }
    phantom?: { ethereum?: InjectedProvider; solana?: PhantomSolanaProvider }
  }
}

type WalletLoginOption = { type: 'metamask'; provider: InjectedProvider } | { type: 'phantom'; solana: PhantomSolanaProvider }

/** 可选钱包：MetaMask（EVM）、Phantom（Solana）。选 Phantom 时使用 Solana 网络。 */
function getAvailableWalletOptions(): WalletLoginOption[] {
  const options: WalletLoginOption[] = []
  const ethereum = window.ethereum
  const phantomSolana = window.phantom?.solana

  if (ethereum?.providers && Array.isArray(ethereum.providers)) {
    for (const p of ethereum.providers) {
      if (p && typeof p.request === 'function' && p.isMetaMask) {
        options.push({ type: 'metamask', provider: p })
        break
      }
    }
    if (options.length === 0 && ethereum.providers.length > 0) {
      const p = ethereum.providers.find((x: InjectedProvider) => x && typeof x.request === 'function')
      if (p) options.push({ type: 'metamask', provider: p as InjectedProvider })
    }
  } else if (ethereum && typeof ethereum.request === 'function' && !ethereum.isPhantom) {
    options.push({ type: 'metamask', provider: ethereum })
  }

  if (phantomSolana && typeof phantomSolana.connect === 'function' && typeof phantomSolana.signMessage === 'function') {
    options.push({ type: 'phantom', solana: phantomSolana })
  }

  return options
}

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [walletLoading, setWalletLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const [activeTab, setActiveTab] = useState('phone')

  const onFinish = async (values: { phone: string; password: string }) => {
    setLoading(true)
    try {
      const data = await login(values)
      setAuth(data.token, data.user)
      message.success(t('login.loginSuccess'))
      // 根据角色跳转到不同页面
      if (data.user.role === 'sponsor') {
        navigate('/profile', { replace: true })
      } else {
        // 直接跳转到 dashboard，而不是通过 IndexRedirect
        navigate('/dashboard', { replace: true })
      }
      // 等待导航完成
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const [walletForm] = Form.useForm()

  const [walletSelectModalOpen, setWalletSelectModalOpen] = useState(false)
  const [pendingWalletValues, setPendingWalletValues] = useState<{ phone: string } | null>(null)
  const walletOptions = getAvailableWalletOptions()

  const doWalletLogin = async (option: WalletLoginOption, values: { phone: string }) => {
    if (option.type === 'phantom') {
      const { publicKey } = await option.solana.connect()
      const walletAddress = publicKey.toBase58()
      const signMessage = `${t('login.signMessage')}\n\nWallet Address: ${walletAddress}\nPhone: ${values.phone}\nTimestamp: ${Date.now()}`
      const messageBytes = new TextEncoder().encode(signMessage)
      const { signature } = await option.solana.signMessage(messageBytes, 'utf8')
      const signatureBase64 = btoa(String.fromCharCode(...signature))
      return loginWithWallet({
        wallet_address: walletAddress,
        phone: values.phone,
        signature: signatureBase64,
        wallet_type: 'phantom',
      })
    }
    const accounts = await option.provider.request({ method: 'eth_requestAccounts' }) as string[]
    const walletAddress = accounts[0]
    if (!walletAddress) {
      message.error(t('login.noWalletAddress'))
      return
    }
    const signMessage = `${t('login.signMessage')}\n\nWallet Address: ${walletAddress}\nPhone: ${values.phone}\nTimestamp: ${Date.now()}`
    const signature = await option.provider.request({
      method: 'personal_sign',
      params: [signMessage, walletAddress],
    }) as string
    return loginWithWallet({
      wallet_address: walletAddress,
      phone: values.phone,
      signature,
      wallet_type: 'metamask',
    })
  }

  const handleWalletLogin = async (values: { phone: string }) => {
    if (walletOptions.length === 0) {
      message.error(t('login.installWallet'))
      return
    }

    setWalletLoading(true)
    try {
      if (walletOptions.length > 1) {
        setPendingWalletValues(values)
        setWalletSelectModalOpen(true)
        setWalletLoading(false)
        return
      }
      const data = await doWalletLogin(walletOptions[0], values)
      if (!data) return
      setAuth(data.token, data.user)
      message.success(t('login.loginSuccess'))
      if (data.user.role === 'sponsor') {
        navigate('/profile', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error: any) {
      if (error?.code === 4001) {
        message.error(t('login.signRejected'))
      } else {
        message.error(error?.response?.data?.message || t('login.walletLoginFailed'))
      }
    } finally {
      setWalletLoading(false)
    }
  }

  const handleSelectWalletAndLogin = async (option: WalletLoginOption) => {
    if (!pendingWalletValues) return
    setWalletSelectModalOpen(false)
    setWalletLoading(true)
    try {
      const data = await doWalletLogin(option, pendingWalletValues)
      setPendingWalletValues(null)
      if (!data) return
      setAuth(data.token, data.user)
      message.success(t('login.loginSuccess'))
      if (data.user.role === 'sponsor') {
        navigate('/profile', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error: any) {
      if (error?.code === 4001) {
        message.error(t('login.signRejected'))
      } else {
        message.error(error?.response?.data?.message || t('login.walletLoginFailed'))
      }
    } finally {
      setWalletLoading(false)
    }
  }

  return (
    <div className="login-container" data-testid="login-page">
      <Card
        title={
          <div style={{ textAlign: 'center', fontSize: '24px', fontWeight: 600 }}>
            🏆 Hackathon Admin Platform
          </div>
        }
        className="login-card"
        data-testid="login-card"
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'phone',
              label: t('login.phoneLogin'),
              children: (
                <Form 
                  onFinish={onFinish} 
                  layout="vertical" 
                  size="large"
                  data-testid="login-form"
                >
                  <Form.Item
                    name="phone"
                    label={t('login.phone')}
                    rules={[
                      { required: true, message: t('login.phoneRequired') },
                      { pattern: /^1[3-9]\d{9}$/, message: t('login.phoneInvalid') },
                    ]}
                  >
                    <Input 
                      placeholder={t('login.phonePlaceholder')} 
                      data-testid="login-phone-input"
                      aria-label={t('login.phone')}
                    />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label={t('login.password')}
                    rules={[{ required: true, message: t('login.passwordRequired') }]}
                  >
                    <Input.Password 
                      placeholder={t('login.passwordPlaceholder')} 
                      data-testid="login-password-input"
                      aria-label={t('login.password')}
                    />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      block 
                      loading={loading} 
                      size="large"
                      data-testid="login-submit-button"
                      aria-label={t('login.submit')}
                    >
                      {t('login.submit')}
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'wallet',
              label: t('login.walletLogin'),
              children: (
                <Form
                  form={walletForm}
                  onFinish={handleWalletLogin}
                  layout="vertical"
                  size="large"
                  data-testid="login-wallet-form"
                >
                  <Form.Item
                    name="phone"
                    label={t('login.phone')}
                    rules={[
                      { required: true, message: t('login.phoneRequired') },
                      { pattern: /^1[3-9]\d{9}$/, message: t('login.phoneInvalid') },
                    ]}
                  >
                    <Input 
                      placeholder={t('login.phonePlaceholder')} 
                      data-testid="login-wallet-phone-input"
                      aria-label={t('login.phone')}
                    />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={walletLoading}
                      data-testid="login-wallet-button"
                      aria-label={t('login.walletSubmit')}
                      style={{ width: '100%' }}
                    >
                      {t('login.walletSubmit')}
                    </Button>
                  </Form.Item>
                  <div style={{ marginTop: '16px', color: '#999', fontSize: '12px', textAlign: 'center' }}>
                    {t('login.walletTip')}
                  </div>
                </Form>
              ),
            },
            {
              key: 'sponsor',
              label: t('login.sponsorApply'),
              children: (
                <div style={{ padding: '24px 0' }}>
                  <Alert
                    message={t('sponsor.applyTitle')}
                    description={t('sponsor.applyDescription')}
                    type="info"
                    showIcon
                    style={{ marginBottom: '24px' }}
                    data-testid="sponsor-apply-alert"
                  />
                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={() => navigate('/sponsor/apply')}
                    data-testid="sponsor-apply-button"
                    aria-label="前往赞助商申请页面"
                  >
                    {t('sponsor.goToApply')}
                  </Button>
                  <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>{t('login.applyProcess')}</div>
                    <ol style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                      <li>{t('login.applyStep1')}</li>
                      <li>{t('login.applyStep2')}</li>
                      <li>{t('login.applyStep3')}</li>
                      <li>{t('login.applyStep4')}</li>
                    </ol>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t('login.chooseWallet')}
        open={walletSelectModalOpen}
        onCancel={() => { setWalletSelectModalOpen(false); setPendingWalletValues(null) }}
        footer={null}
        data-testid="login-wallet-select-modal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
          {walletOptions.map((option, index) => {
            const label = option.type === 'phantom' ? t('login.walletPhantomSolana') : t('login.walletMetaMask')
            return (
              <Button
                key={index}
                size="large"
                block
                onClick={() => handleSelectWalletAndLogin(option)}
                data-testid={`login-wallet-option-${option.type}`}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

