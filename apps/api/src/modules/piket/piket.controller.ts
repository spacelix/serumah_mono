import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PiketService } from './piket.service';
import { CreateSubmissionDto } from './dto/piket.dto';

@Controller('piket')
export class PiketController {
  constructor(private readonly piketService: PiketService) {}

  @Get('today')
  getToday(@CurrentUser() payload: CurrentUserPayload) {
    return this.piketService.getToday(payload);
  }

  @Post('submissions')
  createSubmission(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.piketService.createSubmission(payload, dto);
  }
}
