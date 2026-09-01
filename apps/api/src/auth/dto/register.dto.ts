import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// spec §5: "POST /auth/register Müşteri/partner kaydı Public" — yalnızca kendi
// kendine kayıt olabilen iki rol (customer, field_partner). ops_manager/
// support_agent/admin bu uçtan asla oluşturulamaz.
const SELF_REGISTERABLE_ROLES = ['customer', 'field_partner'] as const;
export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // spec §6.2: "Parola politikası: min 10 karakter"
  @IsString()
  @MinLength(10)
  @MaxLength(255)
  password!: string;

  @IsString()
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string = 'tr';

  @IsOptional()
  @IsIn(SELF_REGISTERABLE_ROLES)
  role?: SelfRegisterableRole = 'customer';
}
