import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    // 根据角色重定向到合适的页面
    if (user.role === 'sponsor') {
      return <Navigate to="/profile" replace />
    }
    // 其他角色重定向到活动概览
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

