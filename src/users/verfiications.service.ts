import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Verification } from './entities/verification.entity';
import { VerifyEmailOutput } from './dtos/verify-email.dto';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,
  ) {}

  async verifyEmail(code: string): Promise<VerifyEmailOutput> {
    try {
      const verification = await this.verifications.findOne({
        where: { code },
        relations: ['user'],
      });

      if (!verification) {
        return {
          ok: false,
          error: 'Verification failed',
        };
      }
      verification.user.verified = true;
      await this.users.save(verification.user);
      await this.verifications.delete(verification.id);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Could not verify email',
      };
    }
  }
}
