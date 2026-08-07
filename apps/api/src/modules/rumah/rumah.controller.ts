import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RumahService } from './rumah.service';
import {
  CreateRumahDto,
  JoinRumahDto,
  SetQrisDto,
  UpdateRumahDto,
} from './dto/rumah.dto';

@Controller('rumah')
export class RumahController {
  constructor(private readonly rumahService: RumahService) {}

  @Post()
  create(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateRumahDto,
  ) {
    return this.rumahService.createRumah(payload, dto);
  }

  @Get('me')
  me(@CurrentUser() payload: CurrentUserPayload) {
    return this.rumahService.getMe(payload);
  }

  @Patch('me')
  @Roles('admin')
  updateMe(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: UpdateRumahDto,
  ) {
    return this.rumahService.updateMe(payload, dto);
  }

  @Post('reset-invite')
  @Roles('admin')
  resetInvite(@CurrentUser() payload: CurrentUserPayload) {
    return this.rumahService.resetInvite(payload);
  }

  @Put('qris')
  @Roles('admin')
  setQris(@CurrentUser() payload: CurrentUserPayload, @Body() dto: SetQrisDto) {
    return this.rumahService.setQris(payload, dto.qrisUrl);
  }

  @Delete('anggota/:id')
  @Roles('admin')
  removeAnggota(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') anggotaId: string,
  ) {
    return this.rumahService.removeAnggota(payload, anggotaId);
  }

  @Get('join/preview')
  previewJoin(@Query('kode') kode: string) {
    return this.rumahService.previewJoin(kode ?? '');
  }

  @Post('join')
  join(@CurrentUser() payload: CurrentUserPayload, @Body() dto: JoinRumahDto) {
    return this.rumahService.joinRumah(payload, dto);
  }

  @Post('leave')
  leave(@CurrentUser() payload: CurrentUserPayload) {
    return this.rumahService.leaveRumah(payload);
  }
}
