import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PartnersModule } from './partners/partners.module';
import { CemeteriesModule } from './cemeteries/cemeteries.module';
import { KpiModule } from './kpi/kpi.module';
import { SlaModule } from './sla/sla.module';
import { GraveLocationsModule } from './grave-locations/grave-locations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    SubscriptionsModule,
    PartnersModule,
    CemeteriesModule,
    KpiModule,
    SlaModule,
    GraveLocationsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global: her route varsayılan olarak korumalı (spec §6) — @Public() ile
    // işaretlenmemiş her endpoint geçerli bir access token ister. RolesGuard,
    // JwtAuthGuard'ın req.user'ı doldurmasından sonra çalışır (sıra önemli).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // spec §5.1: Idempotency-Key desteği — yalnızca @Idempotent() ile
    // işaretlenmiş handler'larda devreye girer (bkz. common/decorators).
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
