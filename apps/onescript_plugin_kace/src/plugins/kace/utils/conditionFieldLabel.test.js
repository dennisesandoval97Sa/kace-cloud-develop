import { afterEach, describe, expect, it } from 'vitest';
import {
  conditionFieldLabel,
  storeConditionFieldLabel,
} from './conditionFieldLabel.js';

describe('conditionFieldLabel', () => {
  it.each([
    ['cases.responsable_id', 'el responsable'],
    ['casos.responsable_id', 'el responsable'],
    ['cases.grupo_id', 'el grupo'],
    ['cases.estadoActual', 'el estado'],
    ['estados.id', 'el estado'],
    ['cases.clasificacion_id', 'la clasificación'],
    ['clasificaciones.id', 'la clasificación'],
    ['clasificaciones.description', 'la clasificación'],
    ['cases.closed_by', 'el usuario que cerró el caso'],
  ])('names the entity behind %s', (field, phrase) => {
    expect(conditionFieldLabel(field)).toBe(phrase);
  });

  it.each([
    ['cases.antiguedad_dias', 'el campo «Antigüedad del caso en días»'],
    ['cases.state_elapsed_hours', 'el campo «Antigüedad del estado en horas»'],
    ['cases.motivo_baja', 'el campo «Motivo baja»'],
    ['cases.sla_remaining_days', 'el campo «Tiempo restante del ANS en días»'],
    ['estados.nombre', 'el campo «Nombre» del estado'],
  ])('uses the Spanish label of the case field %s', (field, phrase) => {
    expect(conditionFieldLabel(field)).toBe(phrase);
  });

  it('says a client field belongs to the client', () => {
    expect(conditionFieldLabel('clients.documento')).toBe(
      'el campo «Documento» del cliente'
    );
  });

  it('prefers the client label the tenant configured', () => {
    expect(
      conditionFieldLabel('clients.campos_extra1', {
        adminConfig: { clients: { campos_extra1: 'Número de póliza' } },
      })
    ).toBe('el campo «Número de póliza» del cliente');
  });

  it('names a classification level with the label the tenant configured', () => {
    expect(
      conditionFieldLabel('clasificaciones.nivel2', {
        adminConfig: { classifications: { label_2: 'Tipo de solicitud' } },
      })
    ).toBe('el campo «Tipo de solicitud» de la clasificación');
  });

  it('falls back to the level number when the tenant did not name it', () => {
    expect(conditionFieldLabel('clasificaciones.nivel3')).toBe(
      'el campo «Nivel 3» de la clasificación'
    );
  });

  it('names a form field with the label the advisor sees in the form', () => {
    const findFormLabel = (path) =>
      path === 'datos.ciudad_origen' ? 'Ciudad de origen' : undefined;

    expect(
      conditionFieldLabel('aux_cases.datos.ciudad_origen', { findFormLabel })
    ).toBe('el campo «Ciudad de origen»');
  });

  it('humanizes the key of a form field it cannot find in the form', () => {
    expect(conditionFieldLabel('aux_cases.datos.ciudad_origen')).toBe(
      'el campo «Ciudad origen»'
    );
  });

  it('says an auxiliary client or user field belongs to them', () => {
    expect(conditionFieldLabel('aux_clients.segmento')).toBe(
      'el campo «Segmento» del cliente'
    );
    expect(conditionFieldLabel('aux_users.sede')).toBe(
      'el campo «Sede» del usuario'
    );
  });

  it('humanizes a case field it does not know', () => {
    expect(conditionFieldLabel('cases.campo_nuevo')).toBe(
      'el campo «Campo nuevo»'
    );
  });

  it('never breaks on an unusable field', () => {
    expect(conditionFieldLabel(undefined)).toBe('un campo');
    expect(conditionFieldLabel('')).toBe('un campo');
  });
});

describe('storeConditionFieldLabel', () => {
  afterEach(() => {
    delete globalThis.Formio;
  });

  const storeWith = (admin) => ({
    get: (path) =>
      path === 'config.global_config.layouts.application.admin'
        ? admin
        : undefined,
  });

  it('reads the tenant labels from the global configuration in the store', () => {
    const label = storeConditionFieldLabel(
      storeWith({ classifications: { label_1: 'Producto' } })
    );

    expect(label('clasificaciones.nivel1')).toBe(
      'el campo «Producto» de la clasificación'
    );
  });

  it('reads form labels from the forms Form.io has rendered', () => {
    globalThis.Formio = {
      forms: {
        f1: {
          getComponent: (key) =>
            key === 'monto'
              ? { component: { label: 'Monto reclamado' } }
              : null,
        },
      },
    };

    expect(storeConditionFieldLabel(storeWith(null))('aux_cases.monto')).toBe(
      'el campo «Monto reclamado»'
    );
  });

  it('falls back to the leaf key when the form nests the field differently', () => {
    globalThis.Formio = {
      forms: {
        f1: {
          getComponent: (key) =>
            key === 'monto'
              ? { component: { label: 'Monto reclamado' } }
              : null,
        },
      },
    };

    expect(
      storeConditionFieldLabel(storeWith(null))('aux_cases.datos.monto')
    ).toBe('el campo «Monto reclamado»');
  });

  it('survives a form whose lookup throws', () => {
    globalThis.Formio = {
      forms: {
        f1: {
          getComponent: () => {
            throw new Error('destroyed form');
          },
        },
      },
    };

    expect(storeConditionFieldLabel(storeWith(null))('aux_cases.monto')).toBe(
      'el campo «Monto»'
    );
  });
});
