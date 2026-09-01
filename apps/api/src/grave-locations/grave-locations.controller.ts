import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { GraveLocationsService } from './grave-locations.service';
import { CreateGraveLocationDto } from './dto/create-grave-location.dto';
import { UpdateGraveLocationDto } from './dto/update-grave-location.dto';

@Controller('grave-locations')
export class GraveLocationsController {
  constructor(private readonly graveLocationsService: GraveLocationsService) {}

  @Roles('customer', 'ops_manager', 'admin')
  @Post()
  create(@Body() dto: CreateGraveLocationDto) {
    return this.graveLocationsService.findOrCreate(dto);
  }

  // "Yardım isteyin" akışını tamamlar — spec §5'in tablosunda yok, kullanıcı
  // kararıyla eklendi (bkz. GraveLocationsService.update yorumu).
  @Roles('ops_manager', 'admin', 'field_partner')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGraveLocationDto,
  ) {
    return this.graveLocationsService.update(id, dto);
  }
}
