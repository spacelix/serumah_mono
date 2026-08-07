import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateService } from './update.service';

@Controller('update')
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Public()
  @Get('manifest')
  manifest() {
    return this.updateService.manifest();
  }
}
