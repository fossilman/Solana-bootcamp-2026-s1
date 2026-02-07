/**
 * 获取用户显示名称
 * 如果用户有昵称，显示昵称；否则显示钱包地址缩写
 */
export function getUserDisplayName(participant: { nickname?: string; wallet_address?: string } | null | undefined, walletAddress?: string | null): string {
  if (!participant && !walletAddress) {
    return '未知'
  }

  const nickname = participant?.nickname
  const address = participant?.wallet_address || walletAddress

  if (nickname && nickname.trim()) {
    return nickname.trim()
  }

  if (address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return '未知'
}

