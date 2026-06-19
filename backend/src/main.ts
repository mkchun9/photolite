import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import * as path from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** 업로드 디렉토리 절대 경로 */
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // HTTP 보안 헤더 (helmet)
  app.use(helmet());

  // CORS 설정 (프론트엔드 localhost:3000 허용)
  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // 전역 DTO 검증 파이프라인 (class-validator + class-transformer)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 정적 파일 서빙: /uploads 경로로 업로드 디렉토리 제공
  // 전역 API 접두사 설정 전에 등록하여 /uploads 경로가 /api prefix를 받지 않도록 함
  app.use('/uploads', express.static(UPLOADS_DIR));

  // 전역 API 접두사 설정 (/uploads 경로는 제외하여 ThumbnailController가 직접 처리)
  app.setGlobalPrefix('api', {
    exclude: ['uploads/(.*)'],
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 PhotoLite Backend is running on: http://localhost:${port}`);
}

bootstrap();
