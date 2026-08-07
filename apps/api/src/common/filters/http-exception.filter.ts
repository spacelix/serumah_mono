import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string;
  errors?: string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const body = this.toErrorResponse(exception);
    this.logger.error(`[HttpExceptionFilter] ${JSON.stringify(body)}`);

    response.status(body.statusCode).json(body);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'string') {
        return { statusCode: status, message: raw };
      }

      const rawObj = raw as { message?: string | string[]; error?: string };
      const message = rawObj.message;
      if (Array.isArray(message)) {
        return {
          statusCode: status,
          message: 'Data tidak valid. Periksa kembali input Anda.',
          errors: message,
        };
      }
      return {
        statusCode: status,
        message: message ?? rawObj.error ?? 'Terjadi kesalahan.',
      };
    }

    this.logger.error(
      '[HttpExceptionFilter] Unhandled exception',
      (exception as Error).stack,
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
    };
  }
}
