import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
} from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    this.logger.log(`[AuthService] User terdaftar: ${user.id}`);
    return {
      token: this.signToken(user.id, user.email),
      user: this.toUser(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    return {
      token: this.signToken(user.id, user.email),
      user: this.toUser(user),
    };
  }

  logout() {
    return { success: true };
  }

  async me(payload: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { anggota: true },
    });
    return {
      user: user ? this.toUser(user) : null,
      anggota: user?.anggota ?? null,
    };
  }

  async changePassword(payload: CurrentUserPayload, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }

    const valid = await bcrypt.compare(dto.passwordLama, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Password lama salah.');
    }

    const passwordHash = await bcrypt.hash(dto.passwordBaru, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.logger.log(`[AuthService] Password diubah: ${user.id}`);
    return { success: true };
  }

  private signToken(userId: string, email: string): string {
    const payload: JwtPayload = { sub: userId, email };
    return this.jwt.sign(payload);
  }

  private toUser(user: { id: string; email: string }): {
    id: string;
    email: string;
  } {
    return { id: user.id, email: user.email };
  }
}
