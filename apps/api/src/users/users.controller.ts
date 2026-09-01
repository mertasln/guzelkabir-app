import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { UsersService } from './users.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { ListStaffUsersQueryDto } from './dto/list-staff-users-query.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Rol kısıtlaması yok — herhangi bir authenticated kullanıcı yalnızca
  // kendi bilgisini görebiliyor (JwtAuthGuard zaten global, @Roles() gerekmiyor).
  @Get('me')
  findMe(@CurrentUser() user: AccessTokenPayload) {
    return this.usersService.findMe(user.sub);
  }

  // spec §6.1: "Admin: ... kullanıcı/rol yönetimi" — yalnızca Admin, Ops
  // Manager/Support Agent'ın rol tablosunda bu yetki YOK.
  @Roles('admin')
  @Get()
  findManyStaff(@Query() query: ListStaffUsersQueryDto) {
    return this.usersService.findManyStaff(query);
  }

  @Roles('admin')
  @Idempotent()
  @Post()
  createStaff(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.usersService.createStaff(dto, user);
  }

  @Roles('admin')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  updateStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffUserDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.usersService.updateStaff(id, dto, user);
  }
}
