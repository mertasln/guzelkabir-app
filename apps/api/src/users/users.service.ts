import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
