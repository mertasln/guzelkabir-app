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
import { ComplaintsService } from './complaints.service';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  // spec §6.1: Ops Manager + Support Agent'ın "şikayet yönetimi" yetkisi.
  @Roles('ops_manager', 'support_agent', 'admin')
  @Get()
  findMany(@Query() query: ListComplaintsQueryDto) {
    return this.complaintsService.findMany(query);
  }

  @Roles('ops_manager', 'support_agent', 'admin')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/investigate')
  investigate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.complaintsService.investigate(id, user);
  }

  @Roles('ops_manager', 'support_agent', 'admin')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/resolve')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.complaintsService.resolve(id, user, dto);
  }

  // yalnızca ops_manager/admin — gerçek para hareketi (bkz.
  // ComplaintsService.processRefund yorumu, kullanıcı kararı).
  @Roles('ops_manager', 'admin')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/process-refund')
  processRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.complaintsService.processRefund(id, user);
  }
}
