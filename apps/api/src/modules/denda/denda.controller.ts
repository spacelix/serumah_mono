import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { DendaService } from './denda.service';
import { UploadBuktiDto } from './dto/denda.dto';

@Controller('denda')
export class DendaController {
  constructor(private readonly dendaService: DendaService) {}

  @Get()
  list(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('bulan') bulan?: string,
  ) {
    return this.dendaService.list(payload, bulan);
  }

  @Post(':id/upload-bukti')
  uploadBukti(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UploadBuktiDto,
  ) {
    return this.dendaService.uploadBukti(payload, id, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.dendaService.approve(payload, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.dendaService.reject(payload, id);
  }
}
