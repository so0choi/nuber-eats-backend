import { JwtService } from './jwt.service';
import { Test } from '@nestjs/testing';
import { CONFIG_OPTIONS } from '../common/common.constants';
import * as jwt from 'jsonwebtoken';

const TEST_KEY = 'test-key';
const USER_ID = 1;

jest.mock('jsonwebtoken', () => {
  return {
    sign: jest.fn(() => 'TOKEN'),
    verify: jest.fn(() => ({ id: USER_ID })),
  };
});

describe('JwtService', () => {
  let service: JwtService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: CONFIG_OPTIONS,
          useValue: {
            privateKey: TEST_KEY,
          },
        },
      ],
    }).compile();
    service = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sign', () => {
    it('should return a sign', async () => {
      const token = service.sign(USER_ID);
      expect(jwt.sign).toHaveBeenCalledTimes(USER_ID);
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: expect.any(Number),
        },
        TEST_KEY,
      );
      expect(typeof token).toBe('string');
    });
  });
  describe('verify', () => {
    it('should return decoded token', () => {
      const token = 'TOKEN';
      const decodedToken = service.verify(token);
      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith(token, TEST_KEY);
      expect(decodedToken).toEqual({
        id: USER_ID,
      });
    });
  });
});
