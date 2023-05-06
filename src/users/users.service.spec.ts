import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from './entities/user.entity';
import { Verification } from './entities/verification.entity';
import { JwtService } from '../jwt/jwt.service';
import { MailService } from '../mail/mail.service';
import { mockRepository, MockRepository } from '../mocks/mock.repository';

const mockJwtService = () => ({
  sign: jest.fn(() => 'signed-token'),
  verify: jest.fn(),
});

const mockMailService = () => ({
  sendVerificationEmail: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: MockRepository<User>;
  let verificationRepository: MockRepository<Verification>;
  let mailService: MailService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockRepository(),
        },
        {
          provide: JwtService,
          useValue: mockJwtService(),
        },
        {
          provide: MailService,
          useValue: mockMailService(),
        },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
    verificationRepository = module.get(getRepositoryToken(Verification));
    mailService = module.get<MailService>(MailService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAccount', () => {
    const createAccountArgs = {
      email: '',
      password: '',
      role: UserRole.Client,
    };
    it('should fail if user exists', async () => {
      usersRepository.findOneBy.mockResolvedValue({
        id: 1,
        email: 'lalala',
      });
      const result = await service.createAccount(createAccountArgs);
      expect(result).toMatchObject({
        ok: false,
        error: 'There is a user with that email already.',
      });
    });

    it('should create a new user', async () => {
      const verification = { user: createAccountArgs, code: '' };
      usersRepository.findOneBy.mockResolvedValue(undefined);
      usersRepository.create.mockResolvedValue(createAccountArgs);
      verificationRepository.create.mockReturnValue(verification);
      verificationRepository.save.mockResolvedValue(verification);

      const result = await service.createAccount(createAccountArgs);

      expect(usersRepository.create).toBeCalledTimes(1);
      expect(usersRepository.create).toBeCalledWith(createAccountArgs);
      expect(usersRepository.save).toHaveBeenCalled();
      expect(usersRepository.save).toBeCalledWith(createAccountArgs);
      expect(verificationRepository.create).toHaveBeenCalledTimes(1);
      expect(verificationRepository.create).toHaveBeenCalledWith({
        user: createAccountArgs,
      });
      expect(verificationRepository.save).toBeCalledTimes(1);
      expect(verificationRepository.save).toHaveBeenCalledWith(verification);
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      );
      expect(result).toEqual({ ok: true });
    });

    it('should fail on exception', async () => {
      usersRepository.findOneBy.mockRejectedValue(new Error('fake error'));

      const result = await service.createAccount(createAccountArgs);
      expect(result).toEqual({
        ok: false,
        error: "Couldn't create an account.",
      });
    });
  });

  describe('login', () => {
    const loginArgs = {
      email: '',
      password: '',
    };
    const fakeUser = {
      id: 1,
      checkPassword: jest.fn(() => Promise.resolve(true)),
    };

    it('should fail if user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(undefined);
      const result = await service.login(loginArgs);
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toEqual({
        ok: false,
        error: 'User not found',
      });
    });

    it('should fail if the password is wrong', async () => {
      const fakeUser = {
        id: 1,
        checkPassword: jest.fn(() => Promise.resolve(false)),
      };
      usersRepository.findOne.mockResolvedValue(fakeUser);
      const result = await service.login(loginArgs);
      expect(result).toEqual({
        ok: false,
        error: 'Wrong password.',
      });
    });

    it('should return token if password correct', async () => {
      usersRepository.findOne.mockResolvedValue(fakeUser);
      const result = await service.login(loginArgs);
      expect(fakeUser.checkPassword).toHaveBeenCalledTimes(1);
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
      expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Number));
      expect(result).toEqual({
        ok: true,
        token: 'signed-token',
      });
    });

    it('should fail on exception', async () => {
      const fakeError = new Error('fake error');
      usersRepository.findOne.mockRejectedValue(fakeError);
      const result = await service.login(loginArgs);
      expect(result).toEqual({
        ok: false,
        error: fakeError,
      });
    });
  });

  describe('findById', () => {
    const findByIdArgs = { id: 1 };
    it('should find an existing user', async () => {
      usersRepository.findOneByOrFail.mockResolvedValue(findByIdArgs);

      const result = await service.findById(1);
      expect(result).toEqual({
        ok: true,
        user: findByIdArgs,
      });
    });

    it('should fail if no user if found', async () => {
      usersRepository.findOneByOrFail.mockRejectedValue(
        new Error('fake error'),
      );

      const result = await service.findById(1);
      expect(result).toEqual({
        ok: false,
        error: 'User not found',
      });
    });
  });
  describe('editProfile', () => {
    const oldUser = {
      email: 'old@gmail.com',
      verified: true,
      id: 1,
    };
    it('should change email', async () => {
      const editProfileArgs = {
        userId: 1,
        input: { email: 'new@gamil.com' },
      };
      const newVerification = {
        code: 'code',
      };
      const newUser = {
        ...oldUser,
        ...editProfileArgs.input,
        verified: false,
      };
      usersRepository.findOne.mockResolvedValue(oldUser);
      verificationRepository.create.mockReturnValue(newVerification);
      verificationRepository.save.mockResolvedValue(newVerification);
      verificationRepository.delete.mockResolvedValue(true);

      await service.editProfile(editProfileArgs.userId, editProfileArgs.input);
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: editProfileArgs.userId },
      });

      expect(verificationRepository.delete).toHaveBeenCalledTimes(1);
      expect(verificationRepository.delete).toHaveBeenCalledWith(
        editProfileArgs.userId,
      );
      expect(verificationRepository.create).toHaveBeenCalledWith({
        user: newUser,
      });
      expect(verificationRepository.save).toHaveBeenCalledWith(newVerification);

      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        newUser.email,
        newVerification.code,
      );
    });
    it('should change password', async () => {
      const editProfileArgs = {
        userId: 1,
        input: {
          password: 'new_password',
        },
      };
      const oldUser = {
        id: 1,
        password: 'old_password',
      };
      const newUser = {
        ...oldUser,
        ...editProfileArgs.input,
      };
      usersRepository.findOne.mockResolvedValue(oldUser);

      const result = await service.editProfile(
        editProfileArgs.userId,
        editProfileArgs.input,
      );
      expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: editProfileArgs.userId },
      });
      expect(usersRepository.save).toHaveBeenCalledTimes(1);
      expect(usersRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual({ ok: true });
    });

    it('should fail on exception', async () => {
      const error = new Error();
      usersRepository.findOne.mockRejectedValue(error);
      const result = await service.editProfile(1, { email: 'aa' });
      expect(result).toEqual({ ok: false, error: 'Edit profile failed' });
    });
  });
});
