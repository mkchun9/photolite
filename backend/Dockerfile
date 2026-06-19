# ============================================
# Stage 1: Builder - Install dependencies & build
# ============================================
FROM node:22-alpine AS builder

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 의존성 설치를 위한 파일 복사 (캐시 레이어 활용)
COPY package.json pnpm-lock.yaml .npmrc ./

# 전체 의존성 설치 (빌드에 devDependencies 필요)
RUN pnpm install --frozen-lockfile --node-linker=hoisted

# 소스 코드 복사
COPY . .

# NestJS 빌드
RUN pnpm build

# 프로덕션 의존성만 재설치 (runner로 복사할 node_modules)
RUN rm -rf node_modules && pnpm install --frozen-lockfile --prod --node-linker=hoisted

# ============================================
# Stage 2: Runner - Production image
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production

# builder에서 프로덕션 node_modules 복사
COPY --from=builder /app/node_modules ./node_modules

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist

# package.json 복사 (메타데이터 참조용)
COPY package.json ./

# uploads 디렉터리 생성
RUN mkdir -p /app/uploads

# 비root 사용자로 실행 (보안)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    chown -R nestjs:nodejs /app/uploads

USER nestjs

# 포트 노출
EXPOSE 3001

# 앱 실행
CMD ["node", "dist/main.js"]
