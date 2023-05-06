import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtService } from './jwt.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!('x-jwt' in req.headers)) return next();
    const token = req.headers['x-jwt'].toString();
    try {
      const decoded = this.jwtService.verify(token);
      if (typeof decoded !== 'object' || !decoded.hasOwnProperty('id')) {
        return next();
      }
      const userId = decoded['id'];
      const { ok, error, user } = await this.userService.findById(userId);
      if (!ok)
        return res.send({
          ok: false,
          error,
        });
      req['user'] = user;
    } catch (e) {
      return res.send({
        ok: false,
        error: 'User not found',
      });
    }

    next();
  }
}
