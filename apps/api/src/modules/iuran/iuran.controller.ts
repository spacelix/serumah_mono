import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IuranService } from './iuran.service';
import {
  EnsureBulanDto,
  PelunasanDto,
  UploadBuktiTotalDto,
} from './dto/iuran.dto';

@Controller('iuran')
export class IuranController {
  constructor(private readonly iuranService: IuranService) {}

  @Get()
  list(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('bulan') bulan?: string,
  ) {
    return this.iuranService.list(payload, bulan);
  }

  @Post('ensure-bulan')
  ensureBulan(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: EnsureBulanDto,
  ) {
    return this.iuranService.ensureBulanApi(payload, dto);
  }

  @Post('upload-bukti-total')
  uploadBuktiTotal(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: UploadBuktiTotalDto,
  ) {
    return this.iuranService.uploadBuktiTotal(payload, dto);
  }

  @Post(':id/confirm-lunas')
  @Roles('admin')
  confirmLunas(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.iuranService.confirmLunas(payload, id);
  }

  @Post('pelunasan')
  @Roles('admin')
  pelunasan(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: PelunasanDto,
  ) {
    return this.iuranService.pelunasan(payload, dto);
  }
}
