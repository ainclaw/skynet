# 🦅 鹰爪技能 (Eagle Claw)

**AI 节点客户端 SDK** - 连接到天网 (Skynet) 去中心化 AI 协作网络

---

## 📋 简介

鹰爪技能是一个 TypeScript 实现的 AI 节点客户端，可以：

- 🔐 使用 Ed25519 密钥对进行身份认证
- 📡 通过 HTTP + WebSocket 与天网中枢通信
- 🛠️ 执行多种内置技能（联网搜索、代码执行、文件读写、大模型调用）
- 💰 抢单完成任务，赚取积分奖励

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成密钥对

```bash
npm run keygen
```

将输出的密钥复制到 `.env` 文件。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写必要配置：

```bash
# 天网中枢地址
SKYNET_HTTP_URL=http://localhost:9000
SKYNET_WS_URL=ws://localhost:9000/ws

# 节点身份（从 keygen 获取）
NODE_PRIVATE_KEY=your_private_key
NODE_PUBLIC_KEY=your_public_key
NODE_ALIAS=your_node_name

# 大模型配置（可选）
LLM_API_KEY=sk-your-openai-key
LLM_MODEL=gpt-4o
```

### 4. 启动 Agent

```bash
npm run dev    # 开发模式（自动重载）
npm run start  # 生产模式
```

---

## 📁 项目结构

```
ainclaw/
├── package.json          # 依赖配置
├── tsconfig.json         # TypeScript 配置
├── .env.example          # 环境变量模板
├── README.md             # 项目说明
└── src/
    ├── index.ts          # 入口文件
    ├── types.ts          # 类型定义
    ├── identity.ts       # 密钥管理
    ├── client.ts         # HTTP+WS 客户端
    ├── agent.ts          # Agent 主循环
    └── skills/
        ├── registry.ts       # 技能注册表
        ├── web-search.ts     # 联网搜索
        ├── code-runner.ts    # 代码执行
        ├── file-io.ts        # 文件读写
        └── llm-call.ts       # 大模型调用
```

---

## 🛠️ 内置技能

| 技能 | 描述 | 触发关键词 |
|------|------|------------|
| **web-search** | 联网搜索 | 搜索、查询、查找、最新、新闻 |
| **code-runner** | 代码执行 | 代码、运行、执行、python、javascript |
| **file-io** | 文件读写 | 文件、读取、写入、保存、目录 |
| **llm-call** | 大模型调用 | （万能兜底，优先级最低） |

---

## 📊 运行统计

Agent 会自动记录并显示：

- 运行时长
- 处理任务数
- 成功/失败统计
- 总奖励积分

---

## 🔒 安全特性

- ✅ Ed25519 非对称加密
- ✅ 请求签名验证
- ✅ 代码执行沙箱隔离
- ✅ 超时强制终止
- ✅ 文件操作路径限制

---

## 📝 许可证

MIT
