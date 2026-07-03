import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route (or controller) as reachable without a JWT. The global guard
 * stack is locked-by-default (see app.module.ts) — this is the explicit
 * opt-out for the health check and the auth endpoints themselves.
 */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
