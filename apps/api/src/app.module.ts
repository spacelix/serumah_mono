import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@serumah/db/prisma';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { StorageModule } from './modules/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { RumahModule } from './modules/rumah/rumah.module';
import { RuanganModule } from './modules/ruangan/ruangan.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { PiketModule } from './modules/piket/piket.module';
import { DendaModule } from './modules/denda/denda.module';
import { IuranModule } from './modules/iuran/iuran.module';
import { ListrikModule } from './modules/listrik/listrik.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NestScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret',
      }),
    }),
    StorageModule,
    AuthModule,
    ProfileModule,
    RumahModule,
    RuanganModule,
    ScheduleModule,
    PiketModule,
    DendaModule,
    IuranModule,
    ListrikModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
