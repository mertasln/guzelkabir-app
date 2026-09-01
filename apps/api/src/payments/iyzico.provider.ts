import { Provider } from '@nestjs/common';
import Iyzipay from 'iyzipay';
import { IYZICO_CLIENT } from './iyzico.constants';

// İstemci kurulumu (constructor) ağ çağrısı yapmaz — yalnızca gerçek bir API
// çağrısı (checkoutFormInitialize.create) yapıldığında IYZICO_API_KEY/
// IYZICO_SECRET_KEY'in geçerli olması gerekir. Bu sandbox'ta yalnızca
// placeholder anahtarlar var (bkz. .env.example) — uygulama açılır, ama
// gerçek ödeme çağrıları gerçek anahtarlar olmadan başarısız olur (beklenen).
export const iyzicoProvider: Provider = {
  provide: IYZICO_CLIENT,
  useFactory: () =>
    new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY ?? 'sandbox-placeholder-api-key',
      secretKey:
        process.env.IYZICO_SECRET_KEY ?? 'sandbox-placeholder-secret-key',
      uri: process.env.IYZICO_URI ?? 'https://sandbox-api.iyzipay.com',
    }),
};
