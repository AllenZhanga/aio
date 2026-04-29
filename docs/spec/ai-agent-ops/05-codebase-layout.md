# Aio 代码仓库与目录建议

## 1. 代码放置结论

`Aio` 应作为独立服务开发

## 2. 推荐仓库结构

独立仓库建议采用单仓库单镜像结构：

```text
aio/
  README.md
  Dockerfile
  docker-compose.yml
  docker-compose.external.yml
  .env.example

  apps/
    server/
      src/
      migrations/
      tests/
    web/
      src/
      public/
      tests/

  packages/
    shared/
    sdk-js/
    sdk-java/

  deploy/
    embedded/
    external/
    scripts/
      backup.sh
      restore.sh
      migrate.sh

  docs/
    api/
    deployment/
    integration/
```

说明：

1. `apps/server` 承载 API Server、Runtime、Worker Runtime。
2. `apps/web` 承载管理控制台，构建后打进同一个 `aio` 镜像。
3. `packages/shared` 放共享类型、协议、JSON Schema。
4. `packages/sdk-java` 可给 Joget 或 Java 业务系统调用。
5. `deploy` 放私有化部署、备份、恢复、升级脚本。

## 3. 单镜像构建方式

虽然源码里可以拆 `server` 和 `web`，但交付镜像只产出一个：

```text
dxnow/aio:${VERSION}
```

镜像内包含：

1. Web 静态资源。
2. API Server。
3. Worker Runtime。
4. Migration 和初始化脚本。

容器对外只暴露一个主端口，例如：

```text
8080
```

访问路径建议：

| 路径 | 说明 |
| --- | --- |
| `/` | Web 控制台 |
| `/api/aio/admin` | 管理 API |
| `/v1` | 对外运行 API |
| `/health` | 健康检查 |
| `/metrics` | 监控指标，可选 |

## 5. 技术栈建议

为了最快落地，推荐两种路线。

### 5.1 Java/Spring Boot 路线

适合当前团队 Java 经验较强、希望和企业系统集成稳定。

建议：

1. `server`：Spring Boot 3
2. `web`：React/Vue + Vite
3. 数据库迁移：Flyway
4. 队列：Redis stream 或 BullMQ 替代方案需谨慎
5. API 文档：OpenAPI
6. 镜像：多阶段 Dockerfile，前端构建产物复制到后端静态目录

### 5.2 TypeScript/NestJS 路线

适合希望前后端类型共享、快速做 API 和 SDK。

建议：

1. `server`：NestJS
2. `web`：React/Vue + Vite
3. ORM：Prisma 或 Drizzle
4. 队列：BullMQ
5. API 文档：OpenAPI
6. 镜像：多阶段 Dockerfile

## 6. 第一阶段最小开发顺序

1. 新建独立仓库和单镜像 Dockerfile。
2. 建 `server` 的健康检查、配置加载、数据库 migration。
3. 建租户、用户、API Key、Provider 管理。
4. 建 `ai_apps`、`ai_app_versions`、`ai_runs`、`ai_traces`。
5. 实现 Agent Chat API。
6. 实现 Wait Task API。
7. 把 Web 控制台打包进同一个镜像。
8. 在当前 `dxnow-ioa` 仓库只实现 API Client 和 webhook 集成。
