/**
 * Solana 浏览器链接配置。
 * - VITE_SOLANA_EXPLORER_BASE: 地址页基础 URL
 * - VITE_SOLANA_EXPLORER_CLUSTER: 集群参数，如 devnet | mainnet-beta | local（本地用 custom + customUrl）
 * - VITE_SOLANA_RPC_URL: 本地网络时作为 customUrl，如 http://127.0.0.1:8899
 */
const SOLANA_EXPLORER_BASE =
  (import.meta as any).env?.VITE_SOLANA_EXPLORER_BASE?.trim() ||
  'https://explorer.solana.com/address'

// 未配置时：开发环境默认按本地网络拼 explorer 链接（?cluster=custom&customUrl=）
const SOLANA_EXPLORER_CLUSTER =
  (import.meta as any).env?.VITE_SOLANA_EXPLORER_CLUSTER?.trim() ||
  ((import.meta as any).env?.DEV ? 'local' : '')
const SOLANA_RPC_URL = (import.meta as any).env?.VITE_SOLANA_RPC_URL?.trim() || 'http://127.0.0.1:8899'

/**
 * 生成跳转到 Solana 浏览器查看某地址的 URL。
 * 当环境为 local 时使用 ?cluster=custom&customUrl=${rpc 地址}
 */
export function getSolanaExplorerAddressUrl(address: string): string {
  if (!address) return ''
  const base = SOLANA_EXPLORER_BASE.replace(/\/$/, '')
  const path = `${base}/${encodeURIComponent(address)}`
  const cluster = SOLANA_EXPLORER_CLUSTER.toLowerCase()
  if (cluster === 'local') {
    const customUrl = encodeURIComponent(SOLANA_RPC_URL)
    return `${path}?cluster=custom&customUrl=${customUrl}`
  }
  if (SOLANA_EXPLORER_CLUSTER) {
    return `${path}?cluster=${encodeURIComponent(SOLANA_EXPLORER_CLUSTER)}`
  }
  return path
}
