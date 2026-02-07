# TestID 命名规范

本文档说明了 Admin 系统前端代码中 `data-testid` 的命名规范，用于 Playwright E2E 测试。

## 命名格式

统一使用 `page-element-action` 格式：

- **page**: 页面标识（如 `login`, `dashboard`, `user-management`）
- **element**: 元素类型（如 `form`, `button`, `input`, `table`）
- **action**: 具体操作或标识（如 `submit`, `email`, `create`）

## 命名示例

### 页面级别
- `login-page` - 登录页面
- `dashboard-page` - 仪表盘页面
- `user-management-page` - 用户管理页面
- `hackathon-list-page` - 活动列表页面

### 表单元素
- `login-email-input` - 登录邮箱输入框
- `login-password-input` - 登录密码输入框
- `login-submit-button` - 登录提交按钮
- `user-management-form-name-input` - 用户管理表单姓名输入框

### 按钮
- `user-management-create-button` - 用户管理创建按钮
- `user-management-edit-button-{id}` - 用户管理编辑按钮（带ID）
- `hackathon-list-create-button` - 活动列表创建按钮

### 表格
- `user-management-table` - 用户管理表格
- `hackathon-list-table` - 活动列表表格
- `user-management-actions-{id}` - 用户操作按钮组（带ID）

### Modal 对话框
- `user-management-form-modal` - 用户管理表单对话框
- `user-management-reset-password-modal` - 重置密码对话框
- `profile-change-password-modal` - 修改密码对话框

### 统计卡片
- `dashboard-stat-total-hackathons` - 仪表盘活动总数卡片
- `dashboard-stat-total-users` - 仪表盘用户总数卡片
- `hackathon-detail-stat-registration` - 活动详情报名人数卡片

### 选择器
- `hackathon-list-status-filter` - 活动列表状态筛选器
- `hackathon-list-sort-filter` - 活动列表排序筛选器
- `user-management-form-role-select` - 用户管理表单角色选择器

### 菜单和导航
- `admin-sidebar-menu` - 侧边栏菜单
- `admin-menu-dashboard` - 仪表盘菜单项
- `admin-menu-users` - 用户管理菜单项
- `admin-user-menu-button` - 用户菜单按钮

## 使用原则

1. **唯一性**: 每个可交互元素都应该有唯一的 `data-testid`
2. **稳定性**: 不依赖 CSS class、文本内容或动态顺序
3. **可读性**: 命名应该清晰表达元素的用途和位置
4. **一致性**: 相同类型的元素使用相同的命名模式
5. **层级性**: 使用层级结构表达元素关系

## 特殊场景

### 列表项操作
对于表格中的操作按钮，使用 `{page}-{element}-{action}-{id}` 格式：
- `user-management-edit-button-1` - 编辑用户ID为1的按钮
- `hackathon-list-view-button-2` - 查看活动ID为2的按钮

### 动态内容
对于动态生成的内容，使用稳定的标识符：
- `dashboard-status-stat-{status}` - 状态统计卡片
- `hackathon-stages-timeline-item-{stage}` - 阶段时间轴项

## 可访问性

除了 `data-testid`，还应该添加 `aria-label` 属性以提高可访问性：
- 按钮：`aria-label="操作描述"`
- 输入框：`aria-label="输入框描述"`
- 选择器：`aria-label="选择器描述"`

## 示例代码

```tsx
// 按钮
<Button
  data-testid="user-management-create-button"
  aria-label="添加用户"
>
  添加用户
</Button>

// 输入框
<Input
  data-testid="login-email-input"
  aria-label="邮箱输入框"
  placeholder="请输入邮箱"
/>

// 表格
<Table
  data-testid="user-management-table"
  dataSource={users}
  rowKey="id"
/>

// Modal
<Modal
  data-testid="user-management-form-modal"
  aria-label="添加用户对话框"
  open={visible}
>
  {/* ... */}
</Modal>
```

## 测试使用示例

在 Playwright 测试中使用：

```typescript
// 点击登录按钮
await page.click('[data-testid="login-submit-button"]')

// 填写邮箱
await page.fill('[data-testid="login-email-input"]', 'admin@example.com')

// 等待表格加载
await page.waitForSelector('[data-testid="user-management-table"]')

// 点击编辑按钮（使用ID）
await page.click('[data-testid="user-management-edit-button-1"]')
```

