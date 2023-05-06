import { MailService } from './mail.service';
import { Test } from '@nestjs/testing';
import { CONFIG_OPTIONS } from '../common/common.constants';
import * as FormData from 'form-data';
import got from 'got';

jest.mock('got');
jest.mock('form-data');
const TEST_DOMAIN = 'TEST-domain';

describe('MailService', () => {
  let service: MailService;
  beforeEach(async () => {
    let module = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: CONFIG_OPTIONS,
          useValue: {
            apiKey: 'TEST-apiKey',
            domain: 'TEST-domain',
            fromEmail: 'TEST-fromEmail',
          },
        },
      ],
    }).compile();
    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    it('should call sendEmail', () => {
      const sendVerificationEmailArgs = {
        email: 'test@mail.com',
        code: 'test-code',
      };
      const sendEmailSpy = jest
        .spyOn(service, <any>'sendEmail')
        .mockImplementation(async () => {
          return true;
        });
      service.sendVerificationEmail(
        sendVerificationEmailArgs.email,
        sendVerificationEmailArgs.code,
      );
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        'Verify your email',
        sendVerificationEmailArgs.email,
        'template1',
        [
          {
            key: 'code',
            value: sendVerificationEmailArgs.code,
          },
          {
            key: 'username',
            value: sendVerificationEmailArgs.email,
          },
        ],
      );
    });
  });
  describe('sendEmail', () => {
    it('should send email', async () => {
      const result = await service.sendEmail('', '', '', [
        { key: 'one', value: '1' },
      ]);
      const formDataSpy = jest.spyOn(FormData.prototype, 'append');
      expect(formDataSpy).toHaveBeenCalled();
      expect(got.post).toHaveBeenCalledTimes(1);
      expect(got.post).toHaveBeenCalledWith(
        `https://api.mailgun.net/v3/${TEST_DOMAIN}/messages`,
        expect.any(Object),
      );
      expect(result).toEqual(true);
    });
    it('should fail on error', async () => {
      jest.spyOn(got, 'post').mockImplementation(() => {
        throw new Error();
      });
      const result = await service.sendEmail('', '', '', [
        { key: 'one', value: '1' },
      ]);

      expect(result).toEqual(false);
    });
  });
});
