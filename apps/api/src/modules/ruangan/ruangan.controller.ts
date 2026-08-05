import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RuanganService } from './ruangan.service';
import {
  CreateJenisPiketDto,
  CreateRuanganDto,
  ReorderRuanganDto,
  UpdateJenisPiketDto,
  UpdateRuanganDto,
} from './dto/ruangan.dto';

@Controller('ruangan')
export class RuanganController {
  constructor(private readonly ruanganService: RuanganService) {}

  @Get()
  list(@CurrentUser() payload: CurrentUserPayload) {
    return this.ruanganService.listRuangan(payload);
  }

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateRuanganDto,
  ) {
    return this.ruanganService.createRuangan(payload, dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') ruanganId: string,
    @Body() dto: UpdateRuanganDto,
  ) {
    return this.ruanganService.updateRuangan(payload, ruanganId, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') ruanganId: string,
  ) {
    return this.ruanganService.deleteRuangan(payload, ruanganId);
  }

  @Put('reorder')
  @Roles('admin')
  reorder(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: ReorderRuanganDto,
  ) {
    return this.ruanganService.reorderRuangan(payload, dto);
  }

  @Get(':id/jenis')
  listJenis(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') ruanganId: string,
  ) {
    return this.ruanganService.listJenisPiket(payload, ruanganId);
  }

  @Post(':id/jenis')
  @Roles('admin')
  createJenis(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') ruanganId: string,
    @Body() dto: CreateJenisPiketDto,
  ) {
    return this.ruanganService.createJenisPiket(payload, ruanganId, dto);
  }

  @Patch('jenis/:jenisId')
  @Roles('admin')
  updateJenis(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('jenisId') jenisId: string,
    @Body() dto: UpdateJenisPiketDto,
  ) {
    return this.ruanganService.updateJenisPiket(payload, jenisId, dto);
  }

  @Delete('jenis/:jenisId')
  @Roles('admin')
  removeJenis(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('jenisId') jenisId: string,
  ) {
    return this.ruanganService.deleteJenisPiket(payload, jenisId);
  }
}
