import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Gerçek iyzico Subscription API entegrasyonu (spec §7.2, bkz. CLAUDE.md
  // "Payment provider: iyzico" — Stripe Billing'den daha büyük bir yapısal
  // fark, birebir takas değil) henüz yapılmadı — burada yalnızca abonelik
  // kaydı oluşturuluyor (iyzicoSubscriptionReferenceCode boş kalıyor).
  async create(customerId: string, dto: CreateSubscriptionDto) {
    const graveLocation = await this.prisma.graveLocation.findUnique({
      where: { id: dto.graveLocationId },
    });
    if (!graveLocation) {
      throw new BadRequestException('Belirtilen mezar konumu bulunamadı.');
    }

    return this.prisma.subscription.create({
      data: {
        customerId,
        graveLocationId: dto.graveLocationId,
        plan: dto.plan,
        priceAmount: dto.priceAmount,
        currency: dto.currency,
        nextBillingDate: dto.nextBillingDate
          ? new Date(dto.nextBillingDate)
          : undefined,
      },
    });
  }

  async cancel(subscriptionId: string, user: AccessTokenPayload) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      throw new NotFoundException('Abonelik bulunamadı.');
    }
    if (user.role !== 'admin' && subscription.customerId !== user.sub) {
      throw new ForbiddenException('Bu aboneliği iptal etme yetkiniz yok.');
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'cancelled' },
    });
  }
}
