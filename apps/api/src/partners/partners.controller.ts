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
import { Idempotent } from '../common/decorators/idempotent.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { PartnersService } from './partners.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { ListPartnersQueryDto } from './dto/list-partners-query.dto';
import { RejectPartnerDto } from './dto/reject-partner.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // spec §11.1 "Partner Yönetimi" — spec §5'in tablosunda yok, Admin Panel
  // (ADIM 9) kararı. Sabit ':id/tasks' segmentiyle çakışmasın diye NestJS
  // route eşleştirmesinde bu ':id/tasks'tan ÖNCE tanımlı olmak zorunda değil
  // (Nest path'i tam eşleştirir, ':id' tek segment), ama okunabilirlik için
  // en üstte.
  @Roles('ops_manager', 'admin')
  @Get()
  findMany(@Query() query: ListPartnersQueryDto) {
    return this.partnersService.findMany(query);
  }

  @Roles('field_partner')
  @Get(':id/tasks')
  findTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.partnersService.findTasks(id, user, query);
  }

  @Roles('ops_manager', 'admin')
  @Get(':id/payouts')
  findPayouts(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findPayouts(id);
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

  @Roles('ops_manager', 'admin')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.partnersService.approve(id, user);
  }

  @Roles('ops_manager', 'admin')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RejectPartnerDto,
  ) {
    return this.partnersService.reject(id, user, dto);
  }
}
