import { Permissions } from './Permissions';
import { AuxPermissions } from './AuxPermissions.js';
import { SearchPermissionsCatalog } from './SearchPermissionsCatalog.js';

export class ListPermissions {
    /** @type {Object} is initialized in the constructor */
    #permissions;
    constructor() {
        this.#permissions = {
            agente: [
                new Permissions('Access', 'Acceso agente', false, 'access-agent'),
                new Permissions('CasesCreate', 'Crear caso', false, 'cases'),
                new Permissions('CasesReadOwnCases', 'Ver casos que tiene el agente actual', false, 'cases'),
                new Permissions('CasesUpdate', 'Actualizar caso', false, 'cases'),
                new Permissions('CaseReclassify', 'Reclasificar caso', false, 'cases'),

                new Permissions(
                    'ClassificationLevelsRead',
                    'Ver valores únicos de un nivel específico en las clasificaciones',
                    false,
                    'classifications-levels'
                ),

                new Permissions('ClientsCreate', 'Crear cliente', false, 'clients'),
                new Permissions('ClientsUpdate', 'Actualizar cliente', false, 'clients'),
                new Permissions('ClientsDelete', 'Eliminar cliente', false, 'clients'),
                new Permissions('ClientsRead', 'Ver clientes', false, 'clients'),
                new Permissions('ClientsContacts', 'Ver contactos de un cliente', false, 'clients'),

                new Permissions('CommentsCreate', 'Crear comentario', false, 'comments'),
                new Permissions('CommentsUpdate', 'Actualizar comentario', false, 'comments'),
                new Permissions('CommentsDelete', 'Eliminar comentario', false, 'comments'),
                new Permissions('CommentsRead', 'Ver comentarios', false, 'comments'),

                new Permissions('HelpsReadAgent', 'Ver helps', false, 'help'),
                new Permissions('BannerRead', 'Ver banners', false, 'banners'),
                new Permissions(
                    'GlobalConfigurationsRead',
                    'Ver configuraciones globales',
                    false,
                    'global-configurations'
                ),
                new Permissions('FieldListsRead', 'Ver todos los nombres de los esquemas', false, 'field-lists'),
                new Permissions('UsersRead', 'Ver usuarios', false, 'users'),
                new Permissions('CasesRead', 'Ver casos', false, 'cases'),
                new Permissions('CaseCountRead', 'Ver conteo de casos', false, 'case-count'),

                new Permissions('TransitionsRead', 'Ver transiciones', false, 'transitions'),

                new Permissions('BoardsCreate', 'Crear tablero', false, 'boards'),
                new Permissions('BoardsUpdate', 'Actualizar tablero', false, 'boards'),
                new Permissions('BoardsDelete', 'Eliminar tablero', false, 'boards'),
                new Permissions('BoardsRead', 'Ver tablero', false, 'boards'),
                new Permissions('BoardsExport', 'Descargar datos del tablero', false, 'boards'),
                new Permissions('BoardsReadRegister', 'Ver registro en tablero', false, 'boards'),
                new Permissions('BoardsCreateRegister', 'Crear registro en tablero', false, 'boards'),

                new Permissions('EmailsCreate', 'Crear email', false, 'emails'),
                new Permissions('EmailsUpdate', 'Actualizar email', false, 'emails'),
                new Permissions('EmailsDelete', 'Eliminar email', false, 'emails'),
                new Permissions('EmailsRead', 'Ver emails', false, 'emails'),

                new Permissions('InteractionsCreate', 'Crear interacion', false, 'interactions'),
                new Permissions('BoardsUpdateRegister', 'Actualizar registro en tablero', false, 'boards'),
            ],
            administrador: [
                new Permissions('Access', 'Acceso administrador', false, 'access-admin'),
                new Permissions('ActionCreate', 'Crear accion', false, 'actions'),
                new Permissions('ActionUpdate', 'Actualizar accion', false, 'actions'),
                new Permissions('ActionDelete', 'Eliminar accion', false, 'actions'),
                new Permissions('ActionRead', 'Ver acciones', false, 'actions'),
                new Permissions('ActionTypesRead', 'Ver tipos de acción', false, 'actions'),
                new Permissions('ActionFormulasRead', 'Ver fórmulas de acción', false, 'actions'),
                new Permissions('ActionAggregatesRead', 'Ver agregados de acción', false, 'actions'),
                new Permissions('ActionCustomerFieldsRead', 'Ver campos de cliente en acciones', false, 'actions'),
                new Permissions('ActionCaseFieldsRead', 'Ver campos de caso en acciones', false, 'actions'),

                new Permissions(
                    'ActionQueueExecutorExecute',
                    'Ejecutar cola de acciones',
                    false,
                    'actions-queue-executor'
                ),
                new Permissions(
                    'ActionQueueExecutionsExecute',
                    'Ejecutar cola de ejecuciones de acciones',
                    false,
                    'actions-queue-executions'
                ),

                new Permissions('ActionJobsCreate', 'Crear ejecuciones por lotes', false, 'action-jobs'),
                new Permissions('ActionJobsUpdate', 'Actualizar ejecuciones por lotes', false, 'action-jobs'),
                new Permissions('ActionJobsDelete', 'Eliminar ejecuciones por lotes', false, 'action-jobs'),
                new Permissions('ActionJobsRead', 'Ver ejecuciones por lotes', false, 'action-jobs'),
                new Permissions(
                    'ActionJobsValidateCSV',
                    'Validar archivo CSV de ejecuciones por lotes',
                    false,
                    'action-jobs'
                ),
                new Permissions(
                    'ActionJobsProcessQueue',
                    'Procesar cola de ejecuciones por lotes',
                    false,
                    'action-jobs'
                ),

                new Permissions('AgendasCreate', 'Crear agenda', false, 'agendas'),
                new Permissions('AgendasUpdate', 'Actualizar agenda', false, 'agendas'),
                new Permissions('AgendasDelete', 'Eliminar agenda', false, 'agendas'),
                new Permissions('AgendasRead', 'Ver agendas', false, 'agendas'),

                new Permissions('AgendasGroupsCreate', 'Crear relación agenda-grupo', false, 'agendas-groups'),
                new Permissions('AgendasGroupsRead', 'Ver relación agenda-grupo', false, 'agendas-groups'),
                new Permissions('AgendasGroupsDelete', 'Eliminar relación agenda-grupo', false, 'agendas-groups'),
                new Permissions(
                    'AgendasGroupsBatchCreate',
                    'Crear relaciones agenda-grupo en lote',
                    false,
                    'agendas-groups'
                ),
                new Permissions(
                    'AgendasGroupsBatchDelete',
                    'Eliminar relaciones agenda-grupo en lote',
                    false,
                    'agendas-groups'
                ),

                new Permissions('AllowedConnectionCreate', 'Crear allowed connection', false, 'allowed-connections'),
                new Permissions(
                    'AllowedConnectionUpdate',
                    'Actualizar allowed connection',
                    false,
                    'allowed-connections'
                ),
                new Permissions('AllowedConnectionDelete', 'Eliminar allowed connection', false, 'allowed-connections'),
                new Permissions('AllowedConnectionRead', 'Ver allowed connections', false, 'allowed-connections'),

                new Permissions('AppointmentsCreate', 'Crear cita', false, 'appointments'),
                new Permissions('AppointmentsUpdate', 'Actualizar cita', false, 'appointments'),
                new Permissions('AppointmentsDelete', 'Eliminar cita', false, 'appointments'),
                new Permissions('AppointmentsRead', 'Ver citas', false, 'appointments'),
                new Permissions('AppointmentsReschedule', 'Reprogramar cita', false, 'appointments'),
                new Permissions('AppointmentsCountByCase', 'Contar citas por caso', false, 'appointments'),

                new Permissions(
                    'AppointmentTimeSlotsCreate',
                    'Crear franja horaria de cita',
                    false,
                    'appointment-time-slots'
                ),
                new Permissions(
                    'AppointmentTimeSlotsUpdate',
                    'Actualizar franja horaria de cita',
                    false,
                    'appointment-time-slots'
                ),
                new Permissions(
                    'AppointmentTimeSlotsDelete',
                    'Eliminar franja horaria de cita',
                    false,
                    'appointment-time-slots'
                ),
                new Permissions(
                    'AppointmentTimeSlotsRead',
                    'Ver franjas horarias de citas',
                    false,
                    'appointment-time-slots'
                ),

                new Permissions(
                    'AssignmentUsersListCreate',
                    'Crear asignación de usuarios',
                    false,
                    'assignment-users-list'
                ),
                new Permissions(
                    'AssignmentUsersListUpdate',
                    'Actualizar asignación de usuarios',
                    false,
                    'assignment-users-list'
                ),
                new Permissions(
                    'AssignmentUsersListDelete',
                    'Eliminar asignación de usuarios',
                    false,
                    'assignment-users-list'
                ),
                new Permissions(
                    'AssignmentUsersListRead',
                    'Ver asignaciones de usuarios',
                    false,
                    'assignment-users-list'
                ),

                new Permissions('AnsCreate', 'Crear ans', false, 'ans'),
                new Permissions('AnsUpdate', 'Actualizar ans', false, 'ans'),
                new Permissions('AnsDelete', 'Eliminar ans', false, 'ans'),
                new Permissions('AnsRead', 'Ver ans', false, 'ans'),
                new Permissions('AnsCalculate', 'Calcular ans', false, 'ans'),

                new Permissions('AuxCaseCreate', 'Crear aux case', false, 'aux-cases'),
                new Permissions('AuxCaseUpdate', 'Actualizar aux case', false, 'aux-cases'),
                new Permissions('AuxCaseDelete', 'Eliminar aux case', false, 'aux-cases'),
                new Permissions('AuxCaseRead', 'Ver aux cases', false, 'aux-cases'),

                new Permissions('AuxClientCreate', 'Crear aux cliente', false, 'aux-clients'),
                new Permissions('AuxClientUpdate', 'Actualizar aux cliente', false, 'aux-clients'),
                new Permissions('AuxClientDelete', 'Eliminar aux cliente', false, 'aux-clients'),
                new Permissions('AuxClientRead', 'Ver aux clientes', false, 'aux-clients'),

                new Permissions('BannerCreate', 'Crear banner', false, 'banners'),
                new Permissions('BannerUpdate', 'Actualizar banner', false, 'banners'),
                new Permissions('BannerDelete', 'Eliminar banner', false, 'banners'),
                new Permissions('BannerRead', 'Ver banners', false, 'banners'),

                new Permissions('CasesRead', 'Ver casos', false, 'cases'),
                new Permissions('CaseClose', 'cerrar caso', false, 'cases'),
                new Permissions('OpenCase', 'abrir caso', false, 'cases'),
                new Permissions('CaseReclassify', 'Reclasificar caso', false, 'cases'),
                new Permissions('CaseClone', 'Clonar caso', false, 'cases'),
                new Permissions('CaseReOpen', 'Reabrir caso', false, 'cases'),
                new Permissions('CaseUpdateNotOwner', 'Actualizar caso sin ser el responsable', false, 'cases'),
                new Permissions('CasesBulkClose', 'Cerrar casos masivamente', false, 'cases'),
                new Permissions('CasesBulkTransition', 'Cambiar estado de casos masivamente', false, 'cases'),
                new Permissions('CasesBulkAssign', 'Asignar casos masivamente', false, 'cases'),

                new Permissions('CaseAttachmentCreate', 'Crear case attachment', false, 'case-attachments'),
                new Permissions('CaseAttachmentUpdate', 'Actualizar case attachment', false, 'case-attachments'),
                new Permissions('CaseAttachmentDelete', 'Eliminar case attachment', false, 'case-attachments'),
                new Permissions('CaseAttachmentRead', 'Ver case attachments', false, 'case-attachments'),

                new Permissions('CaseCountRead', 'Ver conteo de casos', false, 'case-count'),

                new Permissions('CaseCountByGroupRead', 'Ver conteo de casos por grupo', false, 'case-count-by-group'),

                new Permissions('CaseDescriptionCreate', 'Crear case description', false, 'case-descriptions'),
                new Permissions('CaseDescriptionUpdate', 'Actualizar case description', false, 'case-descriptions'),
                new Permissions('CaseDescriptionDelete', 'Eliminar case description', false, 'case-descriptions'),
                new Permissions('CaseDescriptionRead', 'Ver cases descriptions', false, 'case-descriptions'),

                new Permissions('ChannelHubCreate', 'Crear canal hub', false, 'channel-hub'),
                new Permissions('ChannelHubUpdate', 'Actualizar canal hub', false, 'channel-hub'),
                new Permissions('ChannelHubDelete', 'Eliminar canal hub', false, 'channel-hub'),
                new Permissions('ChannelHubRead', 'Ver canal hub', false, 'channel-hub'),

                new Permissions(
                    'ClassificationGroupsRelationshipRead',
                    'Ver relaciones entre grupo y clasificacion',
                    false,
                    'classification-group-relationships'
                ),
                new Permissions(
                    'ClassificationGroupsRelationshipDelete',
                    'Eliminar relacion entre grupo y clasificacion',
                    false,
                    'classification-group-relationships'
                ),
                new Permissions(
                    'ClassificationGroupsRelationshipCreate',
                    'Crear relacion entre grupo y clasificacion',
                    false,
                    'classification-group-relationships'
                ),
                new Permissions(
                    'ClassificationGroupsRelationshipUpdate',
                    'Actualizar relacion entre un grupo y clasificacion',
                    false,
                    'classification-group-relationships'
                ),

                new Permissions(
                    'ClassificationTemplateRelationshipRead',
                    'Ver relaciones entre plantillas y clasificacion',
                    false,
                    'classification-template-relations'
                ),
                new Permissions(
                    'ClassificationTemplateRelationshipDelete',
                    'Eliminar relacion entre plantilla y clasificacion',
                    false,
                    'classification-template-relations'
                ),
                new Permissions(
                    'ClassificationTemplateRelationshipCreate',
                    'Crear relacion entre plantilla y clasificacion',
                    false,
                    'classification-template-relations'
                ),
                new Permissions(
                    'ClassificationTemplateRelationshipUpdate',
                    'Actualizar relacion entre un plantilla y clasificacion',
                    false,
                    'classification-template-relations'
                ),

                new Permissions('ClassificationCreate', 'Crear clasificacion', false, 'classifications'),
                new Permissions('ClassificationUpdate', 'Actualizar clasificacion', false, 'classifications'),
                new Permissions('ClassificationDelete', 'Eliminar clasificacion', false, 'classifications'),
                new Permissions('ClassificationRead', 'Ver clasificaciones', false, 'classifications'),

                new Permissions(
                    'ClassificationLevelsRead',
                    'Ver valores únicos de un nivel específico en las clasificaciones',
                    false,
                    'classifications-levels'
                ),

                new Permissions(
                    'ClientNotificationsCreate',
                    'Crear notificacion a cliente',
                    false,
                    'client-notifications'
                ),
                new Permissions(
                    'ClientNotificationsUpdate',
                    'Actualizar notificacion a cliente',
                    false,
                    'client-notifications'
                ),
                new Permissions(
                    'ClientNotificationsDelete',
                    'Eliminar notificacion a cliente',
                    false,
                    'client-notifications'
                ),
                new Permissions(
                    'ClientNotificationsRead',
                    'Ver notificacion a clientes',
                    false,
                    'client-notifications'
                ),

                new Permissions('ClientsUpdate', 'Actualizar cliente', false, 'clients'),
                new Permissions('ClientsDelete', 'Eliminar cliente', false, 'clients'),
                new Permissions('ClientsRead', 'Ver clientes', false, 'clients'),
                new Permissions('ClientsContactsRead', 'Ver contactos de un cliente', false, 'clients'),

                new Permissions(
                    'CognitoAuthorizationCreate',
                    'Autorizar autenticación con Cognito',
                    false,
                    'cognito-authorization'
                ),

                new Permissions('CommentsCreate', 'Crear comentario', false, 'comments'),
                new Permissions('CommentsUpdate', 'Actualizar comentario', false, 'comments'),
                new Permissions('CommentsDelete', 'Eliminar comentario', false, 'comments'),
                new Permissions('CommentsRead', 'Ver comentarios', false, 'comments'),

                new Permissions('FieldListsRead', 'Ver todos los nombres de los esquemas', false, 'field-lists'),

                new Permissions('FlowsCreate', 'Crear flujo', false, 'flows'),
                new Permissions('FlowsUpdate', 'Actualizar flujo', false, 'flows'),
                new Permissions('FlowsDelete', 'Eliminar flujo', false, 'flows'),
                new Permissions('FlowsRead', 'Ver flujos', false, 'flows'),

                new Permissions('GeolocationCreate', 'Crear geolocalización', false, 'geolocation'),
                new Permissions('GeolocationUpdate', 'Actualizar geolocalización', false, 'geolocation'),
                new Permissions('GeolocationDelete', 'Eliminar geolocalización', false, 'geolocation'),
                new Permissions('GeolocationRead', 'Ver geolocalización', false, 'geolocation'),

                new Permissions(
                    'GlobalConfigurationsCreate',
                    'Crear configuracion global',
                    false,
                    'global-configurations'
                ),
                new Permissions(
                    'GlobalConfigurationsUpdate',
                    'Actualizar configuracion global',
                    false,
                    'global-configurations'
                ),
                new Permissions(
                    'GlobalConfigurationsDelete',
                    'Eliminar configuracion global',
                    false,
                    'global-configurations'
                ),
                new Permissions(
                    'GlobalConfigurationsRead',
                    'Ver configuraciones globales',
                    false,
                    'global-configurations'
                ),

                new Permissions('CreateGlobalRule', 'Crear regla global', false, 'global-rules'),
                new Permissions('UpdateGlobalRule', 'Actualizar regla global', false, 'global-rules'),
                new Permissions('DeleteGlobalRule', 'Eliminar regla global', false, 'global-rules'),
                new Permissions('ReadGlobalRules', 'Ver reglas globales', false, 'global-rules'),

                new Permissions('GroupsCreate', 'Crear grupo', false, 'groups'),
                new Permissions('GroupsUpdate', 'Actualizar grupo', false, 'groups'),
                new Permissions('GroupsDelete', 'Eliminar grupo', false, 'groups'),
                new Permissions('GroupsRead', 'Ver grupos', false, 'groups'),

                new Permissions('GroupListsCreate', 'Crear lista de grupo', false, 'group-list'),
                new Permissions('GroupListsUpdate', 'Actualizar lista de grupo', false, 'group-list'),
                new Permissions('GroupListsDelete', 'Eliminar lista de grupo', false, 'group-list'),
                new Permissions('GroupListsRead', 'Ver lista de grupos', false, 'group-list'),

                new Permissions('HelpsCreate', 'Crear help', false, 'help'),
                new Permissions('HelpsUpdate', 'Actualizar help', false, 'help'),
                new Permissions('HelpsDelete', 'Eliminar help', false, 'help'),
                new Permissions('HelpsRead', 'Ver helps', false, 'help'),

                new Permissions('HelpAttachmentsCreate', 'Crear help attachment', false, 'help-attachments'),
                new Permissions('HelpAttachmentsDelete', 'Eliminar help attachment', false, 'help-attachments'),
                new Permissions('HelpAttachmentsRead', 'Ver help attachments', false, 'help-attachments'),

                new Permissions(
                    'ImportsProcessorExecute',
                    'Ejecutar procesamiento de importaciones',
                    false,
                    'imports-processor'
                ),
                new Permissions(
                    'ImportsDashboardRead',
                    'Consultar dashboard de importaciones',
                    false,
                    'imports-dashboard'
                ),
                new Permissions(
                    'AssignmentRunsRead',
                    'Consultar monitor de asignación automática',
                    false,
                    'assignment-runs'
                ),

                new Permissions('LiteralsCreate', 'Crear literal', false, 'literals'),
                new Permissions('LiteralsUpdate', 'Actualizar literal', false, 'literals'),
                new Permissions('LiteralsDelete', 'Eliminar literal', false, 'literals'),
                new Permissions('LiteralsRead', 'Ver literales', false, 'literals'),

                new Permissions('MailAccountsCreate', 'Crear cuenta de correo', false, 'mail-accounts'),
                new Permissions('MailAccountsUpdate', 'Actualizar cuenta de correo', false, 'mail-accounts'),
                new Permissions('MailAccountsDelete', 'Eliminar cuenta de correo', false, 'mail-accounts'),
                new Permissions('MailAccountsRead', 'Ver cuentas de correos', false, 'mail-accounts'),

                new Permissions('OneScriptsCreate', 'Crear OneScript', false, 'onescripts'),
                new Permissions('OneScriptsUpdate', 'Actualizar OneScript', false, 'onescripts'),
                new Permissions('OneScriptsDelete', 'Eliminar OneScript', false, 'onescripts'),
                new Permissions('OneScriptsRead', 'Ver OneScript', false, 'onescripts'),

                new Permissions('PermissionsRead', 'Ver lista de permisos del sistema', false, 'permissions'),

                new Permissions('PoliciesCreate', 'Crear politica', false, 'policy'),
                new Permissions('PoliciesUpdate', 'Actualizar politica', false, 'policy'),
                new Permissions('PoliciesDelete', 'Eliminar politica', false, 'policy'),
                new Permissions('PoliciesRead', 'Ver politicas', false, 'policy'),

                new Permissions('RolesCreate', 'Crear role', false, 'roles'),
                new Permissions('RolesUpdate', 'Actualizar role', false, 'roles'),
                new Permissions('RolesDelete', 'Eliminar role', false, 'roles'),
                new Permissions('RolesRead', 'Ver roles', false, 'roles'),

                new Permissions('S3FilesCreate', 'Crear s3 file', false, 's3-files'),
                new Permissions('S3FilesUpdate', 'Actualizar s3 file', false, 's3-files'),
                new Permissions('S3FilesDelete', 'Eliminar s3 file', false, 's3-files'),
                new Permissions('S3FilesRead', 'Ver s3 files', false, 's3-files'),
                new Permissions('S3FilesUpload', 'Subir archivos', false, 's3-files'),
                new Permissions('S3FilesDownload', 'Descargar archivos', false, 's3-files'),

                new Permissions('SecretsVaultCreate', 'Crear vaul de secreto', false, 'secrets-vault'),
                new Permissions('SecretsVaultUpdate', 'Actualizar vaul de secreto', false, 'secrets-vault'),
                new Permissions('SecretsVaultDelete', 'Eliminar vaul de secreto', false, 'secrets-vault'),
                new Permissions('SecretsVaultsRead', 'Ver vaules de secretos', false, 'secrets-vault'),

                new Permissions('ShiftManagementCreate', 'Crear gestion de turno', false, 'shift-management'),
                new Permissions('ShiftManagementUpdate', 'Actualizar gestion de turno', false, 'shift-management'),
                new Permissions('ShiftManagementDelete', 'Eliminar gestion de turno', false, 'shift-management'),
                new Permissions('ShiftManagementsRead', 'Ver gestiones de turnos', false, 'shift-management'),

                new Permissions('StatesCreate', 'Crear estado', false, 'state'),
                new Permissions('StatesUpdate', 'Actualizar estado', false, 'state'),
                new Permissions('StatesDelete', 'Eliminar estado', false, 'state'),
                new Permissions('StatesRead', 'Ver estados', false, 'state'),

                new Permissions('TemplatesCreate', 'Crear plantilla', false, 'templates'),
                new Permissions('TemplatesUpdate', 'Actualizar plantilla', false, 'templates'),
                new Permissions('TemplatesDelete', 'Eliminar plantilla', false, 'templates'),
                new Permissions('TemplatesRead', 'Ver plantillas', false, 'templates'),

                new Permissions(
                    'TemplateAttachmentsCreate',
                    'Crear adjunto de plantilla',
                    false,
                    'template-attachments'
                ),
                new Permissions(
                    'TemplateAttachmentsUpdate',
                    'Actualizar adjunto de plantilla',
                    false,
                    'template-attachments'
                ),
                new Permissions(
                    'TemplateAttachmentsDelete',
                    'Eliminar adjunto de plantilla',
                    false,
                    'template-attachments'
                ),
                new Permissions('TemplateAttachmentsRead', 'Ver adjuntos de plantillas', false, 'template-attachments'),

                new Permissions('TransitionsCreate', 'Crear transicion', false, 'transitions'),
                new Permissions('TransitionsUpdate', 'Actualizar transicion', false, 'transitions'),
                new Permissions('TransitionsDelete', 'Eliminar transicion', false, 'transitions'),
                new Permissions('TransitionsRead', 'Ver transiciones', false, 'transitions'),

                new Permissions('TransitionRulesCreate', 'Crear regla de transición', false, 'transition-rules'),
                new Permissions('TransitionRulesUpdate', 'Actualizar regla de transición', false, 'transition-rules'),
                new Permissions('TransitionRulesDelete', 'Eliminar regla de transición', false, 'transition-rules'),
                new Permissions('TransitionRulesRead', 'Ver reglas de transición', false, 'transition-rules'),

                new Permissions(
                    'FolioConfigurationsCreate',
                    'Crear configuración de folio',
                    false,
                    'folio-configurations'
                ),
                new Permissions(
                    'FolioConfigurationsUpdate',
                    'Actualizar configuración de folio',
                    false,
                    'folio-configurations'
                ),
                new Permissions(
                    'FolioConfigurationsDelete',
                    'Eliminar configuración de folio',
                    false,
                    'folio-configurations'
                ),
                new Permissions(
                    'FolioConfigurationsRead',
                    'Ver configuraciones de folio',
                    false,
                    'folio-configurations'
                ),

                new Permissions('CustomListsCreate', 'Crear Lista Personalizada', false, 'custom-lists'),
                new Permissions('CustomListsUpdate', 'Actualizar Lista Personalizada', false, 'custom-lists'),
                new Permissions('CustomListsDelete', 'Eliminar Lista Personalizada', false, 'custom-lists'),
                new Permissions('CustomListsRead', 'Ver Lista Personalizada', false, 'custom-lists'),

                new Permissions(
                    'UserCasesAssigmentCreate',
                    'Asignar responsables a casos',
                    false,
                    'user-cases-assigment'
                ),

                new Permissions(
                    'UserGroupsRelationshipRead',
                    'Ver relaciones entre usuario y grupo',
                    false,
                    'user-group-relationships'
                ),
                new Permissions(
                    'UserGroupsRelationshipCreate',
                    'Crear relacion entre usuario y grupo',
                    false,
                    'user-group-relationships'
                ),
                new Permissions(
                    'UserGroupsRelationshipDelete',
                    'Eliminar relacion entre usuario y grupo',
                    false,
                    'user-group-relationships'
                ),

                new Permissions('UserListsCreate', 'Crear lista de usuarios', false, 'user-lists'),
                new Permissions('UserListsUpdate', 'Actualizar lista de usuarios', false, 'user-lists'),
                new Permissions('UserListsDelete', 'Eliminar lista de usuarios', false, 'user-lists'),
                new Permissions('UserListsRead', 'Ver lista de usuarios', false, 'user-lists'),

                new Permissions(
                    'UserNotificationsCreate',
                    'Crear notificacion a usuarios',
                    false,
                    'user-notifications'
                ),
                new Permissions(
                    'UserNotificationsUpdate',
                    'Actualizar notificacion a usuarios',
                    false,
                    'user-notifications'
                ),
                new Permissions(
                    'UserNotificationsDelete',
                    'Eliminar notificacion a usuarios',
                    false,
                    'user-notifications'
                ),
                new Permissions('UserNotificationsRead', 'Ver notificacion a usuarios', false, 'user-notifications'),

                new Permissions('UsersCreate', 'Crear usuario', false, 'users'),
                new Permissions('UsersUpdate', 'Actualizar usuario', false, 'users'),
                new Permissions('UsersDelete', 'Eliminar usuario', false, 'users'),
                new Permissions('UsersRead', 'Ver usuarios', false, 'users'),
                new Permissions('UsersLogin', 'Iniciar sesión en el sistema', false, 'users'),

                new Permissions('WsRestEndpointsCreate', 'Crear ws rest endpoint', false, 'ws-rest-endpoints'),
                new Permissions('WsRestEndpointsUpdate', 'Actualizar ws rest endpoint', false, 'ws-rest-endpoints'),
                new Permissions('WsRestEndpointsDelete', 'Eliminar ws rest endpoint', false, 'ws-rest-endpoints'),
                new Permissions('WsRestEndpointsRead', 'Ver ws rest endpoints', false, 'ws-rest-endpoints'),

                new Permissions('WsRestFlowsCreate', 'Crear ws rest flow', false, 'ws-rest-flows'),
                new Permissions('WsRestFlowsUpdate', 'Actualizar ws rest flow', false, 'ws-rest-flows'),
                new Permissions('WsRestFlowsDelete', 'Eliminar ws rest flow', false, 'ws-rest-flows'),
                new Permissions('WsRestFlowsRead', 'Ver ws rest flows', false, 'ws-rest-flows'),

                new Permissions('WsRestFunctionCreate', 'Crear ws rest function', false, 'ws-rest-functions'),
                new Permissions('WsRestFunctionUpdate', 'Actualizar ws rest function', false, 'ws-rest-functions'),
                new Permissions('WsRestFunctionDelete', 'Eliminar ws rest function', false, 'ws-rest-functions'),
                new Permissions('WsRestFunctionRead', 'Ver ws rest function', false, 'ws-rest-functions'),

                new Permissions(
                    'WsRestWorkFlowsStepsCreate',
                    'Crear ws rest workflow step',
                    false,
                    'ws-rest-workflow-steps'
                ),
                new Permissions(
                    'WsRestWorkFlowsStepsUpdate',
                    'Actualizar ws rest workflow step',
                    false,
                    'ws-rest-workflow-steps'
                ),
                new Permissions(
                    'WsRestWorkFlowsStepsDelete',
                    'Eliminar ws rest workflow step',
                    false,
                    'ws-rest-workflow-steps'
                ),
                new Permissions(
                    'WsRestWorkFlowsStepsRead',
                    'Ver ws rest workflow steps',
                    false,
                    'ws-rest-workflow-steps'
                ),

                new Permissions('GenerateCsvCreate', 'Crear exportacion de vista', false, 'csv-export-views'),
                new Permissions('GenerateCsvUpdate', 'Actualizar exportacion de vista', false, 'csv-export-views'),
                new Permissions('GenerateCsvDelete', 'Eliminar exportacion de vista', false, 'csv-export-views'),
                new Permissions('GenerateCsvRead', 'Ver exportacion de vistas', false, 'csv-export-views'),

                new Permissions('Imports', 'Importacion de catalogos', false, 'imports'),
                new Permissions('Exports', 'Exportacion de catalogos', false, 'exports'),

                new Permissions('AutomationSettingsCreate', 'Crear automatizacion', false, 'automation-settings'),
                new Permissions('AutomationSettingsUpdate', 'Actualizar Automatizacion', false, 'automation-settings'),
                new Permissions('AutomationSettingsDelete', 'Eliminar Automatizacion', false, 'automation-settings'),
                new Permissions('AutomationSettingsRead', 'Ver Automatizacion', false, 'automation-settings'),

                new Permissions('WsHookRestFlowCreate', 'Crear ws hook rest flow', false, 'ws-hook-rest-flows'),
                new Permissions('WsHookRestFlowRead', 'Ver ws hook rest flows', false, 'ws-hook-rest-flows'),

                new Permissions('AuxUsersCreate', 'Crear aux user', false, 'aux-users'),
                new Permissions('AuxUsersUpdate', 'Actualizar aux user', false, 'aux-users'),
                new Permissions('AuxUsersDelete', 'Eliminar aux user', false, 'aux-users'),
                new Permissions('AuxUsersRead', 'Ver aux users', false, 'aux-users'),

                new Permissions('AuxDefinitionsCreate', 'Crear aux definition', false, 'aux-definitions'),
                new Permissions('AuxDefinitionsUpdate', 'Actualizar aux definition', false, 'aux-definitions'),
                new Permissions('AuxDefinitionsRead', 'Ver aux definitions', false, 'aux-definitions'),

                new Permissions('SchemasCreate', 'Crear schema', false, 'schemas'),
                new Permissions('SchemasUpdate', 'Actualizar schema', false, 'schemas'),
                new Permissions('SchemasDelete', 'Eliminar schema', false, 'schemas'),
                new Permissions('SchemasRead', 'Ver schemas', false, 'schemas'),
                new Permissions('SchemasRelationsCount', 'Ver conteo de relaciones de un schema', false, 'schemas'),

                new Permissions('AuxiliaryCreate', 'Crear auxiliar', false, 'auxiliaries'),
                new Permissions('AuxiliaryUpdate', 'Actualizar auxiliar', false, 'auxiliaries'),
                new Permissions('AuxiliaryDelete', 'Eliminar auxiliar', false, 'auxiliaries'),
                new Permissions('AuxiliaryRead', 'Ver auxiliares', false, 'auxiliaries'),

                new Permissions('EventLogsRead', 'Ver registro de eventos', false, 'event-logs'),

                new Permissions(
                    'ClassificationsFlowsCreate',
                    'Crear flujos de clasificaciones',
                    false,
                    'classifications-flows'
                ),
                new Permissions(
                    'ClassificationsFlowsUpdate',
                    'Actualizar flujos de clasificaciones',
                    false,
                    'classifications-flows'
                ),
                new Permissions(
                    'ClassificationsFlowsDelete',
                    'Eliminar flujos de clasificaciones',
                    false,
                    'classifications-flows'
                ),
                new Permissions(
                    'ClassificationsFlowsRead',
                    'Ver flujos de clasificaciones',
                    false,
                    'classifications-flows'
                ),

                new Permissions(
                    'SubCasesRelationshipRead',
                    'Ver relaciones entre caso padre y subcaso',
                    false,
                    'subcase-relationships'
                ),
                new Permissions(
                    'SubCasesRelationshipCreate',
                    'Crear relación entre caso padre y subcaso',
                    false,
                    'subcase-relationships'
                ),
                new Permissions(
                    'SubCasesRelationshipDelete',
                    'Eliminar relación entre caso padre y subcaso',
                    false,
                    'subcase-relationships'
                ),

                new Permissions('WorkspacesCreate', 'Crear workspace', false, 'workspaces'),
                new Permissions('WorkspacesUpdate', 'Actualizar workspace', false, 'workspaces'),
                new Permissions('WorkspacesDelete', 'Eliminar workspace', false, 'workspaces'),
                new Permissions('WorkspacesRead', 'Ver workspace', false, 'workspaces'),

                new Permissions('BoardsCreate', 'Crear tablero', false, 'boards'),
                new Permissions('BoardsUpdate', 'Actualizar tablero', false, 'boards'),
                new Permissions('BoardsDelete', 'Eliminar tablero', false, 'boards'),
                new Permissions('BoardsRead', 'Ver tablero', false, 'boards'),
                new Permissions('BoardsExport', 'Descargar datos del tablero', false, 'boards'),
                new Permissions('BoardsReadRegister', 'Ver registro en tablero', false, 'boards'),
                new Permissions('BoardsCreateRegister', 'Crear registro en tablero', false, 'boards'),
                new Permissions('BoardsUpdateRegister', 'Actualizar registro en tablero', false, 'boards'),
                new Permissions(
                    'BoardsAccessAll',
                    'Ver todos los tableros, con o sin acceso configurado',
                    false,
                    'boards'
                ),

                new Permissions('BrokerAdaptersCreate', 'Crear adaptador', false, 'broker_adapters'),
                new Permissions('BrokerAdaptersUpdate', 'Actualizar adaptador', false, 'broker_adapters'),
                new Permissions('BrokerAdaptersDelete', 'Eliminar adaptador', false, 'broker_adapters'),
                new Permissions('BrokerAdaptersRead', 'Ver adaptador', false, 'broker_adapters'),

                new Permissions('BrokerMappersCreate', 'Crear mapa', false, 'broker_mappers'),
                new Permissions('BrokerMappersUpdate', 'Actualizar mapa', false, 'broker_mappers'),
                new Permissions('BrokerMappersDelete', 'Eliminar mapa', false, 'broker_mappers'),
                new Permissions('BrokerMappersRead', 'Ver mapa', false, 'broker_mappers'),

                new Permissions('EmailsCreate', 'Crear email', false, 'emails'),
                new Permissions('EmailsUpdate', 'Actualizar email', false, 'emails'),
                new Permissions('EmailsDelete', 'Eliminar email', false, 'emails'),
                new Permissions('EmailsRead', 'Ver emails', false, 'emails'),

                new Permissions('InteractionsCreate', 'Crear interacion', false, 'interactions'),
                new Permissions('InteractionsUpdate', 'Actualizar interacion', false, 'interactions'),
                new Permissions('InteractionsDelete', 'Eliminar interacion', false, 'interactions'),
                new Permissions('InteractionsRead', 'Ver interacciones', false, 'interactions'),
                new Permissions('InteractionsBulkClose', 'Cerrar interacciones en lote', false, 'interactions'),
                new Permissions('InteractionsBulkMove', 'Mover interacciones en lote', false, 'interactions'),
                new Permissions('InteractionsBulkAssign', 'Asignar interacciones en lote', false, 'interactions'),
                new Permissions('InteractionsBulkUnassign', 'Desasignar interacciones en lote', false, 'interactions'),
            ],
            auxiliaries: [],
            search: SearchPermissionsCatalog.definitions(),
        };
    }

    get permissions() {
        return this.#permissions;
    }

    toPrimivites() {
        const permissions = {};
        Object.entries(this.#permissions).forEach(([key, value]) => {
            permissions[key] = value.map((permission) => permission.toPrimitives());
        });
        return permissions;
    }

    static fromPrimitives(data) {
        const listPermissions = new ListPermissions();

        for (const [role, permissions] of Object.entries(data)) {
            if (role === 'auxiliaries') {
                listPermissions.#permissions[role] = permissions.map(
                    (perm) => new AuxPermissions(perm.name, perm.description, perm.granted, perm.module_id)
                );
            } else {
                listPermissions.#permissions[role] = permissions.map(
                    (perm) => new Permissions(perm.name, perm.description, perm.granted, perm.module_id)
                );
            }
        }
        return listPermissions;
    }

    isValidPermissions(rolePermissions, role) {
        if (role === 'auxiliaries') {
            return true;
        }

        if (!this.#permissions[role]) {
            throw new Error(`Invalid role "${role}".`);
        }
        return this.#permissions[role].some(
            (perm) => perm.name === rolePermissions.name && perm.module_id === rolePermissions.module_id
        );
    }
}
