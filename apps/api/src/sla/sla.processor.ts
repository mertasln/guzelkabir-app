import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SlaService } from './sla.service';
import { SLA_QUEUE } from './sla.constants';

@Processor(SLA_QUEUE)
export class SlaProcessor extends WorkerHost {
  constructor(private readonly slaService: SlaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'cancel-unpaid-orders':
        await this.slaService.cancelUnpaidOrders();
        return;
      case 'auto-close-approved-orders':
        await this.slaService.autoCloseApprovedOrders();
        return;
      case 'escalate-overdue-assignments':
        await this.slaService.escalateOverdueAssignments();
        return;
      case 'send-approval-reminders':
        await this.slaService.sendApprovalReminders();
        return;
      default:
        return;
    }
  }
}
