# qwq 消息分发 · Notification Hub

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/I0C9U0)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

一个统一的**通知消息分发平台**：你的各个系统只要调用一个接口、带上密钥，就能通过
短信、邮件、微信公众号、飞书、钉钉、Webhook 等渠道把消息发出去。支持多服务商、
分组轮询/负载均衡、模板化发送、测试/生产密钥、IP 白名单、限速、IAM 子账号，界面中英文双语。

> 👆 点上面的「**Deploy on Zeabur**」即可一键部署本平台到 Zeabur
> （模板：<https://zeabur.com/templates/I0C9U0>）。想要带你个人推荐码的官方按钮，
> 或 fork 后换成自己的模板，见下方 [一键部署与上架 Zeabur 市场](#一键部署与上架-zeabur-市场)。

## 技术栈

- **Next.js 16**（App Router）+ React 19 + TypeScript
- **Tailwind CSS v4** + lucide 图标（手写组件，无第三方 UI 库）
- **Prisma 7**（驱动适配器）+ 本地 SQLite / 线上 PostgreSQL
- 自建轻量认证（jose 签名 Cookie）+ qwq-sso 单点登录

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env      # 然后按需修改 .env（至少设置 AUTH_SECRET）

# 3. 初始化数据库（生成表结构）
npx prisma db push

# 4. 启动
npm run dev
```

打开 http://localhost:3000 ，首次访问会引导你**创建管理员（Owner）账号**。

## 主要功能

| 页面 | 说明 |
|------|------|
| 首页 | 今日接口调用量、成功/失败、各渠道分布、最近调用 |
| 渠道配置 | 分发方式(大类) → 分组(二级) → 渠道(三级)；同组多服务商，轮询/调用最少 |
| 模板管理 | 带 `{{变量}}` 的消息模板，按模板编号识别并分发 |
| 测试服务 | 选渠道、填内容一键试发，检验通道有效性 |
| API 管理 | 接口地址、测试/生产密钥、IP 白名单、限速、权限范围 |
| 用户设置 | 修改密码、创建带权限的 IAM 子账号 |

## API 调用

> 📘 **完整对接文档见 [API.md](./API.md)** —— 含所有接口、各渠道参数、错误码、限速、容灾说明与多语言示例。下面是速览。


**接口**：`POST /api/v1/send`
**鉴权**：请求头 `Authorization: Bearer <你的密钥>`

请求体（`group` 与 `template` 二选一定位目标）：

```jsonc
{
  "group": "sms-16",          // 按“分组编号”发送
  // "template": "welcome",   // 或按“模板编号”发送
  "to": "13800000000",        // 接收方（手机号/邮箱/openid，按渠道而定）
  "subject": "标题",          // 邮件用
  "content": "正文内容",       // 直接内容（用 group 时）
  "templateCode": "SMS_123",  // 短信/微信的服务商模板ID
  "variables": { "code": "8888" }  // 模板变量
}
```

示例：

```bash
curl -X POST http://localhost:3000/api/v1/send \
  -H "Authorization: Bearer qwq_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"group":"hook-1","content":"你好，世界"}'
```

返回：`{"success":true,"method":"WEBHOOK","channelId":"...","detail":"..."}`

- **测试密钥**（`qwq_test_`）：无 IP 限制，但有每分钟调用上限（防盗用，管理员可设默认值）
- **生产密钥**（`qwq_live_`）：可设可信 IP 白名单、按分发方式限权

## 渠道实现状态

**已真机验证**：Webhook、SMTP 邮件、企业微信群机器人、火山引擎短信。
**已按官方规范实现、待真实账号验证**：阿里云/腾讯云短信、Zeabur Email、微信公众号、飞书、钉钉。
各渠道所需参数见「渠道配置」页表单。

### Zeabur Email 接入说明
1. 在 Zeabur 控制台的 Email 页面**验证你的发信域名**，并创建 API Key（`zs_` 开头）。
2. 渠道配置里选「Zeabur Email API」，填 API Key 与发件人（必须是已验证域名下的地址）。
3. 收件人支持逗号分隔的多个地址（总数 ≤ 50）。接口文档：
   https://zeabur.com/docs/en-US/email/rest-api

## 一键部署与上架 Zeabur 市场

本仓库自带 Zeabur 模板文件 [`zeabur.yaml`](./zeabur.yaml)（Git 服务 + `/data` 持久卷 +
自动生成 `AUTH_SECRET` + 绑定域名），可直接发布成「一键部署」模板上架 [Zeabur 模板市场](https://zeabur.com/templates)。

本平台**已发布到 Zeabur 市场**：**<https://zeabur.com/templates/I0C9U0>**（README 顶部的部署按钮即指向它）。

**改了 `zeabur.yaml` 后更新模板：**

```bash
# Windows 若 npx 被执行策略拦截，用 npx.cmd 代替 npx
npx.cmd zeabur@latest template update -c I0C9U0 -f zeabur.yaml
```

**从零发布一个新模板（如 fork 到别的仓库）：**

```bash
# 1.（可选）先本地测试模板能否正常部署
npx.cmd zeabur@latest template deploy -f zeabur.yaml

# 2. 发布，返回一个新的【模板码】
npx.cmd zeabur@latest template create -f zeabur.yaml
```

发布后把新模板码填进 README 顶部按钮链接 `https://zeabur.com/templates/<模板码>`。
想要带你个人推荐码的官方按钮：Zeabur 控制台 → 账户 → **Template** → 选中 → **Share** → 复制按钮代码替换即可。

> 模板里 `repo: 1305044949` 对应 GitHub 仓库 `uesrbai/qwq-message`、分支 `master`。
> 若 fork 到别的仓库，改成你自己仓库的数字 repo id（`https://api.github.com/repos/<owner>/<repo>` 里的 `id`）。

## 部署到 Zeabur（手动）

推荐 **SQLite + 持久磁盘**：代码零改动，本地与线上完全一致，适合内部工具。

1. **部署**：在 Zeabur 从本 GitHub 仓库创建服务（自动识别 Next.js）。
2. **挂载持久磁盘**（关键，否则重启数据全丢）：
   服务 → **Volumes** → 新增一块盘，**挂载路径填 `/data`**。
3. **配置环境变量**（服务 → **Variables**）：
   - `DATABASE_URL` = `file:/data/prod.db` ← 必须指向磁盘挂载目录
   - `AUTH_SECRET` = 随机 64 位十六进制串
     （生成：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`）
   - `APP_URL` = 你的线上域名
   - （可选）`QWQ_SSO_*`：用 SSO 时填；生产用 `sk_live_` 并设 `QWQ_SSO_ALLOWED_EMAILS`
4. **重新部署**。启动时会自动建表（`start` 脚本已包含 `prisma db push`）。
5. 打开线上域名，创建管理员账号即可。

> 线上是全新空库，本地配好的渠道**不会**带过去，需在线上重新配一次。

### 备选：改用 PostgreSQL

数据量大或需要多实例时更合适：

1. Zeabur 加一个 PostgreSQL 服务，复制连接串。
2. 把 `prisma/schema.prisma` 的 `provider = "sqlite"` 改成 `"postgresql"`。
3. `DATABASE_URL` 填 Postgres 连接串（`src/lib/db.ts` 会自动切换适配器，无需改代码）。
4. 重新部署，启动时同样会自动建表。

⚠️ 改成 `postgresql` 后，本地的 SQLite 开发环境将无法使用。

## 清理演示数据

本地开发可能建了演示数据（测试账号、示例分组/渠道/模板/密钥）。线上是全新 Postgres，
不会带过去。想清空本地重来：删掉 `dev.db` 再 `npx prisma db push`。

## 安全提示

- **务必设置随机的 `AUTH_SECRET`**（默认值仅用于本地）。
- qwq-sso 生产用 `sk_live_` 密钥，并用 `QWQ_SSO_ALLOWED_EMAILS` 限定可登录邮箱。
- 生产密钥务必设置可信 IP 白名单。

## 开源协议 / License

本项目基于 **[MIT 协议](./LICENSE)** 开源，可自由使用、修改、分发与商用，保留版权与许可声明即可。
