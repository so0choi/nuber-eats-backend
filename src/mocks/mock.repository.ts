import { Repository } from 'typeorm';

export const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  findOneBy: jest.fn(),
  findOneByOrFail: jest.fn(),
  delete: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
});

export type MockRepository<T = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;
