import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * SchedulerExceptionFilter
 *
 * 스케줄러 모듈의 모든 에러를 표준 형식으로 변환하는 예외 필터.
 * 응답 형식:
 * {
 *   error: string;      // UPPERCASE_SNAKE 에러 코드
 *   message: string;    // 사용자 친화적 메시지
 *   details?: any;      // 선택적 추가 정보
 *   timestamp: string;  // ISO 8601
 * }
 */
@Catch()
export class SchedulerExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 내부 에러 로깅 (디버깅용)
    if (exception instanceof Error && !(exception instanceof HttpException)) {
      console.error('[SchedulerExceptionFilter] Unhandled error:', exception.message);
      console.error(exception.stack);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse !== null) {
        const resp = exResponse as any;
        error = resp.error || this.statusToErrorCode(status);
        message = resp.message || exception.message;
        details = resp.details;
        if (!details && resp.conflictId) {
          details = { conflictId: resp.conflictId };
        }
      } else {
        message = String(exResponse);
        error = this.statusToErrorCode(status);
      }
    }

    // TypeORM/DB 연결 에러 → 503 Service Unavailable
    if (
      exception instanceof Error &&
      (exception.message.includes('connect') ||
        exception.message.includes('ECONNREFUSED'))
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      error = 'SERVICE_UNAVAILABLE';
      message = '데이터 저장소에 일시적으로 접근할 수 없습니다.';
    }

    response.status(status).json({
      error,
      message,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  private statusToErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_FAILED';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'TOO_MANY_REQUESTS';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
