// @ts-nocheck
import { Button, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import type { ButtonProps } from 'antd'

interface FormActionsProps {
  submitLabel?: string
  cancelLabel?: string
  onSubmit?: () => void
  onCancel: () => void
  loading?: boolean
  submitButtonProps?: ButtonProps
  cancelButtonProps?: ButtonProps
  testId?: string
  size?: 'small' | 'middle' | 'large'
}

/**
 * 统一的表单操作按钮组组件
 * 用于表单的提交和取消操作
 */
export default function FormActions({
  submitLabel,
  cancelLabel,
  onSubmit,
  onCancel,
  loading = false,
  submitButtonProps,
  cancelButtonProps,
  testId = 'form-actions',
  size = 'large',
}: FormActionsProps) {
  const { t } = useTranslation()
  const finalSubmitLabel = submitLabel || t('common.save')
  const finalCancelLabel = cancelLabel || t('cancel')
  
  return (
    <Space data-testid={testId}>
      <Button
        type="primary"
        htmlType="submit"
        loading={loading}
        size={size}
        onClick={onSubmit}
        data-testid={`${testId}-submit-button`}
        aria-label={finalSubmitLabel}
        {...submitButtonProps}
      >
        {finalSubmitLabel}
      </Button>
      <Button
        onClick={onCancel}
        size={size}
        data-testid={`${testId}-cancel-button`}
        aria-label={finalCancelLabel}
        {...cancelButtonProps}
      >
        {finalCancelLabel}
      </Button>
    </Space>
  )
}

