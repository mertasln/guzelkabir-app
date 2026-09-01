import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log/audit-log.service';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { ListStaffUsersQueryDto } from './dto/list-staff-users-query.dto';
import { isStaffRole, STAFF_ROLES } from './dto/staff-role';

// spec §11.1 "Kullanıcı & Rol Yönetimi" — parola hash'i asla dışarı verilmez.
const STAFF_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  role: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type StaffUserItem = Prisma.UserGetPayload<{
  select: typeof STAFF_USER_SELECT;
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // spec §5'in tablosunda yok — apps/web'in AuthProvider'ı access token'daki
  // {sub, role}'den fazlasını (fullName) hiçbir zaman sunucudan doğrulayamıyordu,
  // bu yüzden her tam sayfa yenilemesinde "Hesabım" placeholder'ına düşüyordu.
  // Kullanıcı kararı: spec §6'nın RBAC/auth mimarisinin doğal bir tamamlayıcısı
  // olarak eklendi, yeni bir mimari karar değil.
  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        locale: true,
        isVerified: true,
        kycStatus: true,
        // ADIM 8 eklentisi: saha PWA'sı GET /partners/:id/tasks'i çağırabilmek
        // için kendi FieldPartner.id'sini bilmek zorunda — role='field_partner'
        // olsa bile User.id ile FieldPartner.id AYNI değil (ayrı UUID), ve bunu
        // öğrenecek başka hiçbir uç yoktu. GET /users/me zaten spec §5'in
        // tablosunda olmayan, "doğal tamamlayıcı" bir uç (bkz. ADIM 5 kararı) —
        // aynı mantıkla genişletildi, yeni bir mimari karar değil.
        fieldPartner: { select: { id: true, status: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    const { fieldPartner, ...rest } = user;
    return {
      ...rest,
      fieldPartnerId: fieldPartner?.id ?? null,
      fieldPartnerStatus: fieldPartner?.status ?? null,
    };
  }

  // Admin Panel Phase 7 (spec §11.1 "Kullanıcı & Rol Yönetimi") — yalnızca
  // ops_manager/support_agent/admin hesapları. customer/field_partner bu
  // modülün kapsamı DIŞINDA (kendi akışları var: self-register, Partner
  // Yönetimi).
  async findManyStaff(
    query: ListStaffUsersQueryDto,
  ): Promise<CursorPage<StaffUserItem>> {
    const where: Prisma.UserWhereInput = {
      role: query.role ? query.role : { in: [...STAFF_ROLES] },
    };
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: STAFF_USER_SELECT,
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async createStaff(dto: CreateStaffUserDto, actor: AccessTokenPayload) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta adresi zaten kayıtlı.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        locale: 'tr',
        role: dto.role,
        // İç ekip hesapları — kayıt anında zaten doğrulanmış kabul edilir
        // (bkz. RegisterDto'nun self-register akışı: isVerified varsayılan
        // false, ama o e-posta/telefon doğrulaması içindir; burada admin
        // zaten kimliği bilinen bir çalışanı elle oluşturuyor).
        isVerified: true,
      },
      select: STAFF_USER_SELECT,
    });

    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      newValue: { email: user.email, role: user.role },
    });
    return user;
  }

  async updateStaff(
    userId: string,
    dto: UpdateStaffUserDto,
    actor: AccessTokenPayload,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!target) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    if (!isStaffRole(target.role)) {
      throw new BadRequestException(
        'Bu uç yalnızca ops_manager/support_agent/admin hesapları için kullanılabilir.',
      );
    }
    if (dto.isActive === false && target.id === actor.sub) {
      throw new BadRequestException(
        'Kendi hesabınızı devre dışı bırakamazsınız.',
      );
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.role) {
      data.role = dto.role;
    }
    if (dto.isActive === false) {
      data.deletedAt = new Date();
    } else if (dto.isActive === true) {
      data.deletedAt = null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: STAFF_USER_SELECT,
    });

    await this.auditLog.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'user.update',
      entityType: 'user',
      entityId: userId,
      oldValue: { role: target.role, isActive: !target.deletedAt },
      newValue: {
        role: updated.role,
        isActive: !updated.deletedAt,
      },
    });
    return updated;
  }
}
