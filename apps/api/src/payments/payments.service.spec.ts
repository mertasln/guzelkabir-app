import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { IYZICO_CLIENT } from './iyzico.constants';
import { AuditLogService } from '../common/audit-log/audit-log.service';

// Bu testler finalizePayment'a (dolayısıyla audit_log yazımına) hiç
// dokunmuyor — gerçek AuditLogService yerine boş bir mock yeterli, NestJS
// yalnızca constructor'ın çözülebilmesi için gerektiriyor.
const auditLogMock = { record: jest.fn().mockResolvedValue(undefined) };

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
        { provide: AuditLogService, useValue: auditLogMock },
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

/**
 * PaymentsService.refund() — Admin Panel Phase 6 (Şikayet Yönetimi). Gerçek
 * iyzico sandbox anahtarı yok (bkz. CLAUDE.md), bu yüzden SDK burada da
 * mock'lanıyor — payment.amount/currency/paymentTransactionId'nin doğru
 * şekilde iyzico.refund.create'e geçtiğini ve sonucun payment.status'e
 * doğru yansıdığını deterministik olarak doğruluyor.
 */
describe('PaymentsService — refund()', () => {
  function buildPaymentMock(overrides: Record<string, unknown> = {}) {
    return {
      id: 'payment-1',
      orderId: 'order-1',
      providerPaymentIntentId: 'token-abc',
      amount: { toFixed: () => '850.00' },
      currency: 'TRY',
      status: 'succeeded',
      ...overrides,
    };
  }

  async function buildService(
    iyzicoOverrides: Partial<{
      checkoutForm: { retrieve: jest.Mock };
      refund: { create: jest.Mock };
    }> = {},
    paymentOverrides: Record<string, unknown> = {},
  ) {
    const paymentUpdate = jest.fn().mockResolvedValue(undefined);
    const prismaMock = {
      payment: {
        findFirst: jest
          .fn()
          .mockResolvedValue(buildPaymentMock(paymentOverrides)),
        update: paymentUpdate,
      },
    };
    const iyzicoMock = {
      checkoutForm: {
        retrieve: jest.fn(
          (_params: unknown, cb: (error: Error | null, res: unknown) => void) =>
            cb(null, {
              status: 'success',
              itemTransactions: [{ paymentTransactionId: 'txn-123' }],
            }),
        ),
      },
      refund: {
        create: jest.fn(
          (_params: unknown, cb: (error: Error | null, res: unknown) => void) =>
            cb(null, { status: 'success' }),
        ),
      },
      ...iyzicoOverrides,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: IYZICO_CLIENT, useValue: iyzicoMock },
        { provide: AuditLogService, useValue: auditLogMock },
      ],
    }).compile();

    return {
      service: moduleRef.get(PaymentsService),
      iyzicoMock,
      paymentUpdate,
    };
  }

  it('calls iyzico.refund.create with the item-level paymentTransactionId (not the top-level paymentId) and marks the payment refunded', async () => {
    const { service, iyzicoMock, paymentUpdate } = await buildService();

    await service.refund('order-1', 'Şikayet çözümü: iade');

    expect(iyzicoMock.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentTransactionId: 'txn-123',
        price: '850.00',
        currency: 'TRY',
        description: 'Şikayet çözümü: iade',
      }),
      expect.any(Function),
    );
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'refunded' },
    });
  });

  it('throws if no succeeded payment exists for the order', async () => {
    const prismaMock = {
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: IYZICO_CLIENT,
          useValue: {
            checkoutForm: { retrieve: jest.fn() },
            refund: { create: jest.fn() },
          },
        },
        { provide: AuditLogService, useValue: auditLogMock },
      ],
    }).compile();
    const service = moduleRef.get(PaymentsService);

    await expect(service.refund('order-1', 'x')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws if the checkout form retrieve response has no itemTransactions (paymentTransactionId missing)', async () => {
    const { service } = await buildService({
      checkoutForm: {
        retrieve: jest.fn(
          (_params: unknown, cb: (error: Error | null, res: unknown) => void) =>
            cb(null, { status: 'success', itemTransactions: [] }),
        ),
      },
    });

    await expect(service.refund('order-1', 'x')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws with the iyzico error message when the refund call itself fails', async () => {
    const { service } = await buildService({
      refund: {
        create: jest.fn(
          (_params: unknown, cb: (error: Error | null, res: unknown) => void) =>
            cb(null, { status: 'failure', errorMessage: 'yetersiz bakiye' }),
        ),
      },
    });

    await expect(service.refund('order-1', 'x')).rejects.toThrow(
      'yetersiz bakiye',
    );
  });
});
