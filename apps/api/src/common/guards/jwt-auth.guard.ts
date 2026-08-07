import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const request = this.getRequest(context) as
        { headers?: Record<string, string | string[] | undefined> } | undefined;
      const authHeader = request?.headers?.authorization;
      const auth = typeof authHeader === 'string' ? authHeader : '';
      this.logger.error(
        `[JwtAuthGuard] 401 — reason=${String((err as Error | undefined)?.message ?? 'no-user')} ` +
          `hasAuthHeader=${Boolean(auth) && auth.startsWith('Bearer')}`,
      );
      throw new UnauthorizedException('Sesi berakhir. Silakan masuk kembali.');
    }
    return user;
  }
}
