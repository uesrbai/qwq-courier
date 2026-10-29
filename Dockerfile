# QWQCourier —— 生产镜像（多阶段）。任何支持 Docker 的平台/自建 PaaS 均可运行。
#   构建: docker build -t qwq-courier .
#   运行: docker run -p 3000:3000 -e AUTH_SECRET=<随机串> -v qwq-data:/data qwq-courier
# 数据默认用 SQLite 存在 /data 持久卷；接 Postgres 见 README。

# ---------- 构建阶段（含原生编译工具链，better-sqlite3 需要）----------
FROM node:20-bookworm AS build
WORKDIR /app

# 先拷依赖清单 + prisma（postinstall 的 `prisma generate` 需要 schema 与配置）
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# 再拷其余源码并构建
COPY . .
RUN npm run build

# ---------- 运行阶段（精简镜像）----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# 默认 SQLite 于持久卷；平台可用环境变量覆盖为 Postgres 连接串
ENV DATABASE_URL=file:/data/qwq.db
ENV PORT=3000

# 从构建阶段拷入运行所需产物（含已编译的 better-sqlite3 与 prisma 引擎）
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /data
EXPOSE 3000
VOLUME ["/data"]

# 启动：先同步表结构（失败也继续启动），再起 Next。见 package.json 的 start 脚本
CMD ["npm", "run", "start"]
