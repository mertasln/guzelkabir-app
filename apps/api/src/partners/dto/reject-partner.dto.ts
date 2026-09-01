import { IsString, MinLength } from 'class-validator';

// spec §11.1: "Onboarding onay akışı (KYC belge inceleme)" — red gerekçesi
// zorunlu, audit_log'a yazılır (bkz. FieldPartnerStatus.rejected yorumu).
export class RejectPartnerDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
