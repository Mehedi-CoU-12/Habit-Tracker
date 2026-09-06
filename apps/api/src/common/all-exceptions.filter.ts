import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

type ErrorShape = {
  status: number;
  message: string | string[];
  error: string;
  // Optional machine-readable discriminator (e.g. ACCOUNT_PENDING) so
  // clients can branch on the reason without parsing human text.
  code?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error, code } = this.normalize(exception);

    const where = `${request?.method} ${request?.url}`;
    if (status >= (HttpStatus.INTERNAL_SERVER_ERROR as number)) {
      this.logger.error(
        `${where} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      const text = Array.isArray(message) ? message.join(', ') : message;
      this.logger.warn(`${where} -> ${status}: ${text}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(code ? { code } : {}),
    });
  }

  private normalize(exception: unknown): ErrorShape {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, message: res, error: exception.name };
      }
      const body = res as {
        message?: string | string[];
        error?: string;
        code?: string;
      };
      return {
        status,
        message: body.message ?? exception.message,
        error: body.error ?? exception.name,
        code: body.code,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromKnownRequestError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Some of the submitted data was invalid.',
        error: 'Bad Request',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our end. Please try again.',
      error: 'Internal Server Error',
    };
  }

  private fromKnownRequestError(
    e: Prisma.PrismaClientKnownRequestError,
  ): ErrorShape {
    switch (e.code) {
      case 'P2002': {
        const target = Array.isArray(e.meta?.target)
          ? (e.meta?.target as string[]).join(', ')
          : undefined;
        return {
          status: HttpStatus.CONFLICT,
          message: target
            ? `A record with this ${target} already exists.`
            : 'A record with these details already exists.',
          error: 'Conflict',
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'The requested record could not be found.',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'This action references a record that does not exist.',
          error: 'Bad Request',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'The database request could not be completed.',
          error: 'Bad Request',
        };
    }
  }
}
