import { Injectable, NotFoundException } from '@nestjs/common';
import { Cemetery, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchCemeteriesQueryDto } from './dto/search-cemeteries-query.dto';
import { UpdateCemeteryDto } from './dto/update-cemetery.dto';
import {
  CursorPage,
  DEFAULT_PAGE_SIZE,
} from '../common/pagination/cursor-pagination.type';

@Injectable()
export class CemeteriesService {
  constructor(private readonly prisma: PrismaService) {}

  // spec §5: "Mezarlık adı/şehir bazlı arama (autocomplete)"
  async search(query: SearchCemeteriesQueryDto): Promise<CursorPage<Cemetery>> {
    const where: Prisma.CemeteryWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { city: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const items = await this.prisma.cemetery.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  // spec §5'in tablosunda yok — ADIM 7 kararı (bkz. UpdateCemeteryDto
  // yorumu). geotagToleranceM'i gerçekten yapılandırılabilir kılmak için
  // eklendi; aksi halde kolon yalnızca doğrudan DB erişimiyle değiştirilebilirdi.
  async update(id: string, dto: UpdateCemeteryDto): Promise<Cemetery> {
    const cemetery = await this.prisma.cemetery.findUnique({ where: { id } });
    if (!cemetery) {
      throw new NotFoundException('Mezarlık bulunamadı.');
    }
    return this.prisma.cemetery.update({
      where: { id },
      data: { geotagToleranceM: dto.geotagToleranceM },
    });
  }
}
