// `iyzipay` (iyzico'nun resmi Node.js SDK'sı, npm) TypeScript tipleri yayınlamıyor
// (@types/iyzipay de yok) — burada yalnızca bu modülün kullandığı yüzeyin asgari,
// elle yazılmış bir bildirimi var. node_modules/iyzipay/lib/*.js kaynağından
// doğrulandı (bkz. PaymentsService yorumları).
declare module 'iyzipay' {
  interface IyzipayConfig {
    apiKey: string;
    secretKey: string;
    uri: string;
  }

  interface IyzipayBuyer {
    id: string;
    name: string;
    surname: string;
    identityNumber: string;
    email: string;
    gsmNumber: string;
    registrationAddress: string;
    city: string;
    country: string;
    zipCode?: string;
    ip: string;
  }

  interface IyzipayAddress {
    address: string;
    zipCode?: string;
    contactName: string;
    city: string;
    country: string;
  }

  interface IyzipayBasketItem {
    id: string;
    price: string;
    name: string;
    category1: string;
    itemType: string;
  }

  interface CheckoutFormInitializeRequest {
    locale: string;
    conversationId: string;
    price: string;
    paidPrice: string;
    currency: string;
    basketId: string;
    paymentGroup: string;
    callbackUrl: string;
    buyer: IyzipayBuyer;
    shippingAddress: IyzipayAddress;
    billingAddress: IyzipayAddress;
    basketItems: IyzipayBasketItem[];
  }

  interface CheckoutFormInitializeResult {
    status: string;
    errorCode?: string;
    errorMessage?: string;
    token?: string;
    checkoutFormContent?: string;
    paymentPageUrl?: string;
  }

  interface CheckoutFormRetrieveRequest {
    locale: string;
    conversationId: string;
    token: string;
  }

  // itemTransactions[].paymentTransactionId (SEPET KALEMİ bazlı, üstteki
  // paymentId'den FARKLI) — refund çağrısının anahtarladığı gerçek alan.
  // node_modules/iyzipay/test/unit/PayWithIyzicoTest.js'in mock retrieve
  // yanıtından doğrulandı (Admin Panel Phase 6 araştırması).
  interface IyzipayItemTransaction {
    itemId?: string;
    paymentTransactionId?: string;
    price?: string;
  }

  interface CheckoutFormRetrieveResult {
    status: string;
    errorCode?: string;
    errorMessage?: string;
    paymentId?: string;
    paymentStatus?: string;
    fraudStatus?: number;
    price?: string;
    paidPrice?: string;
    currency?: string;
    basketId?: string;
    itemTransactions?: IyzipayItemTransaction[];
  }

  // node_modules/iyzipay/lib/requests/CreateRefundRequest.js'ten birebir
  // (v1 /payment/refund — checkout form akışıyla eşleşen sürüm, v2'nin
  // paymentId bazlı varyantı DEĞİL, bkz. PaymentsService.refund yorumu).
  interface RefundRequest {
    locale: string;
    conversationId: string;
    paymentTransactionId: string;
    price: string;
    ip: string;
    currency: string;
    reason?: string;
    description?: string;
  }

  // Yanıt alanları SDK kaynağında tiplenmemiş (ham JSON passthrough) —
  // iyzico'nun standart zarfı (status/errorCode/errorMessage) dışındaki
  // alanlar doğrulanmadı, savunmacı ele alınmalı.
  interface RefundResult {
    status: string;
    errorCode?: string;
    errorMessage?: string;
    paymentId?: string;
    price?: string;
    currency?: string;
  }

  type IyzipayCallback<T> = (error: Error | null, result: T) => void;

  class Iyzipay {
    constructor(config: IyzipayConfig);
    checkoutFormInitialize: {
      create(
        params: CheckoutFormInitializeRequest,
        callback: IyzipayCallback<CheckoutFormInitializeResult>,
      ): void;
    };
    checkoutForm: {
      retrieve(
        params: CheckoutFormRetrieveRequest,
        callback: IyzipayCallback<CheckoutFormRetrieveResult>,
      ): void;
    };
    refund: {
      create(
        params: RefundRequest,
        callback: IyzipayCallback<RefundResult>,
      ): void;
    };

    static LOCALE: { TR: string; EN: string };
    static PAYMENT_GROUP: {
      PRODUCT: string;
      LISTING: string;
      SUBSCRIPTION: string;
    };
    // lib/Iyzipay.js'ten (doğrudan node_modules kaynağından okunarak
    // doğrulandı — anahtarlar BÜYÜK harf, değerleri küçük harf string'ler).
    static REFUND_REASON: {
      DOUBLE_PAYMENT: string;
      BUYER_REQUEST: string;
      FRAUD: string;
      OTHER: string;
    };
    static BASKET_ITEM_TYPE: { PHYSICAL: string; VIRTUAL: string };
    static CURRENCY: {
      TRY: string;
      EUR: string;
      USD: string;
      GBP: string;
      NOK: string;
      RUB: string;
      CHF: string;
    };
  }

  export = Iyzipay;
}
