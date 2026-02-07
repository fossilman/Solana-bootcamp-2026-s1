import { ethers } from 'ethers'
import request from '../api/request'

/** 可用的 EVM 钱包 provider（多钱包时供用户选择） */
export interface InjectedProvider {
  isMetaMask?: boolean
  isPhantom?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/** Phantom Solana 提供方（选 Phantom 时走 Solana 网络） */
export interface PhantomSolanaProvider {
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>
  signMessage: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array }>
}

declare global {
  interface Window {
    ethereum?: InjectedProvider & { providers?: InjectedProvider[] }
    phantom?: {
      ethereum?: InjectedProvider
      solana?: PhantomSolanaProvider
    }
  }
}

export type WalletOption = 
  | { type: 'metamask'; provider: InjectedProvider }
  | { type: 'phantom'; solana: PhantomSolanaProvider }

/** 获取可选钱包：MetaMask（EVM）+ Phantom（Solana）。选 Phantom 时使用 Solana 网络。 */
export function getAvailableWalletOptions(): WalletOption[] {
  const options: WalletOption[] = []
  const ethereum = window.ethereum
  const phantomSolana = window.phantom?.solana

  if (ethereum?.providers && Array.isArray(ethereum.providers)) {
    for (const p of ethereum.providers) {
      if (p && typeof p.request === 'function' && p.isMetaMask) {
        options.push({ type: 'metamask', provider: p })
        break
      }
    }
    if (options.length === 0) {
      for (const p of ethereum.providers) {
        if (p && typeof p.request === 'function') {
          options.push({ type: 'metamask', provider: p })
          break
        }
      }
    }
  } else if (ethereum && typeof ethereum.request === 'function') {
    if (!ethereum.isPhantom) options.push({ type: 'metamask', provider: ethereum })
  }

  if (phantomSolana && typeof phantomSolana.connect === 'function' && typeof phantomSolana.signMessage === 'function') {
    options.push({ type: 'phantom', solana: phantomSolana })
  }

  return options
}

/** 兼容旧用法：仅 EVM provider 列表（用于仅展示 MetaMask 时） */
export function getAvailableWalletProviders(): InjectedProvider[] {
  const list: InjectedProvider[] = []
  const ethereum = window.ethereum
  const phantomEth = window.phantom?.ethereum

  if (ethereum?.providers && Array.isArray(ethereum.providers)) {
    for (const p of ethereum.providers) {
      if (p && typeof p.request === 'function') list.push(p)
    }
  } else if (ethereum && typeof ethereum.request === 'function') {
    list.push(ethereum)
  }

  if (phantomEth && typeof phantomEth.request === 'function' && !list.includes(phantomEth)) {
    list.push(phantomEth)
  }

  return list
}

export function getWalletTypeLabel(provider: InjectedProvider): 'metamask' | 'phantom' {
  return provider.isPhantom ? 'phantom' : 'metamask'
}

/** 使用 MetaMask（EVM）完成连接、签名、验证 */
export async function connectWithProvider(provider: InjectedProvider): Promise<{
  address: string
  token: string
  participant: { id: number; wallet_address: string; wallet_type?: string; nickname?: string }
}> {
  const ethersProvider = new ethers.BrowserProvider(provider as ethers.Eip1193Provider)
  const accounts = await ethersProvider.send('eth_requestAccounts', []) as string[]
  const address = accounts[0]
  if (!address) throw new Error('No wallet address')
  const { nonce } = await request.post('/auth/connect', { wallet_address: address, wallet_type: 'metamask' })
  const signer = await ethersProvider.getSigner()
  const messageText = `Please sign this message to authenticate: ${nonce}`
  const signature = await signer.signMessage(messageText)
  const { token, participant } = await request.post('/auth/verify', {
    wallet_address: address,
    signature,
    wallet_type: 'metamask',
  })
  return { address, token, participant }
}

/** 使用 Phantom（Solana）完成连接、签名、验证 */
export async function connectWithPhantomSolana(solana: PhantomSolanaProvider): Promise<{
  address: string
  token: string
  participant: { id: number; wallet_address: string; wallet_type?: string; nickname?: string }
}> {
  const { publicKey } = await solana.connect()
  const address = publicKey.toBase58()
  if (!address) throw new Error('No wallet address')
  const { nonce } = await request.post('/auth/connect', { wallet_address: address, wallet_type: 'phantom' })
  const messageText = `Please sign this message to authenticate: ${nonce}`
  const messageBytes = new TextEncoder().encode(messageText)
  const { signature } = await solana.signMessage(messageBytes, 'utf8')
  const signatureBase64 = btoa(String.fromCharCode(...signature))
  const { token, participant } = await request.post('/auth/verify', {
    wallet_address: address,
    signature: signatureBase64,
    wallet_type: 'phantom',
  })
  return { address, token, participant }
}
