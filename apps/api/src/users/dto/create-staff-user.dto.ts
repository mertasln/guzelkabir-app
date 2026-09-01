import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STAFF_ROLES, type StaffRole } from './staff-role';

export class CreateStaffUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // spec §6.2: "Parola politikası: min 10 karakter" — RegisterDto ile aynı kural.
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

  @IsIn(STAFF_ROLES)
  role!: StaffRole;
}
