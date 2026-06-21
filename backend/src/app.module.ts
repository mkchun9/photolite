import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PhotoModule } from './modules/photo/photo.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { Photo } from './modules/photo/entities/photo.entity';
import { Task } from './modules/scheduler/entities/task.entity';
import { FixedBlock } from './modules/scheduler/entities/fixed-block.entity';
import { ScheduleAllocation } from './modules/scheduler/entities/schedule-allocation.entity';
import { SchedulerSettings } from './modules/scheduler/entities/scheduler-settings.entity';

@Module({
  imports: [
    // 환경변수 로드 (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM + PostgreSQL 연결
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'photolite'),
        password: configService.get<string>('DB_PASSWORD', 'photolite_password'),
        database: configService.get<string>('DB_DATABASE', 'photolite'),
        entities: [Photo, Task, FixedBlock, ScheduleAllocation, SchedulerSettings],
        synchronize: configService.get<string>('DB_SYNC', 'false') === 'true',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // Photo 모듈
    PhotoModule,

    // Scheduler 모듈 (SmartScheduler - 업무 우선순위 자동 관리)
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
