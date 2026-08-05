import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SwapService } from './swap.service';
import { CreateSwapDto } from './dto/swap.dto';

@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Get()
  list(@CurrentUser() payload: CurrentUserPayload) {
    return this.swapService.list(payload);
  }

  @Get('available-days')
  availableDays(@CurrentUser() payload: CurrentUserPayload) {
    return this.swapService.availableDays(payload);
  }

  @Post()
  create(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateSwapDto,
  ) {
    return this.swapService.create(payload, dto);
  }

  @Post(':id/accept')
  accept(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.swapService.accept(payload, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.swapService.reject(payload, id);
  }
}
