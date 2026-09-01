import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import type { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import { PaymentsService } from './payments.service';
import type { IyzicoWebhookPayload } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles('customer')
  @Idempotent()
  @Post('intent')
  createIntent(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreatePaymentIntentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.createIntent(user, dto, req.ip ?? '0.0.0.0');
  }

  // iyzico Checkout Form'un ikinci onay yolu — müşterinin tarayıcısı ödeme
  // tamamlandıktan hemen sonra buraya bir form POST'u (token alanıyla) ile
  // yönlendirilir (bkz. PaymentsService.handleCallback). Webhook'un yanında
  // bağımsız bir doğrulama yolu, spec'te yok — iyzico'nun kendi akışının
  // gerektirdiği bir uç (kullanıcı kararı, ADIM 6).
  @Public()
  @Post('callback')
  async handleCallback(
    @Body('token') token: string | undefined,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.paymentsService.handleCallback(token);
    res.redirect(HttpStatus.FOUND, redirectUrl);
  }

  // spec §5: "Public (imzalı)" — auth guard'ı bypass eder ama
  // X-IYZ-SIGNATURE-V3 doğrulaması zorunludur (bkz.
  // PaymentsService.handleIyzicoWebhook). iyzico'nun imza şeması ham body
  // byte'ları değil parse edilmiş alanlar üzerinden hesaplandığı için
  // (Stripe'ın aksine) burada normal JSON-parse edilmiş body kullanılıyor —
  // main.ts'teki eski raw-body yönlendirmesi kaldırıldı.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  handleWebhook(
    @Body() body: IyzicoWebhookPayload,
    @Headers('x-iyz-signature-v3') signature: string | undefined,
  ) {
    return this.paymentsService.handleIyzicoWebhook(body, signature);
  }
}
