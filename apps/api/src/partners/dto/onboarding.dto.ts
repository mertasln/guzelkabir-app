import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class OnboardingDto {
  // Ham TC/pasaport no — servis katmanında AES-256-GCM ile şifrelenip
  // field_partners.national_id_encrypted'e öyle yazılır, asla düz metin
  // saklanmaz (bkz. common/crypto/national-id.crypto.ts).
  @IsString()
  @MaxLength(50)
  nationalId!: string;

  @IsOptional()
  @IsBoolean()
  criminalRecordCheck?: boolean;

  @IsOptional()
  @IsUrl()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  insurancePolicyNo?: string;

  @IsArray()
  @IsString({ each: true })
  serviceCities!: string[];
}
