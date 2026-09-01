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

    static LOCALE: { TR: string; EN: string };
    static PAYMENT_GROUP: {
      PRODUCT: string;
      LISTING: string;
      SUBSCRIPTION: string;
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
