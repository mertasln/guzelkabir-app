import { IsIn, IsString, MinLength } from 'class-validator';

const OUTCOMES = ['resolved_refund', 'resolved_reservice', 'rejected'] as const;
export type ComplaintOutcome = (typeof OUTCOMES)[number];

// spec §11.1: "çözüm şablonları" — bu üç sonuçtan biri, gerekçesiyle
// (resolutionNotes) birlikte zorunlu. Şablon METİNLERİ frontend'de bir
// seçim listesi olarak sunuluyor (bkz. apps/admin), backend'e ayrı bir
// "template" alanı/tablo eklenmedi — spec şablon YÖNETİMİ (CRUD) istemiyor,
// yalnızca hızlı seçim kolaylığı.
export class ResolveComplaintDto {
  @IsIn(OUTCOMES)
  outcome!: ComplaintOutcome;

  @IsString()
  @MinLength(5)
  resolutionNotes!: string;
}
