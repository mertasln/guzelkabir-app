import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CemeteriesService } from './cemeteries.service';
import { SearchCemeteriesQueryDto } from './dto/search-cemeteries-query.dto';
import { UpdateCemeteryDto } from './dto/update-cemetery.dto';

@Controller('cemeteries')
export class CemeteriesController {
  constructor(private readonly cemeteriesService: CemeteriesService) {}

  @Public()
  @Get('search')
  search(@Query() query: SearchCemeteriesQueryDto) {
    return this.cemeteriesService.search(query);
  }

  // spec §5'in tablosunda yok — ADIM 7 kararı (bkz. CemeteriesService.update
  // yorumu). Yalnızca geotag toleransı için, kapsam bilinçli olarak dar.
  @Roles('ops_manager', 'admin')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCemeteryDto,
  ) {
    return this.cemeteriesService.update(id, dto);
  }
}
