# TestID 命名规范

本文档说明了 Arena 系统前端代码中 `data-testid` 的命名规范，用于 Playwright E2E 测试。

## 命名格式

统一使用 `page-element-action` 格式：

- **page**: 页面标识（如 `home`, `hackathon-detail`, `submission-form`, `team-list`）
- **element**: 元素类型（如 `form`, `button`, `input`, `table`, `card`）
- **action**: 具体操作或标识（如 `submit`, `search`, `create`, `register`）

## 命名示例

### 页面级别
- `home-page` - 首页
- `hackathon-detail-page` - 活动详情页
- `submission-form-page` - 提交作品页
- `team-list-page` - 队伍列表页
- `profile-page` - 个人中心页

### 表单元素
- `submission-form-name-input` - 作品名称输入框
- `submission-form-description-input` - 作品描述输入框
- `submission-form-link-input` - 作品链接输入框
- `submission-form-submit-button` - 提交按钮
- `submission-form-save-draft-button` - 保存草稿按钮
- `profile-form-nickname-input` - 昵称输入框

### 按钮
- `home-search-button` - 搜索按钮
- `hackathon-detail-register-button` - 报名按钮
- `hackathon-detail-checkin-button` - 签到按钮
- `team-list-create-button` - 创建队伍按钮
- `team-list-join-button-{id}` - 加入队伍按钮（带ID）
- `submission-list-vote-button-{id}` - 投票按钮（带ID）

### 表格和列表
- `submission-list` - 作品列表
- `submission-list-item-{id}` - 作品列表项（带ID）
- `team-list` - 队伍列表
- `team-list-item-{id}` - 队伍列表项（带ID）
- `results-table` - 结果表格

### Modal 对话框
- `hackathon-detail-register-modal` - 报名确认对话框
- `hackathon-detail-checkin-modal` - 签到确认对话框
- `team-list-create-modal` - 创建队伍对话框

### 筛选和搜索
- `home-search` - 搜索框
- `home-status-filter` - 状态筛选器
- `home-sort` - 排序选择器

### 统计卡片
- `hackathon-detail-stat-registration` - 报名人数统计
- `hackathon-detail-stat-checkin` - 签到人数统计
- `hackathon-detail-stat-teams` - 组队数量统计
- `hackathon-detail-stat-submissions` - 提交作品数统计
- `results-stat-votes` - 总投票数统计

### 菜单和导航
- `arena-layout` - Arena 布局容器
- `arena-header` - Arena 头部
- `arena-header-menu` - 头部菜单
- `arena-connect-button` - 连接钱包按钮
- `arena-disconnect-button` - 断开连接按钮

## 使用原则

1. **唯一性**: 每个可交互元素都应该有唯一的 `data-testid`
2. **稳定性**: 不依赖 CSS class、文本内容或动态顺序
3. **可读性**: 命名应该清晰表达元素的用途和位置
4. **一致性**: 相同类型的元素使用相同的命名模式
5. **层级性**: 使用层级结构表达元素关系

## 特殊场景

### 列表项操作
对于列表中的操作按钮，使用 `{page}-{element}-{action}-{id}` 格式：
- `team-list-join-button-1` - 加入队伍ID为1的按钮
- `submission-list-vote-button-2` - 投票作品ID为2的按钮
- `team-detail-remove-member-3` - 移除成员ID为3的按钮

### 动态内容
对于动态生成的内容，使用稳定的标识符：
- `home-hackathon-card-{id}` - 活动卡片（带ID）
- `my-hackathons-card-{id}` - 我的活动卡片（带ID）

### 分页
- `home-pagination` - 分页组件
- `home-pagination-next` - 下一页按钮
- `home-pagination-prev` - 上一页按钮

## 可访问性

除了 `data-testid`，还应该添加 `aria-label` 属性以提高可访问性：
- 按钮：`aria-label="操作描述"`
- 输入框：`aria-label="输入框描述"`
- 选择器：`aria-label="选择器描述"`
- 链接：`aria-label="链接描述"`

## 示例代码

```tsx
// 按钮
<Button
  data-testid="hackathon-detail-register-button"
  aria-label="报名参加活动"
>
  报名参加
</Button>

// 输入框
<Input
  data-testid="submission-form-name-input"
  aria-label="作品名称输入框"
  placeholder="请输入作品名称"
/>

// 列表
<List
  data-testid="submission-list"
  dataSource={submissions}
  renderItem={(item) => (
    <List.Item data-testid={`submission-list-item-${item.id}`}>
      {/* ... */}
    </List.Item>
  )}
/>

// Modal
<Modal
  data-testid="hackathon-detail-register-modal"
  aria-label="报名确认对话框"
  open={visible}
>
  {/* ... */}
</Modal>
```

## 测试使用示例

在 Playwright 测试中使用：

```typescript
// 点击报名按钮
await page.click('[data-testid="hackathon-detail-register-button"]')

// 填写作品名称
await page.fill('[data-testid="submission-form-name-input"]', '我的作品')

// 等待列表加载
await page.waitForSelector('[data-testid="submission-list"]')

// 点击投票按钮（使用ID）
await page.click('[data-testid="submission-list-vote-button-1"]')
```

