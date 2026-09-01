import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditLogEntry = {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

// spec §11.2: "Tüm kritik aksiyonlar (statü değişikliği, iade onayı) için
// ... audit_log kaydı zorunlu". audit_log tablosu şemada (spec §4.7) baştan
// beri vardı ama hiçbir kod ona yazmıyordu — Admin Panel'in ilk gerçek
// tüketicisi. @Global: her modülün ayrı ayrı import etmesine gerek yok,
// PrismaModule ile aynı desen.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      },
    });
  }
}
