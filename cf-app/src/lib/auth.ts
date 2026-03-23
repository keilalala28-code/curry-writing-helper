const TOKEN_KEY = 'session_token'
const ROLE_KEY = 'session_role'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getRole(): string {
  return localStorage.getItem(ROLE_KEY) || ''
}

export function setRole(role: string) {
  localStorage.setItem(ROLE_KEY, role)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
}

export async function login(username: string, password: string): Promise<{ role: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const d = await res.json() as { error: string }
    throw new Error(d.error || '登录失败')
  }
  const d = await res.json() as { token: string; role: string }
  setToken(d.token)
  setRole(d.role)
  return { role: d.role }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-session-token': getToken() },
  })
  clearToken()
}

export async function checkAuth(): Promise<{ authenticated: boolean; role: string }> {
  const token = getToken()
  if (!token) return { authenticated: false, role: '' }
  const res = await fetch('/api/auth/check', {
    credentials: 'include',
    headers: { 'x-session-token': token },
  })
  const d = await res.json() as { authenticated: boolean; role?: string }
  if (d.authenticated && d.role) setRole(d.role)
  return { authenticated: d.authenticated, role: d.role || '' }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-token': getToken() },
    credentials: 'include',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (!res.ok) {
    const d = await res.json() as { error: string }
    throw new Error(d.error || '修改失败')
  }
}
