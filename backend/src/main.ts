import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /* 전역 API 접두사 설정 */
  app.setGlobalPrefix("api/v1");

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 PhotoLite Backend is running on: http://localhost:${port}`);
}

bootstrap();
