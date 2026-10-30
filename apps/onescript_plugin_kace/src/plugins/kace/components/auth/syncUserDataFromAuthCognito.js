import { storeService } from '#plugins/kace/services/storeService.js';

export function syncUserDataFromAuthCognito(authCognitoResponse) {
  if (!authCognitoResponse || typeof authCognitoResponse !== 'object') {
    return false;
  }

  storeService.set('user.user_data', authCognitoResponse);
  storeService.set('user.user_id', authCognitoResponse?.user?.id ?? null);
  storeService.set(
    'config.selected_group_id',
    authCognitoResponse?.user?.grupo_activo ?? null
  );

  const group = authCognitoResponse?.groups?.find(
    (g) => g.id === authCognitoResponse?.user?.grupo_activo
  );
  storeService.set(
    'configuration_id_selected_group',
    group?.configuration_id ?? null
  );

  return true;
}
