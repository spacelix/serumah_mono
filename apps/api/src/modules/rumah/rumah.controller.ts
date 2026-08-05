import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahService } from './rumah.service';
import { CreateRumahDto, JoinRumahDto } from './dto/rumah.dto';

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

  @Get('join/preview')
  previewJoin(@Query('kode') kode: string) {
    return this.rumahService.previewJoin(kode ?? '');
  }

  @Post('join')
  join(@CurrentUser() payload: CurrentUserPayload, @Body() dto: JoinRumahDto) {
    return this.rumahService.joinRumah(payload, dto);
  }
}
