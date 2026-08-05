import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Anggota } from '@serumah/db';

export interface CurrentUserPayload {
  userId: string;
  email: string;
  role: string;
  rumahId: string | null;
  anggota: Anggota | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: CurrentUserPayload }>();
    return request.user;
  },
);
