import { Injectable } from '@nestjs/common';
import * as postmark from 'postmark';

@Injectable()
export class EmailService {
  private readonly client: postmark.ServerClient | null;
  private readonly fromAddress = process.env.POSTMARK_FROM_EMAIL;

  constructor() {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    this.client = token ? new postmark.ServerClient(token) : null;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.client || !this.fromAddress) {
      throw new Error(
        'Postmark yapılandırılmamış (POSTMARK_SERVER_TOKEN/POSTMARK_FROM_EMAIL).',
      );
    }
    const result = await this.client.sendEmail({
      From: this.fromAddress,
      To: to,
      Subject: subject,
      TextBody: text,
      MessageStream: 'outbound',
    });
    if (result.ErrorCode !== 0) {
      throw new Error(
        `Postmark e-posta gönderimi başarısız (kod: ${result.ErrorCode}): ${result.Message}`,
      );
    }
  }
}
