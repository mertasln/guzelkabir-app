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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { CreateEvidenceUploadUrlDto } from './dto/create-evidence-upload-url.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles('customer')
  @Idempotent()
  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  // Rol kontrolü burada değil, serviste: Owner(customer)/Ops/Admin (spec §5).
  // field_partner ADIM 8 eklentisi — bkz. OrdersService.findOneForUser yorumu.
  @Roles('customer', 'ops_manager', 'admin', 'field_partner')
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.ordersService.findOneForUser(id, user);
  }

  // spec tablosu yalnızca Ops/Admin diyor; Customer'a kendi siparişleriyle
  // sınırlı erişim ADIM 4 özetinde bildirilen bilinçli bir yorum genişletmesi
  // (bkz. OrdersService.findMany yorumu).
  @Roles('customer', 'ops_manager', 'admin')
  @Get()
  findMany(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.findMany(user, query);
  }

  @Roles('ops_manager', 'admin')
  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignOrderDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.ordersService.assign(id, dto, user);
  }

  // spec §11.1 "Sipariş Yönetimi: sipariş detay sayfası (zaman
  // çizelgesi/audit trail görünümü)" — Admin Panel, ADIM 9.
  @Roles('ops_manager', 'admin')
  @Get(':id/audit')
  findAuditTrail(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findAuditTrail(id);
  }

  // spec §5'in tablosunda yok — §21.2 durum makinesinin assigned→in_progress
  // kenarını dolduran, tespit edilmiş bir boşluk (bkz. OrdersService.start).
  //
  // @Idempotent() ADIM 8b eklentisi: saha PWA'sının offline-first kuyruğu
  // (bkz. apps/field-pwa/src/lib/queue.ts) bir aksiyonu, ağ isteği yarıda
  // kesilirse (sekme kapanırsa) güvenle YENİDEN dener — sunucunun isteği
  // gerçekten işleyip işlemediğini istemci bilemez. Idempotency-Key olarak
  // kuyruk kaydının kendi (bir kez üretilen, tüm denemelerde sabit) id'si
  // gönderilir; aynı key ile tekrar edilen istek yeniden çalıştırılmaz,
  // önbellekteki ilk sonucu döner (bkz. IdempotencyInterceptor).
  @Roles('field_partner')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/start')
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.ordersService.start(id, user);
  }

  // spec §5'in tablosunda yok, spec §8.1 madde 14'ün gerektirdiği bir uç —
  // istemci fotoğrafı doğrudan buradan dönen presigned URL'e yükler (bkz.
  // OrdersService.createEvidenceUploadUrl).
  @Roles('field_partner')
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/evidence/upload-url')
  createEvidenceUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateEvidenceUploadUrlDto,
  ) {
    return this.ordersService.createEvidenceUploadUrl(
      id,
      user,
      dto.contentSha256,
    );
  }

  // @Idempotent(): bkz. start() yorumu — evidence_photos'a çift satır
  // yazılmasını önler (offline kuyruk, "yüklendi mi emin değilim" durumunda
  // her zaman yeniden dener).
  @Roles('field_partner')
  @Idempotent()
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/evidence')
  addEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateEvidenceDto,
  ) {
    return this.ordersService.addEvidence(id, user, dto);
  }

  // @Idempotent(): bkz. start() yorumu.
  @Roles('field_partner')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Post(':id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.ordersService.complete(id, user);
  }

  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.ordersService.approve(id, user);
  }

  @Roles('customer')
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/complaint')
  addComplaint(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.ordersService.addComplaint(id, user, dto);
  }
}
