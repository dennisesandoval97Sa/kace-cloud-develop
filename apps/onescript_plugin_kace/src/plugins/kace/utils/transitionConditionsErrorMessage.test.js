import { describe, expect, it } from 'vitest';
import { CASE_TRANSITION_CONDITIONS_NOT_MET } from '@kace/error-codes';
import {
  transitionConditionsErrorFromHttp,
  transitionConditionsErrorMessage,
} from './transitionConditionsErrorMessage.js';

const GENERIC =
  'Las condiciones configuradas para esta transición no se cumplen';

const CAMILO = '11111111-1111-4111-8111-111111111111';
const PEDRO = '22222222-2222-4222-8222-222222222222';

const blocker = (failed, combinator = 'and') => ({
  code: CASE_TRANSITION_CONDITIONS_NOT_MET,
  conditions: { combinator, failed },
});

const messageFor = (condition, options) =>
  transitionConditionsErrorMessage(blocker([condition]), options);

describe('transitionConditionsErrorMessage', () => {
  describe('entities', () => {
    it('names the responsable the rule expects and the one the case has', () => {
      expect(
        messageFor({
          field: 'cases.responsable_id',
          operator: '=',
          value_type: 'text',
          expected: CAMILO,
          actual: PEDRO,
          expected_label: 'Camilo Londoño',
          actual_label: 'Pedro Pérez',
        })
      ).toBe(
        'No se puede cambiar el estado: el responsable debe ser «Camilo Londoño» (actualmente es «Pedro Pérez»).'
      );
    });

    it('says the case has no responsable when the actual value is empty', () => {
      expect(
        messageFor({
          field: 'cases.responsable_id',
          operator: '=',
          expected: CAMILO,
          actual: null,
          expected_label: 'Camilo Londoño',
        })
      ).toBe(
        'No se puede cambiar el estado: el responsable debe ser «Camilo Londoño» (actualmente está vacío).'
      );
    });

    it('lists every name of an in condition', () => {
      expect(
        messageFor({
          field: 'cases.grupo_id',
          operator: 'in',
          expected: ['g1', 'g2'],
          expected_label: ['Soporte', 'Ventas'],
          actual: 'g3',
          actual_label: 'Cobranza',
        })
      ).toBe(
        'No se puede cambiar el estado: el grupo debe ser uno de: «Soporte», «Ventas» (actualmente es «Cobranza»).'
      );
    });

    it('shows the id when the entity could not be named', () => {
      expect(
        messageFor({
          field: 'cases.responsable_id',
          operator: '!=',
          expected: CAMILO,
          actual: CAMILO,
        })
      ).toBe(
        `No se puede cambiar el estado: el responsable no debe ser «${CAMILO}» (actualmente es «${CAMILO}»).`
      );
    });
  });

  describe('fields', () => {
    it('names a case field by its label', () => {
      expect(
        messageFor({
          field: 'cases.antiguedad_dias',
          operator: '>',
          value_type: 'number',
          expected: 3,
          actual: 1,
        })
      ).toBe(
        'No se puede cambiar el estado: el campo «Antigüedad del caso en días» debe ser mayor que «3» (actualmente es «1»).'
      );
    });

    it('says a client field does not meet the condition when both values are hidden', () => {
      expect(
        messageFor({
          field: 'clients.documento',
          operator: '=',
          value_type: 'text',
          redacted: true,
        })
      ).toBe(
        'No se puede cambiar el estado: el campo «Documento» del cliente no cumple la condición configurada.'
      );
    });

    it('shows the expected value of a client field but not its actual value', () => {
      expect(
        messageFor({
          field: 'clients.nombres',
          operator: '=',
          value_type: 'text',
          expected: 'Ana',
          redacted: true,
        })
      ).toBe(
        'No se puede cambiar el estado: el campo «Nombres» del cliente debe ser «Ana».'
      );
    });

    it('uses the field label the caller resolves', () => {
      expect(
        messageFor(
          {
            field: 'aux_cases.monto',
            operator: '>=',
            redacted: true,
          },
          { fieldLabel: () => 'el campo «Monto reclamado»' }
        )
      ).toBe(
        'No se puede cambiar el estado: el campo «Monto reclamado» no cumple la condición configurada.'
      );
    });

    it('writes booleans in Spanish', () => {
      expect(
        messageFor({
          field: 'cases.alto_impacto',
          operator: '=',
          value_type: 'boolean',
          expected: true,
          actual: false,
        })
      ).toBe(
        'No se puede cambiar el estado: el campo «Alto impacto» debe ser «sí» (actualmente es «no»).'
      );
    });
  });

  describe('operators', () => {
    it.each([
      ['=', 'x', 'debe ser «x»'],
      ['!=', 'x', 'no debe ser «x»'],
      ['<', 5, 'debe ser menor que «5»'],
      ['>', 5, 'debe ser mayor que «5»'],
      ['<=', 5, 'debe ser menor o igual que «5»'],
      ['>=', 5, 'debe ser mayor o igual que «5»'],
      ['contains', 'x', 'debe contener «x»'],
      ['doesNotContain', 'x', 'no debe contener «x»'],
      ['beginsWith', 'x', 'debe comenzar con «x»'],
      ['doesNotBeginWith', 'x', 'no debe comenzar con «x»'],
      ['endsWith', 'x', 'debe terminar en «x»'],
      ['doesNotEndWith', 'x', 'no debe terminar en «x»'],
      ['in', ['a', 'b'], 'debe ser uno de: «a», «b»'],
      ['notIn', ['a', 'b'], 'no debe ser ninguno de: «a», «b»'],
      ['between', [1, 5], 'debe estar entre «1» y «5»'],
      ['notBetween', [1, 5], 'no debe estar entre «1» y «5»'],
    ])('%s', (operator, expected, requirement) => {
      expect(
        messageFor({ field: 'cases.motivo_baja', operator, expected })
      ).toBe(
        `No se puede cambiar el estado: el campo «Motivo baja» ${requirement}.`
      );
    });

    it.each([
      ['null', 'no debe tener valor'],
      ['notNull', 'debe tener un valor'],
      ['isEmpty', 'debe estar vacío'],
      ['isNotEmpty', 'no debe estar vacío'],
    ])('%s needs no value', (operator, requirement) => {
      expect(messageFor({ field: 'cases.motivo_baja', operator })).toBe(
        `No se puede cambiar el estado: el campo «Motivo baja» ${requirement}.`
      );
    });

    it('does not invent a requirement for an operator it does not know', () => {
      expect(
        messageFor({
          field: 'cases.motivo_baja',
          operator: 'regex',
          expected: 'x',
        })
      ).toBe(
        'No se puede cambiar el estado: el campo «Motivo baja» no cumple la condición configurada.'
      );
    });
  });

  describe('combinators', () => {
    it('joins every failed AND condition', () => {
      expect(
        transitionConditionsErrorMessage(
          blocker([
            {
              field: 'cases.responsable_id',
              operator: '=',
              expected: CAMILO,
              expected_label: 'Camilo Londoño',
              actual: PEDRO,
              actual_label: 'Pedro Pérez',
            },
            { field: 'cases.motivo_baja', operator: 'isNotEmpty' },
            { field: 'clients.documento', operator: '=', redacted: true },
          ])
        )
      ).toBe(
        'No se puede cambiar el estado: el responsable debe ser «Camilo Londoño» (actualmente es «Pedro Pérez»), ' +
          'el campo «Motivo baja» no debe estar vacío y ' +
          'el campo «Documento» del cliente no cumple la condición configurada.'
      );
    });

    it('says at least one condition must pass when the combinator is or', () => {
      expect(
        transitionConditionsErrorMessage(
          blocker(
            [
              { field: 'cases.motivo_baja', operator: '=', expected: 'A' },
              {
                field: 'cases.grupo_id',
                operator: '=',
                expected: 'g1',
                expected_label: 'Soporte',
              },
            ],
            'or'
          )
        )
      ).toBe(
        'No se puede cambiar el estado: se requiere al menos una de estas condiciones: ' +
          'el campo «Motivo baja» debe ser «A»; el grupo debe ser «Soporte».'
      );
    });
  });

  describe('fallbacks', () => {
    it('uses the generic Spanish text when the code matches but there is no diagnose', () => {
      expect(
        transitionConditionsErrorMessage({
          code: CASE_TRANSITION_CONDITIONS_NOT_MET,
          message: 'The request could not be processed.',
        })
      ).toBe(GENERIC);
    });

    it('still recognizes the legacy English message when the code is missing', () => {
      expect(
        transitionConditionsErrorMessage({
          message: 'The conditions configured for this transition are not met',
        })
      ).toBe(GENERIC);
    });

    it('keeps working when the field label resolver throws', () => {
      expect(
        messageFor(
          { field: 'cases.motivo_baja', operator: 'isNotEmpty' },
          {
            fieldLabel: () => {
              throw new Error('store unavailable');
            },
          }
        )
      ).toBe(
        'No se puede cambiar el estado: el campo «Motivo baja» no debe estar vacío.'
      );
    });

    it('returns undefined when the error is not a transition-conditions blocker', () => {
      expect(
        transitionConditionsErrorMessage({
          code: '0x030058',
          message:
            'The target classification is not available for the case group.',
        })
      ).toBeUndefined();
    });

    it('returns undefined without a blocker', () => {
      expect(transitionConditionsErrorMessage(null)).toBeUndefined();
    });
  });
});

describe('transitionConditionsErrorFromHttp', () => {
  it('reads the code and the diagnose from the sanitized 400 body', () => {
    const error = {
      response: {
        data: {
          errors: [
            {
              code: CASE_TRANSITION_CONDITIONS_NOT_MET,
              message: 'The request could not be processed.',
            },
          ],
          data: {
            conditions: {
              combinator: 'and',
              failed: [
                {
                  field: 'cases.responsable_id',
                  operator: '=',
                  expected: CAMILO,
                  expected_label: 'Camilo Londoño',
                  actual: PEDRO,
                  actual_label: 'Pedro Pérez',
                },
              ],
            },
          },
        },
      },
    };

    expect(transitionConditionsErrorFromHttp(error)).toBe(
      'No se puede cambiar el estado: el responsable debe ser «Camilo Londoño» (actualmente es «Pedro Pérez»).'
    );
  });

  it('passes the field label resolver through', () => {
    const error = {
      response: {
        data: {
          errors: [{ code: CASE_TRANSITION_CONDITIONS_NOT_MET }],
          data: {
            conditions: {
              combinator: 'and',
              failed: [
                { field: 'aux_cases.monto', operator: '=', redacted: true },
              ],
            },
          },
        },
      },
    };

    expect(
      transitionConditionsErrorFromHttp(error, {
        fieldLabel: () => 'el campo «Monto reclamado»',
      })
    ).toBe(
      'No se puede cambiar el estado: el campo «Monto reclamado» no cumple la condición configurada.'
    );
  });
});
