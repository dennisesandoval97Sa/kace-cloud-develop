export const {
  KACE_ENV_VAR: kaceEnvVar = 'kace environment variable fallback value',
  VITE_COGNITO_CLIENT_ID,
  VITE_TENANT_ID,
  VITE_COGNITO_URL,
  VITE_TIMER_SESSION_EXPIRATION = '30',
  VITE_KACE_ENGINE_REQUEST_LOG = 'false',
} = import.meta.env;

export const TIMER_SESSION_EXPIRATION_MS =
  Number(VITE_TIMER_SESSION_EXPIRATION || '30') * 60 * 1000;
export const ENABLE_KACE_ENGINE_REQUEST_LOG =
  String(VITE_KACE_ENGINE_REQUEST_LOG).toLowerCase() === 'true';
