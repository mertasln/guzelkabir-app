import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { STAFF_ROLES, type StaffRole } from './staff-role';

// spec §11.1 "rol atama" + hesap devre dışı bırakma (Kullanıcı & Rol
// Yönetimi'nin doğal bir parçası — spec CRUD diyor, D burada mevcut
// deletedAt (soft-delete) konvansiyonuna uyularak "devre dışı bırakma"
// olarak uygulanıyor, hard delete DEĞİL, şemanın geri kalanıyla tutarlı).
export class UpdateStaffUserDto {
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
