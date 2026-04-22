# Flowd

Flowd 是一款基于 Next.js 开发的 AI 助手与工作流管理应用，集成了深度学习大模型（如 DeepSeek）以及飞书文档和多维表格的数据同步能力。

## 🚀 部署指南 (Deployment)

本项目已成功迁移并部署在 **[火山引擎 IGA Pages](https://console.volcengine.com/iga)**（IntelliEdge Global Accelerator Pages）平台上。基于 IGA 的全球边缘网络，Flowd 拥有极速的全球访问体验，并且利用 Serverless 函数实现了按需扩容。

### 部署配置与特点

1. **Standalone 模式**
   为适配 IGA Pages 的 Serverless 部署环境，本项目在 `next.config.ts` 中开启了 `output: 'standalone'` 模式。这会极大缩减打包后的依赖体积。
2. **根目录平铺**
   前端代码已直接平铺在仓库根目录下（删除了额外的 `my-app` 文件夹嵌套），从而使得 IGA Pages 默认的构建流程能够正确找到入口和配置。
3. **CI/CD 自动部署**
   已在 IGA Pages 控制台中绑定了 GitHub 仓库。**任何对 `main` 分支的 Push 都会自动触发构建和发布，实现“推送即上线”。**

### 🔑 环境变量配置 (Environment Variables)

如果你要在本地运行或在 IGA Pages 等平台上重新部署，必须配置以下环境变量（在云端控制台或本地的 `.env.local` 文件中）：

```env
# --- 大模型配置 (LLM Configuration) ---
# 必须：用于调用大语言模型（如 DeepSeek-Chat）
LLM_API_KEY=your_llm_api_key_here
LLM_BASE_URL=https://api.deepseek.com
# 可选：如果使用的是 OpenAI 兼容接口，在代码构建时也有 fallback 处理
OPENAI_API_KEY=your_openai_api_key_here

# --- 飞书配置 (Feishu Integration) ---
# 用于实现飞书云文档和多维表格数据的拉取与同步
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret

# --- 系统配置 (System) ---
NEXT_PUBLIC_URL=https://your-production-domain.com # 线上替换为你实际的预览或自定义域名
DEFAULT_MODEL=deepseek-chat
```

> **注意**：如果在构建时（如 `npm run build`）缺少 `OPENAI_API_KEY` 或 `LLM_API_KEY`，项目代码中已设置了自动降级处理（`dummy_key_for_build`），确保能顺利完成静态生成。但在实际运行和访问接口时，必须保证环境变量生效。

## 🛠 本地开发 (Getting Started)

1. 克隆仓库并安装依赖：
   ```bash
   npm install
   ```

2. 启动本地开发服务器：
   ```bash
   npm run dev
   ```

3. 在浏览器中打开 [http://localhost:3000](http://localhost:3000) 即可查看结果。

## 📚 技术栈 (Tech Stack)

- **框架**: [Next.js 14/15](https://nextjs.org/) (App Router)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **AI 赋能**: OpenAI SDK, LangChain (用于调用大语言模型和 Embeddings)
- **数据同步**: 飞书开放平台 API (Feishu Open Platform)
- **部署平台**: 火山引擎 IGA Pages (Volcengine IGA Pages)
