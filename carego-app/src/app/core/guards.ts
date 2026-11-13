import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { Role } from './models';

/** Allow the route only for a signed-in account acting in `role`; otherwise send them to sign in (remembering where they were going). */
export const roleGuard = (role: Role): CanActivateFn => (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  if (auth.role() === role) return true;
  const acc = auth.account()!;
  if (acc.roles.includes(role)) {
    auth.switchRole(role);
    return true;
  }
  return router.createUrlTree([auth.home(auth.role()!)]);
};
