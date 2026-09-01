import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { STAFF_ROLES, type StaffRole } from './staff-role';

export class ListStaffUsersQueryDto {
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
