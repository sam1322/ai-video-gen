import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { SentryExceptionCaptured } from '@sentry/nestjs';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  private readonly logger = new Logger(CatchEverythingFilter.name); // Instantiate Logger directly

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = {
      statusCode: httpStatus,
      message:
        exception instanceof HttpException
          ? exception.message
          : 'Internal server error',
      error: exception instanceof HttpException ? exception.name : 'Error',
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      timestamp: new Date().toISOString(),
    };
    // console.log("responseBody",responseBody)

    // Log the actual error details
    if (exception instanceof Error) {
      // this.logger.error('Error details:', {
      //   name: exception.name,
      //   message: exception.message,
      //   stack: exception.stack,
      //   path: responseBody.path,
      //   timestamp: responseBody.timestamp,
      // });
      this.logger.error(exception);
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
