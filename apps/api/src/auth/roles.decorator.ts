import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client.js';

/**
 * Restricts a route (or controller) to the given roles, enforced by the
 * global RolesGuard. Routes without this metadata are open to any role.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
