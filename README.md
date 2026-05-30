# realwds-webhooks

一个基于 Cloudflare Worker 的 Webhook 服务，用于将 GitLab Merge Request 事件实时推送到飞书（Feishu/Lark）群组。

## 功能特性

- 🔔 **实时通知**：GitLab MR 事件实时推送到飞书
- 📊 **富文本卡片**：使用飞书交互式卡片展示 MR 详情
- 🔄 **全生命周期追踪**：支持 MR 创建、更新、合并、关闭、重新打开等状态
- ✅ **合并状态检测**：显示 MR 是否可以合并、是否有冲突
- 🔗 **快捷操作**：卡片内置查看详情和查看项目按钮

## 支持的 MR 事件类型

| 动作 | 图标 | 说明 |
|------|------|------|
| open | 🔔 | 新的合并请求 |
| merge | ✅ | 已合并 |
| close | ❌ | 已关闭 |
| reopen | 🔄 | 重新打开 |
| update | 📝 | MR 更新 |

## 技术栈

- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - CLI 工具
- [飞书自定义机器人](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot) - 消息推送

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/realwds/realwds-webhooks.git
cd realwds-webhooks
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `wrangler.toml.example` 为 `wrangler.toml`（如果不存在则直接创建），并配置你的飞书 Webhook URL：

```toml
name = "realwds-webhooks"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 4. 本地开发

```bash
npm run dev
```

### 5. 部署到 Cloudflare

```bash
npm run deploy
```

## GitLab Webhook 配置

1. 进入你的 GitLab 项目
2. 点击 **Settings** → **Webhooks**
3. 在 **URL** 中填入你的 Cloudflare Worker 地址，例如：
   ```
   https://realwds-webhooks.xxx.workers.dev/gitlab-webhook
   ```
4. 选择 **Merge request events**
5. 可选：设置 **Secret Token** 进行验证（需要代码支持）
6. 点击 **Add webhook**

## 项目结构

```
realwds-webhooks/
├── src/
│   └── index.js          # 主入口文件
├── test/
│   └── index.spec.js     # 测试文件
├── wrangler.toml         # Cloudflare 配置
├── package.json          # 项目依赖
└── README.md             # 项目文档
```

## API 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/gitlab-webhook` | POST | 接收 GitLab Webhook 事件 |
| `/favicon.ico` | GET | 返回 404 |
| 其他路径 | 任意 | 返回 404 |

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `FEISHU_WEBHOOK_URL` | 是 | 飞书自定义机器人 Webhook 地址 |

## 测试

```bash
npm test
```

## 贡献指南

1. Fork 本项目
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

[MIT](LICENSE) © realwds

## 作者

- **realwds** - [GitHub](https://github.com/realwds)

## 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [GitLab](https://about.gitlab.com/)
- [飞书开放平台](https://open.feishu.cn/)

---

如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！