import got from 'got';
import * as FormData from 'form-data';
import { Inject, Injectable } from '@nestjs/common';
import { MailModuleOptions, EmailVar } from './mail.interface';
import { CONFIG_OPTIONS } from 'src/common/common.constants';

@Injectable()
export class MailService {
  constructor(
    @Inject(CONFIG_OPTIONS) private readonly options: MailModuleOptions,
  ) {}

  async sendEmail(
    subject: string,
    template: string,
    to: string,
    emailVars: EmailVar[],
  ): Promise<boolean> {
    const body = new FormData();
    body.append('from', `Nuber-Eats <mailgun@${this.options.domain}>`);
    body.append('to', to);
    body.append('subject', subject);
    body.append('template', template);

    emailVars.forEach(eVar => body.append(`v:${eVar.key}`, eVar.value));
    try {
      await got.post(
        `https://api.mailgun.net/v3/${this.options.domain}/messages`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `api:${this.options.apiKey}`,
            ).toString('base64')}`,
          },
          body,
        },
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  sendVerificationEmail(email: string, code: string): void {
    this.sendEmail('Verify Your Email', 'template1', email, [
      { key: 'code', value: code },
      { key: 'username', value: email },
    ]);
  }
}
