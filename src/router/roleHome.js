/**
 * Role → home path mapping.
 *
 * Used by:
 *  - `AuthLanding` (`/` index route) to redirect logged-in users to their workspace
 *  - `RequireAuth` to bounce role-mismatch users back to their own home
 *  - `Login.jsx` (indirectly via REDIRECT) for post-login navigation
 *
 * Rule of thumb: `/` is a public marketing landing, NOT an authenticated app
 * fallback. Anywhere we'd previously fall back to `/` for a logged-in user,
 * call `getRoleHome(user.role)` instead.
 */
export const ROLE_HOME = {
  employer:  '/employer/dashboard',
  candidate: '/candidate/home',
  admin:     '/admin/overview',
}

export function getRoleHome(role) {
  return ROLE_HOME[role] ?? '/'
}
