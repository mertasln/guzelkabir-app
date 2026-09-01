import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGraveLocationDto } from './dto/create-grave-location.dto';
import { UpdateGraveLocationDto } from './dto/update-grave-location.dto';

@Injectable()
export class GraveLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  // spec §5'in endpoint tablosunda grave_locations için hiçbir uç YOK — ama
  // POST /orders var olan bir graveLocationId istiyor (spec §4.4), ve sipariş
  // sihirbazının ada/parsel adımının çağıracağı hiçbir endpoint olmadan bu
  // zincir hiç tamamlanamaz. Kullanıcı kararıyla eklendi.
  //
  // find-or-create: aynı mezarlık+ada+parsel için tekrar sipariş verildiğinde
  // (aynı müşteri farklı zamanlarda, ya da abonelik) yeni bir satır değil, VAR
  // OLAN grave_location kaydı kullanılır — spec §4.4/§4.3'ün ima ettiği gibi
  // bir mezar konumu tek bir kayıt olarak var olmalı, sipariş başına değil.
  //
  // "Yardım isteyin" akışında section/plot HİÇ gönderilmez (kullanıcı bilmiyor,
  // saha ekibi tespit edecek) — bu durumda dedup anlamsız (aynı mezarlıkta
  // birden fazla "tespit bekleyen" talep olabilir, hepsini tek satırda
  // birleştirmek yanlış olur), o yüzden section+plot ikisi de doluyken dedup
  // uygulanır, aksi halde her zaman yeni satır oluşturulur.
  async findOrCreate(dto: CreateGraveLocationDto) {
    const cemetery = await this.prisma.cemetery.findUnique({
      where: { id: dto.cemeteryId },
    });
    if (!cemetery) {
      throw new BadRequestException('Belirtilen mezarlık bulunamadı.');
    }

    if (dto.section && dto.plot) {
      const existing = await this.prisma.graveLocation.findFirst({
        where: {
          cemeteryId: dto.cemeteryId,
          section: dto.section,
          plot: dto.plot,
        },
      });
      if (existing) {
        return existing;
      }
    }

    return this.prisma.graveLocation.create({
      data: {
        cemeteryId: dto.cemeteryId,
        section: dto.section,
        plot: dto.plot,
        graveNo: dto.graveNo,
        deceasedName: dto.deceasedName,
        locationNote: dto.locationNote,
        lat: dto.lat,
        lng: dto.lng,
        referencePhotoUrl: dto.referencePhotoUrl,
      },
    });
  }

  // "Yardım isteyin" akışını tamamlar: saha ekibi mezarı sahada tespit edince
  // section/plot/lat/lng'yi burada doldurur (kullanıcı kararı, ADIM 5).
  async update(id: string, dto: UpdateGraveLocationDto) {
    const existing = await this.prisma.graveLocation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Mezar konumu bulunamadı.');
    }
    return this.prisma.graveLocation.update({ where: { id }, data: dto });
  }
}
