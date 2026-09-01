import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePaymentIntentDto {
  @IsUUID()
  orderId!: string;

  // iyzico'nun buyer.identityNumber'ı — MASAK gereği zorunlu (TC Kimlik No,
  // yabancı müşteriler için pasaport no). Kullanıcı kararı (ADIM 6): yalnızca
  // ödeme anında toplanır, hiçbir zaman kendi veritabanımıza yazılmaz —
  // doğrudan iyzico'ya iletilir (spec §14.1'in veri minimizasyonu ruhuna
  // uygun, field_partners.national_id_encrypted'dan farklı olarak burada
  // kalıcı bir "Hassas" sınıf kolonu açılmadı).
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  identityNumber!: string;

  // buyer.gsmNumber — User.phone kayıt sırasında opsiyonel olduğu için burada
  // da opsiyonel: PaymentsService.createIntent, dto.phone yoksa User.phone'a
  // düşer, ikisi de yoksa 400 döner (bkz. PaymentsService yorumu).
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  // buyer/billingAddress için — grave_locations'ta müşterinin (mezarlığın
  // değil) adresi hiç tutulmuyor, o yüzden identityNumber ile aynı kullanıcı
  // kararıyla yalnızca ödeme anında toplanıp iyzico'ya iletiliyor, DB'ye
  // yazılmıyor.
  @IsString()
  @MaxLength(255)
  billingAddress!: string;

  @IsString()
  @MaxLength(120)
  billingCity!: string;

  // Diaspora müşterileri Türkiye dışında olabilir (spec: "Türk diasporası
  // Avrupa'da") — ülke sabit "Türkiye" varsayılmıyor, müşteri kendi
  // ülkesini giriyor.
  @IsString()
  @MaxLength(120)
  billingCountry!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  billingZipCode?: string;
}
