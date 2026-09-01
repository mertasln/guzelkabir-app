import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { CemeteriesService } from './cemeteries.service';
import { SearchCemeteriesQueryDto } from './dto/search-cemeteries-query.dto';
import { ListCemeteriesQueryDto } from './dto/list-cemeteries-query.dto';
import { CreateCemeteryDto } from './dto/create-cemetery.dto';
import { UpdateCemeteryDto } from './dto/update-cemetery.dto';

@Controller('cemeteries')
export class CemeteriesController {
  constructor(private readonly cemeteriesService: CemeteriesService) {}

  @Public()
  @Get('search')
  search(@Query() query: SearchCemeteriesQueryDto) {
    return this.cemeteriesService.search(query);
  }

  // spec §11.1 "Mezarlık & İzin Yönetimi" — admin-only tam liste, search()'ten
  // AYRI (bkz. CemeteriesService.search yorumu). Sabit 'search' segmentiyle
  // çakışmıyor (Nest tam path eşleştirir).
  @Roles('ops_manager', 'admin')
  @Get()
  findManyAdmin(@Query() query: ListCemeteriesQueryDto) {
    return this.cemeteriesService.findManyAdmin(query);
  }

  // spec §5'in tablosunda yok — önceden hiç oluşturma ucu yoktu (bkz.
  // CreateCemeteryDto yorumu).
  @Roles('ops_manager', 'admin')
  @Idempotent()
  @Post()
  create(
    @Body() dto: CreateCemeteryDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.cemeteriesService.create(dto, user);
  }

  // spec §5'in tablosunda yok — ADIM 7 kararı (bkz. CemeteriesService.update
  // yorumu). Admin Panel Phase 8: permitStatus/permitDocumentUrl için
  // GENİŞLETİLDİ, yeni bir endpoint açılmadı (kullanıcı talimatı).
  @Roles('ops_manager', 'admin')
  @Idempotent()
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCemeteryDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.cemeteriesService.update(id, dto, user);
  }
}
