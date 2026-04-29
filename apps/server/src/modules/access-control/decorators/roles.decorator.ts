import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../access-control.constants';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
