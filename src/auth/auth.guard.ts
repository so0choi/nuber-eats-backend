import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    // http context
    const gqlContext = GqlExecutionContext.create(context).getContext();
    // make gql context because it's different from htttp one
    const user = gqlContext['user'];

    if (!user) return false;
    return true;
  }
}
