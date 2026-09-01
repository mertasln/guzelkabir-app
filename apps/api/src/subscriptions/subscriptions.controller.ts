import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Roles('customer')
  @Idempotent()
  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(user.sub, dto);
  }

  @Roles('customer', 'admin')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.subscriptionsService.cancel(id, user);
  }
}
