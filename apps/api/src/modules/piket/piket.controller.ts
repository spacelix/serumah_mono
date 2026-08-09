import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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

  @Get('submissions')
  listSubmissions(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('status') status?: string,
  ) {
    const resolved = status === 'resolved' ? 'resolved' : 'pending';
    return this.piketService.listSubmissions(payload, resolved);
  }

  @Post('submissions/:id/approve')
  approve(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.piketService.approveSubmission(payload, id);
  }

  @Post('submissions/:id/reject')
  reject(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.piketService.rejectSubmission(payload, id);
  }
}
