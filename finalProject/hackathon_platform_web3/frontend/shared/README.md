# 共享组件库

这个目录包含了 Admin 和 Arena 两个系统可以共享的 React 组件。

## 组件列表

### 1. StatCard - 统计卡片组件
用于展示统计数据的卡片组件。

**使用示例：**
```tsx
import { StatCard } from '@shared/components'

<StatCard
  title="总活动数"
  value={100}
  prefix={<TrophyOutlined />}
  iconColor="var(--primary-color)"
  testId="stat-total"
/>
```

**Props：**
- `title`: 标题
- `value`: 数值
- `prefix`: 前缀图标
- `suffix`: 后缀
- `iconColor`: 图标颜色
- `onClick`: 点击事件
- `hoverable`: 是否可悬停
- `testId`: 测试ID

### 2. PageHeader - 页面头部组件
统一的页面头部组件，包含标题和操作按钮。

**使用示例：**
```tsx
import { PageHeader } from '@shared/components'

<PageHeader
  title="活动列表"
  actions={<Button>创建活动</Button>}
  testId="page-header"
/>
```

**Props：**
- `title`: 标题（支持字符串或 ReactNode）
- `subtitle`: 副标题（可选）
- `actions`: 操作按钮区域
- `testId`: 测试ID

### 3. LanguageSwitcher - 语言切换组件
中英文切换开关组件。

**使用示例：**
```tsx
import { LanguageSwitcher } from '@shared/components'

<LanguageSwitcher />
```

### 4. FormActions - 表单操作按钮组件
统一的表单提交和取消按钮组。

**使用示例：**
```tsx
import { FormActions } from '@shared/components'

<FormActions
  submitLabel="保存"
  cancelLabel="取消"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  loading={loading}
/>
```

**Props：**
- `submitLabel`: 提交按钮文字
- `cancelLabel`: 取消按钮文字
- `onSubmit`: 提交回调
- `onCancel`: 取消回调
- `loading`: 加载状态
- `size`: 按钮尺寸

## 导入方式

在两个系统中，使用路径别名 `@shared` 导入：

```tsx
import { StatCard, PageHeader, LanguageSwitcher, FormActions } from '@shared/components'
```

## 配置说明

两个系统的 `vite.config.ts` 和 `tsconfig.json` 已配置路径别名：

- Vite: `@shared` -> `../shared/src`
- TypeScript: `@shared/*` -> `../shared/src/*`

