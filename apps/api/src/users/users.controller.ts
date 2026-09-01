import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Rol kısıtlaması yok — herhangi bir authenticated kullanıcı yalnızca
  // kendi bilgisini görebiliyor (JwtAuthGuard zaten global, @Roles() gerekmiyor).
  @Get('me')
  findMe(@CurrentUser() user: AccessTokenPayload) {
    return this.usersService.findMe(user.sub);
  }
}
