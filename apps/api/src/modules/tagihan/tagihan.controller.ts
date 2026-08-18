import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TagihanService } from './tagihan.service';

@Controller('tagihan')
export class TagihanController {
  constructor(private readonly tagihanService: TagihanService) {}

  /** Months that have any tagihan-related data for the member's rumah. */
  @Get('months')
  listMonths(@CurrentUser() payload: CurrentUserPayload) {
    return this.tagihanService.listMonths(payload);
  }
}
