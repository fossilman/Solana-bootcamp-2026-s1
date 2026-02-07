// @ts-nocheck
import { Switch } from 'antd'
import { useTranslation } from 'react-i18next'

/**
 * 统一的语言切换组件
 * 支持中英文切换，使用开关样式
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const isEnglish = i18n.language === 'en-US'

  const handleLanguageChange = (checked: boolean) => {
    const lang = checked ? 'en-US' : 'zh-CN'
    i18n.changeLanguage(lang)
    localStorage.setItem('language', lang)
  }

  return (
    <Switch
      checked={isEnglish}
      onChange={handleLanguageChange}
      checkedChildren="EN"
      unCheckedChildren="中"
      style={{ minWidth: 50 }}
      data-testid="language-switcher"
    />
  )
}

