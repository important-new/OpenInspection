---
domain: "Multi Cloud & Engine Agnostic"
related_code_paths: ["src/ports/", "src/adapters/"]
core_rule: "Never use cloud-specific SDKs natively in core domains. Adhere to WinterCG web standards (Request/Response) and abstract database queries via Drizzle ORM."
---
# 05. 多云支持与去厂商锁定策略 (Multi-Cloud & Cloud-Agnostic Strategy)

为了让开源系统真正实现“不被单一云厂商绑架 (No Vendor Lock-in)”，并且同时可以被部署在 Cloudflare、AWS 或 Google Cloud 等不同平台上，我们的核心系统设计必须引入高度解耦的**云中立方**架构模式。

## 关键架构模式：六边形架构 (Ports and Adapters)

系统绝对禁止将底层云厂商SDK（如 `aws-sdk-s3` 或 `Cloudflare D1 binding`）直接泄露并在核心业务逻辑文件（Core Logic）中硬编码调用。全系统推行强依赖倒置设计：

1. **核心业务域 (Domain Layer)**：纯以 TypeScript 编写的验房检验单与客户管理逻辑，完全“云无感”。
2. **接口规范定义 (Ports)**：定义清晰的操作接口，如 `IStorageProvider`, `IDatabaseProvider`, `IEmailProvider`。
3. **云厂商适配器实现 (Adapters)**：在最外层网关实现具体适配（如 `AWSS3Adapter`, `CloudflareR2Adapter`, `GoogleCloudStorageAdapter`）。运行时根据环境变量动态注入给业务层。

## 无服务器边缘计算的“车同轨”: WinterCG 标准

在计算节点 Runtime 的选择上，为了避免业务代码被死死绑定在特定云厂商奇怪的上下文格式上（例如 AWS Lambda 特有的古怪 `event` json payload 格式）：

* **使用基于 Web 标准的框架 (Hono)**：抛弃厂商专用 HTTP 解析写法。Hono / SonicJS 这种框架完全建立在标准的 Web Request / Response API (WinterCG 提案) 之上。
* **效果**：写好的一份核心路由和网络接收代码，**不用改动一行**，只需引入不同的执行入口（Entrypoint Wrapper），就可以原封不动地跑在：
  - Cloudflare Workers
  - AWS Lambda
  - Google Cloud Functions / Cloud Run
  - 甚至自己家里的 Node.js / Bun 单机物理服务器上

## 数据库方言独立：全量 ORM 引擎

将 SQL 方言的捆绑度降至最低。这非常影响数据在公有云之间的平滑迁移。

* **使用 Drizzle ORM 等现代查询构建器**：业务层面全部用强类型的 ORM 语法书写。
* **透明切换能力**：底层连接池可以通过一个参数开关直接热插拔：
  - 环境 A（免费部署）：选用 Cloudflare D1 Serverless 驱动。
  - 环境 B（海量并发）：切换成 AWS RDS Aurora Serverless v2 PostgreSQL。
  - 环境 C（Google 玩家）：跑在 GCP Cloud SQL 上。

## 基础设施即代码统一化 (Unified IaC)

不要因为一键部署方便就仅依赖特定云的 UI 控制面板或私有构建脚本（如 `wrangler.toml` 仅针对 CF）。

* 更严谨的项目部署策略应当使用支持多云生态的系统构建工具，例如 **Terraform** 或者 **Pulumi**。
* 为社区开源用户提供多套模板：`aws-deployment-stack` (CDK) 与 `cloudflare-deployment-stack` (Wrangler/TF)。

通过以上全方位在计算、存储、数据库和构建层面的“解耦反制”措施，才能使得产品永远保持平台中立的开源核心血液，随时根据云计算计费战哪家便宜便带着全部家当无缝迁移去哪里。
