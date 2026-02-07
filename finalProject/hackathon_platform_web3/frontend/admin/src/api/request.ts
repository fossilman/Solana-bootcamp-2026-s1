import axios from 'axios'
import { message } from 'antd'
import { useAuthStore } from '../store/authStore'
import i18n from '../i18n'

const request = axios.create({
  baseURL: '/api/v1/admin',
  timeout: 10000,
})

request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    const { code, message: msg, data } = response.data
    if (code === 200) {
      return data
    } else {
      message.error(msg || i18n.t('common.requestFailed'))
      return Promise.reject(new Error(msg || i18n.t('common.requestFailed')))
    }
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    message.error(error.response?.data?.message || i18n.t('common.requestFailed'))
    return Promise.reject(error)
  }
)

export default request

