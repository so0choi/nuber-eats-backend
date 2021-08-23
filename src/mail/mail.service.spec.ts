import { Test } from '@nestjs/testing';
import { CONFIG_OPTIONS } from 'src/common/common.constants';
import { MailService } from './mail.service';
import got from 'got';
import * as FormData from 'form-data';

jest.mock('got');
jest.mock('form-data');
const TEST_DOMAIN = 'test-domain';
describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: CONFIG_OPTIONS,
          useValue: { apiKey: 'test-apiKey', domain: TEST_DOMAIN },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    it('should call sendEmail', () => {
      const sendVerificationEmailArgs = { email: 'email', code: 'code' };

      // should not mock 'sendEmail'!! it will be tested later, so use jest.spyOn()
      jest.spyOn(service, 'sendEmail').mockImplementation(async () => {
        return true;
      });

      service.sendVerificationEmail(
        sendVerificationEmailArgs.email,
        sendVerificationEmailArgs.code,
      );
      expect(service.sendEmail).toHaveBeenCalledTimes(1);
      expect(service.sendEmail).toHaveBeenCalledWith(
        'Verify Your Email',
        'template1',
        sendVerificationEmailArgs.email,
        [
          { key: 'code', value: sendVerificationEmailArgs.code },
          { key: 'username', value: sendVerificationEmailArgs.email },
        ],
      );
    });
  });

  describe('sendEmail', () => {
    it('should send email', async () => {
      const ok = await service.sendEmail('', '', '', [
        { key: 'one', value: '1' },
      ]);
      const formSpy = jest.spyOn(FormData.prototype, 'append');
      expect(formSpy).toHaveBeenCalled();
      expect(got.post).toHaveBeenCalledWith(
        `https://api.mailgun.net/v3/${TEST_DOMAIN}/messages`,
        expect.any(Object),
      );
      expect(got.post).toHaveBeenCalledTimes(1);
      expect(ok).toEqual(true);
    });

    it('should fail on error', async () => {
      jest.spyOn(got, 'post').mockImplementation(() => {
        throw new Error('');
      });
      const ok = await service.sendEmail('', '', '', []);
      expect(ok).toEqual(false);
    });
  });
});
