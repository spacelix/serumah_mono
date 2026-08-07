import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { adminPage } from './admin-page';
import {
  LogViewerService,
  type LogsResponse,
  type StatsResponse,
} from './logviewer.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly logViewer: LogViewerService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(@Res() res: Response): void {
    res.send(adminPage());
  }

  @Public()
  @Get('stats')
  stats(@Query('days') days?: string): Promise<StatsResponse> {
    const parsed = Number(days);
    return this.logViewer.stats(
      Number.isInteger(parsed) && parsed > 0 ? parsed : 7,
    );
  }

  @Public()
  @Get('logs')
  logs(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<LogsResponse> {
    return this.logViewer.logs({
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      method,
      status,
      search,
    });
  }
}
