import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { KpiService } from './kpi.service';

@Controller('kpi')
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Roles('admin')
  @Get('dashboard')
  getDashboard() {
    return this.kpiService.getDashboard();
  }
}
