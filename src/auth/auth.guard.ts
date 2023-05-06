import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { AllowedRoles } from './role.decorator';
import { JwtService } from '../jwt/jwt.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.get<AllowedRoles>(
      'roles',
      context.getHandler(),
    );
    if (!roles) return true;

    const gqlContext = GqlExecutionContext.create(context).getContext();
    const token = gqlContext.token;
    if (!token) return false;

    const decoded = this.jwtService.verify(token);
    if (typeof decoded !== 'object' || !decoded.hasOwnProperty('id')) {
      return false;
    }
    const userId = decoded['id'];
    const { user } = await this.userService.findById(userId);
    if (!user) return false;

    gqlContext['user'] = user;

    return roles.includes('Any') ? true : roles.includes(user.role);
  }
}
