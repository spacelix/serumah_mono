import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../../modules/auth/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: payload.sub },
      include: { rumah: true },
    });

    if (!anggota) {
      return {
        userId: payload.sub,
        email: payload.email,
        role: 'anggota',
        rumahId: null,
        anggota: null,
      };
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: anggota.role,
      rumahId: anggota.rumahId,
      anggota,
    };
  }
}
