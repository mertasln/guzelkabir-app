import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { IYZICO_CLIENT } from './iyzico.constants';

/**
 * identityNumber (TC Kimlik No/pasaport) hiçbir hata mesajına sızmamalı —
 * kullanıcı isteği (ADIM 6). iyzico'nun gerçek hata metinleri bu değeri
 * yansıtmayabilir (bu yüzden e2e'de trivially geçebilir) — bu testte iyzico
 * SDK'sı kasıtlı olarak identityNumber'ı hata mesajına gömen bir mock ile
 * taklit ediliyor, redaction'ın gerçekten çalıştığı deterministik olarak
 * doğrulanıyor.
 */
describe('PaymentsService — identityNumber redaction', () => {
  const IDENTITY_NUMBER = '11111111111';

  async function buildService(iyzicoMock: {
    checkoutFormInitialize: { create: jest.Mock };
    checkoutForm: { retrieve: jest.Mock };
  }) {
    const prismaMock = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerId: 'user-1',
          status: 'draft',
          priceAmount: { toFixed: () => '850.00' },
          currency: 'TRY',
          orderNumber: '#MB-TEST-1',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          fullName: 'Test Kullanıcı',
          email: 'test@example.com',
          phone: '+905551234567',
        }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: IYZICO_CLIENT, useValue: iyzicoMock },
      ],
    }).compile();

    return moduleRef.get(PaymentsService);
  }

  it('redacts identityNumber from a business-logic error returned by iyzico', async () => {
    const iyzicoMock = {
      checkoutFormInitialize: {
        create: jest.fn(
          (_params: unknown, cb: (error: Error | null, res: unknown) => void) =>
            cb(null, {
              status: 'failure',
              errorMessage: `geçersiz identityNumber: ${IDENTITY_NUMBER}`,
            }),
        ),
      },
      checkoutForm: { retrieve: jest.fn() },
    };
    const service = await buildService(iyzicoMock);

    try {
      await service.createIntent(
        { sub: 'user-1', role: 'customer' },
        {
          orderId: 'order-1',
          identityNumber: IDENTITY_NUMBER,
          billingAddress: 'Örnek Mahalle',
          billingCity: 'İstanbul',
          billingCountry: 'Türkiye',
        },
        '127.0.0.1',
      );
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const message = (err as BadRequestException).message;
      expect(message).not.toContain(IDENTITY_NUMBER);
      expect(message).toContain('***');
    }
  });

  it('redacts identityNumber from a transport-level error thrown by the iyzico SDK', async () => {
    const iyzicoMock = {
      checkoutFormInitialize: {
        create: jest.fn(
          (_params: unknown, cb: (error: Error | null, res: unknown) => void) =>
            cb(
              new Error(
                `connect failed while sending identityNumber=${IDENTITY_NUMBER}`,
              ),
              null,
            ),
        ),
      },
      checkoutForm: { retrieve: jest.fn() },
    };
    const service = await buildService(iyzicoMock);

    try {
      await service.createIntent(
        { sub: 'user-1', role: 'customer' },
        {
          orderId: 'order-1',
          identityNumber: IDENTITY_NUMBER,
          billingAddress: 'Örnek Mahalle',
          billingCity: 'İstanbul',
          billingCountry: 'Türkiye',
        },
        '127.0.0.1',
      );
      fail('should have thrown');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(IDENTITY_NUMBER);
      expect(message).toContain('***');
    }
  });
});
