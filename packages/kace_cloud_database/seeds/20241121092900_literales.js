import { v4 as Uuid } from 'uuid';
import { globalUserId } from './20241125105900_usuario_base.js';
/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    const existData = await knex.queryBuilder().select('id').from('literales').limit(1);

    if (existData.length > 0) return;

    const tablas = [
        'clientes',
        'mail_accounts',
        'busquedaCliente',
        'notificaciones',
        'cargaAlertas',
        'banners',
        'interactions',
    ];

    const campos = {
        clientes: ['tipo_documento', 'sexo', 'estado_civil'],
        mail_accounts: ['protocol', 'encryption'],
        busquedaCliente: [
            'Documento',
            'Teléfono',
            'Teléfono alterno',
            'Nombres',
            'Apellido 1',
            'Apellido 2',
            'Email',
            'Email alterno',
        ],
        notificaciones: ['tipo_notificacion'],
        cargaAlertas: ['tipo_alerta'],
        banners: ['posicion', 'color', 'size'],
        interactions: ['closed_observation'],
    };

    const valores = {
        clientes: {
            tipo_documento: ['CC', 'TJ', 'CE', 'Pasaporte'],
            sexo: ['Masculino', 'Femenino', 'Otro'],
            estado_civil: ['Casado', 'Soltero', 'Unión Libre'],
        },
        mail_accounts: {
            protocol: ['smtp'],
            encryption: ['tls'],
        },
        notificaciones: {
            tipo_notificacion: ['Incidencia', 'Novedad'],
        },
        cargaAlertas: {
            tipo_alerta: ['Notificacion', 'Banner'],
        },
        banners: {
            posicion: ['top', 'bottom'],
            color: ['primary', 'success', 'danger', 'warning'],
            size: ['large', 'medium'],
        },
        interactions: {
            closed_observation: ['Finalizado Exitoso', 'Spam', 'Duplicado', 'Cerrado sin gestión'],
        },
    };

    for (const tabla of tablas) {
        const tablaId = Uuid();
        await knex('literales').insert({
            id: tablaId,
            nombre: tabla,
            tipo_literal: null,
            is_active: true,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
            created_by: globalUserId,
            updated_by: null,
        });

        for (const campo of campos[tabla]) {
            const campoId = Uuid();
            await knex('literales').insert({
                id: campoId,
                nombre: campo,
                tipo_literal: tablaId,
                is_active: true,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
                created_by: globalUserId,
                updated_by: null,
            });

            if (valores[tabla]?.[campo]) {
                for (const value of valores[tabla][campo]) {
                    await knex('literales').insert({
                        id: Uuid(),
                        nombre: value,
                        tipo_literal: campoId,
                        is_active: true,
                        created_at: knex.fn.now(),
                        updated_at: knex.fn.now(),
                        created_by: globalUserId,
                        updated_by: null,
                    });
                }
            }
        }
    }
}
