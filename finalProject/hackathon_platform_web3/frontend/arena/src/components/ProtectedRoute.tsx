import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) {
      // 未登录用户重定向到首页
      navigate('/', { replace: true })
    }
  }, [token, navigate])

  // 如果未登录，不渲染子组件
  if (!token) {
    return null
  }

  return <>{children}</>
}

