import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  CreateAccountInput,
  CreateAccountOutput,
} from './dtos/create-account.dto';
import { LoginInput, LoginOutput } from './dtos/login.dto';
import { JwtService } from '../jwt/jwt.service';
import { EditProfileInput, EditProfileOutput } from './dtos/edit-profile.dto';
import { Verification } from './entities/verification.entity';
import { UserProfileOutput } from './dtos/user-profile.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async createAccount({
    email,
    password,
    role,
  }: CreateAccountInput): Promise<CreateAccountOutput> {
    try {
      const exists = await this.users.findOneBy({ email });
      if (exists) {
        return { ok: false, error: 'There is a user with that email already.' };
      }
      const newUser = await this.users.create({ email, password, role });
      await this.users.save(newUser);
      const verification = await this.verifications.save(
        this.verifications.create({
          user: newUser,
        }),
      );
      this.mailService.sendVerificationEmail(newUser.email, verification.code);
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, error: "Couldn't create an account." };
    }
  }

  async login({ email, password }: LoginInput): Promise<LoginOutput> {
    try {
      const user = await this.users.findOne({
        where: { email },
        select: ['id', 'password'],
      });
      // user not found error
      if (!user) {
        return {
          ok: false,
          error: 'User not found',
        };
      }
      const isPasswordCorrect = await user.checkPassword(password);
      // wrong password error
      if (!isPasswordCorrect) {
        return {
          ok: false,
          error: 'Wrong password.',
        };
      }
      // successfully check password
      // create jwt token and save it with user
      const token = this.jwtService.sign(user.id);
      return {
        ok: true,
        token,
      };
    } catch (error) {
      return {
        ok: false,
        error,
      };
    }
  }

  async findById(id: number): Promise<UserProfileOutput> {
    try {
      const user = await this.users.findOneByOrFail({ id });
      return {
        ok: true,
        user,
      };
    } catch (error) {
      return { ok: false, error: 'User not found' };
    }
  }

  async editProfile(
    userId: number,
    { email, password }: EditProfileInput,
  ): Promise<EditProfileOutput> {
    try {
      const user = await this.users.findOne({ where: { id: userId } });
      if (password) {
        user.password = password;
      }
      if (email) {
        const isEmailUsed = await this.users.findOne({ where: { email } });
        if (isEmailUsed) {
          return {
            ok: false,
            error: 'Email is already in use',
          };
        }

        await this.verifications.delete({ user: { id: userId } });
        user.email = email;
        user.verified = false;
        const verification = await this.verifications.save(
          this.verifications.create({ user }),
        );
        this.mailService.sendVerificationEmail(user.email, verification.code);
      }
      await this.users.save(user);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Edit profile failed',
      };
    }
  }
}
