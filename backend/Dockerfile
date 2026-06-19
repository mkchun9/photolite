# ============================================
# Stage 1: Builder - Install dependencies & build
# ============================================
FROM node:20-alpine AS builder

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 의존성 설치를 위한 파일 복사 (캐시 레이어 활용)
COPY package.json pnpm-lock.yaml ./

# 의존성 설치 (sharp 네이티브 바인딩 포함)
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY . .

# NestJS 빌드
RUN pnpm build

# ============================================
# Stage 2: Runner - Production image
# ============================================
FROM node:20-alpine AS runner

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production

# 프로덕션 의존성만 설치
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist

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
CMD ["node", "dist/main"]
