export class ActionsEnum {
    static ALL = new ActionsEnum('CRUD', 'all');
    static DASHBOARD = new ActionsEnum('DASHBOAR', 'dashboard');
    static CASOS = new ActionsEnum('CASOS', 'cases');
    static FLUJOS = new ActionsEnum('FLUJOS', 'flows');
    static ESTADOS = new ActionsEnum('ESTADOS', 'states');
    static ANS = new ActionsEnum('ANS', 'ans');
    static ACCIONES = new ActionsEnum('DELETE', 'actions');
    static LISTA_GRUPOS = new ActionsEnum('LISTA_GRUPOS', 'group-lists');
    static CLASIFICACIONES = new ActionsEnum('CLASIFICACIONES', 'classifications');
    static BANNERS = new ActionsEnum('BANNERS', 'banners');
    static LITERALES = new ActionsEnum('LITERALES', 'literals');
    static NOTIFICACIONES_AGENTE = new ActionsEnum('NOTIFICACIONES_AGENTE', 'user-notifications');
    static NOTIFICACIONES_CLIENTE = new ActionsEnum('NOTIFICACIONES_CLIENTE', 'client-notifications');
    static HORARIOS = new ActionsEnum('HORARIOS', 'shift-management');
    static GRUPOS = new ActionsEnum('GRUPOS', 'groups');
    static USUARIOS = new ActionsEnum('USUARIOS', 'users');
    static LISTA_USUARIOS = new ActionsEnum('LISTA_USUARIOS', 'user-lists');
    static CONFIGURACION_GLOBAL = new ActionsEnum('CONFIGURACION_GLOBAL', 'global-config');
    static ROLES = new ActionsEnum('ROLES', 'roles');
    static BAUL_SECRETOS = new ActionsEnum('BAUL_SECRETOS', 'secrets-vaults');
    static CUENTAS_CORREO = new ActionsEnum('CUENTAS_CORREO', 'mail-accounts');
    static CONEXIONES_PERMITIDAS = new ActionsEnum('CONEXIONES_PERMITIDAS', 'allowed-connections');
    static CLONAR_CASO = new ActionsEnum('CLONAR_CASO', 'cases/{id}/clone');
    static REABRIR_CASO = new ActionsEnum('REABRIR_CASO', 'cases/{id}/{commentId}/re-open');
    static EDITAR_ESTADOS_CASO = new ActionsEnum('EDITAR_ESTADOS_CASO', 'editar_estados_caso');
    static EDITAR_ESTADOS_SIN_SER_RESPONSABLE_CASO = new ActionsEnum(
        'EDITAR_ESTADOS_SIN_SER_RESPONSABLE_CASO',
        'editar_estados_sin_ser_responsable_caso'
    );
    static EDITAR_FORMULARIO_CASO = new ActionsEnum('EDITAR_FORMULARIO_CASO', 'editar_formulario_caso');
    static RECLASIFICAR_CASO = new ActionsEnum('RECLASIFICAR_CASO', 'cases/{id}/reclassify');
    static ADJUNTAR_FICHEROS_CASO = new ActionsEnum('ADJUNTAR_FICHEROS_CASO', 'adjuntar_ficheros_caso');

    constructor(key, value) {
        this.#ensureIsValidAction(value);

        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    #ensureIsValidAction(value) {
        if (!value) throw new Error(`Invalid value: ${value}`);
    }

    static fromValue(value) {
        if (value === 'all') return ActionsEnum.ALL;
        if (value === 'dashboard') return ActionsEnum.DASHBOARD;
        if (value === 'casos') return ActionsEnum.CASOS;
        if (value === 'flujos') return ActionsEnum.FLUJOS;
        if (value === 'estados') return ActionsEnum.ESTADOS;
        if (value === 'ans') return ActionsEnum.ANS;
        if (value === 'acciones') return ActionsEnum.ACCIONES;
        if (value === 'lista_grupos') return ActionsEnum.LISTA_GRUPOS;
        if (value === 'clasificaciones') return ActionsEnum.CLASIFICACIONES;
        if (value === 'banners') return ActionsEnum.BANNERS;
        if (value === 'literales') return ActionsEnum.LITERALES;
        if (value === 'notificaciones_agente') return ActionsEnum.NOTIFICACIONES_AGENTE;
        if (value === 'notificaciones_cliente') return ActionsEnum.NOTIFICACIONES_CLIENTE;
        if (value === 'horarios') return ActionsEnum.HORARIOS;
        if (value === 'grupos') return ActionsEnum.GRUPOS;
        if (value === 'usuarios') return ActionsEnum.USUARIOS;
        if (value === 'lista_usuarios') return ActionsEnum.LISTA_USUARIOS;
        if (value === 'configuracion_global') return ActionsEnum.CONFIGURACION_GLOBAL;
        if (value === 'roles') return ActionsEnum.ROLES;
        if (value === 'baul_secretos') return ActionsEnum.BAUL_SECRETOS;
        if (value === 'cuentas_correo') return ActionsEnum.CUENTAS_CORREO;
        if (value === 'conexiones_permitidas') return ActionsEnum.CONEXIONES_PERMITIDAS;
        if (value === 'clonar_caso') return ActionsEnum.CLONAR_CASO;
        if (value === 'reabrir_caso') return ActionsEnum.REABRIR_CASO;
        if (value === 'editar_estados_caso') return ActionsEnum.EDITAR_ESTADOS_CASO;
        if (value === 'editar_estados_sin_ser_responsable_caso')
            return ActionsEnum.EDITAR_ESTADOS_SIN_SER_RESPONSABLE_CASO;
        if (value === 'editar_formulario_caso') return ActionsEnum.EDITAR_FORMULARIO_CASO;
        if (value === 'reclasificar_caso') return ActionsEnum.RECLASIFICAR_CASO;
        if (value === 'adjuntar_ficheros_caso') return ActionsEnum.ADJUNTAR_FICHEROS_CASO;
        throw new Error(`Invalid value: ${value}`);
    }

    static toJson() {
        return {
            ALL: ActionsEnum.ALL.value,
            DASHBOARD: ActionsEnum.DASHBOARD.value,
            CASOS: ActionsEnum.CASOS.value,
            FLUJOS: ActionsEnum.FLUJOS.value,
            ESTADOS: ActionsEnum.ESTADOS.value,
            ANS: ActionsEnum.ANS.value,
            ACCIONES: ActionsEnum.ACCIONES.value,
            LISTA_GRUPOS: ActionsEnum.LISTA_GRUPOS.value,
            CLASIFICACIONES: ActionsEnum.CLASIFICACIONES.value,
            BANNERS: ActionsEnum.BANNERS.value,
            LITERALES: ActionsEnum.LITERALES.value,
            NOTIFICACIONES_AGENTE: ActionsEnum.NOTIFICACIONES_AGENTE.value,
            NOTIFICACIONES_CLIENTE: ActionsEnum.NOTIFICACIONES_CLIENTE.value,
            HORARIOS: ActionsEnum.HORARIOS.value,
            GRUPOS: ActionsEnum.GRUPOS.value,
            USUARIOS: ActionsEnum.USUARIOS.value,
            LISTA_USUARIOS: ActionsEnum.LISTA_USUARIOS.value,
            CONFIGURACION_GLOBAL: ActionsEnum.CONFIGURACION_GLOBAL.value,
            ROLES: ActionsEnum.ROLES.value,
            BAUL_SECRETOS: ActionsEnum.BAUL_SECRETOS.value,
            CUENTAS_CORREO: ActionsEnum.CUENTAS_CORREO.value,
            CONEXIONES_PERMITIDAS: ActionsEnum.CONEXIONES_PERMITIDAS.value,
            CLONAR_CASO: ActionsEnum.CLONAR_CASO.value,
            REABRIR_CASO: ActionsEnum.REABRIR_CASO.value,
            EDITAR_ESTADOS_CASO: ActionsEnum.EDITAR_ESTADOS_CASO.value,
            EDITAR_ESTADOS_SIN_SER_RESPONSABLE_CASO: ActionsEnum.EDITAR_ESTADOS_SIN_SER_RESPONSABLE_CASO.value,
            EDITAR_FORMULARIO_CASO: ActionsEnum.EDITAR_FORMULARIO_CASO.value,
            RECLASIFICAR_CASO: ActionsEnum.RECLASIFICAR_CASO.value,
            ADJUNTAR_FICHEROS_CASO: ActionsEnum.ADJUNTAR_FICHEROS_CASO.value,
        };
    }
}
