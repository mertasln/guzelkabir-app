import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { PartnersService } from './partners.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Roles('field_partner')
  @Get(':id/tasks')
  findTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.partnersService.findTasks(id, user, query);
  }

  @Roles('field_partner')
  @HttpCode(HttpStatus.OK)
  @Post('onboarding')
  submitOnboarding(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: OnboardingDto,
  ) {
    return this.partnersService.submitOnboarding(user.sub, dto);
  }
}
