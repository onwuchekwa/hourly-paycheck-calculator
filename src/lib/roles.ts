/** Employer accounts use the admin UI and permissions. */
export function isAdminRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'employer'
}

export function adminHomePath(role: string | undefined): '/admin' | '/employee' {
  return isAdminRole(role) ? '/admin' : '/employee'
}
