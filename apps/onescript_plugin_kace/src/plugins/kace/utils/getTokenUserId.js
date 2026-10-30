import { jwtDecode } from 'jwt-decode';

export function getTokenUserId(token) {
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    return (
      payload?.sub ??
      payload?.username ??
      payload?.user_id ??
      payload?.['custom:user_id'] ??
      null
    );
  } catch (_) {
    return null;
  }
}
