import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ListrikService } from './listrik.service';
import { CreateListrikDto } from './dto/listrik.dto';

@Controller('listrik')
export class ListrikController {
  constructor(private readonly listrikService: ListrikService) {}

  @Get()
  list(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('bulan') bulan?: string,
  ) {
    return this.listrikService.list(payload, bulan);
  }

  @Post()
  create(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateListrikDto,
  ) {
    return this.listrikService.create(payload, dto);
  }
}
