import request from './request'

export interface LoginParams {
  phone: string
  password: string
}

export interface WalletLoginParams {
  wallet_address: string
  phone: string
  signature: string
  wallet_type?: 'metamask' | 'phantom'
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    name: string
    phone: string
    role: string
  }
}

export const login = (params: LoginParams) => {
  return request.post<LoginResponse>('/auth/login', params)
}

export const loginWithWallet = (params: WalletLoginParams) => {
  return request.post<LoginResponse>('/auth/login/wallet', params)
}

export const logout = () => {
  return request.post('/auth/logout')
}

