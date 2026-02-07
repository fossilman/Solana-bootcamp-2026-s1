// @ts-nocheck
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string | ReactNode
  subtitle?: string
  actions?: ReactNode
  testId?: string
  className?: string
}

/**
 * 统一的页面头部组件
 * 用于统一页面标题和操作按钮的布局
 */
export default function PageHeader({ 
  title, 
  subtitle, 
  actions, 
  testId = 'page-header',
  className = 'page-header'
}: PageHeaderProps) {
  return (
    <div className={className} data-testid={testId}>
      <div>
        {typeof title === 'string' ? (
          <h2 className="page-title" data-testid={`${testId}-title`}>
            {title}
          </h2>
        ) : (
          <div data-testid={`${testId}-title`}>{title}</div>
        )}
        {subtitle && (
          <div className="page-subtitle" data-testid={`${testId}-subtitle`}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div data-testid={`${testId}-actions`}>
          {actions}
        </div>
      )}
    </div>
  )
}

