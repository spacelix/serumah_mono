import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/profile.dto';

@Controller('anggota')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  me(@CurrentUser() payload: CurrentUserPayload) {
    return this.profileService.getProfile(payload);
  }

  @Put('me/profile')
  updateProfile(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(payload, dto);
  }

  @Get('me/stats')
  stats(@CurrentUser() payload: CurrentUserPayload) {
    return this.profileService.getStats(payload);
  }
}
