import { UserRole } from '@prisma/client';

// spec §11.1 "Kullanıcı & Rol Yönetimi: Admin/Support/Ops kullanıcı CRUD" —
// yalnızca bu üç rol. customer/field_partner bu modülün kapsamı DIŞINDA
// (kendi self-register akışları var, bkz. RegisterDto'nun
// SELF_REGISTERABLE_ROLES'ü — bu ikisi tam olarak onun tümleyeni).
export const STAFF_ROLES = ['ops_manager', 'support_agent', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}
