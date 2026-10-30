// Ventana mínima entre escrituras de marcadores de actividad por-request en `usuarios`.
// El heartbeat de sesión llega ~cada 60 s; con 2 min recortamos ~2x las escrituras
// sin atrasar más de 2 min el indicador de "sesión activa".
export const USER_ACTIVITY_STALENESS_MS = 1 * 60 * 1000;
