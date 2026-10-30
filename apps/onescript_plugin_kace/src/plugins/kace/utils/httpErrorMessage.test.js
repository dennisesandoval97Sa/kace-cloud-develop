import { describe, expect, it } from 'vitest';
import {
  BAD_REQUEST_ERROR,
  CASE_AUXILIARY_DATA_INVALID,
  CASE_RECLASSIFY_REASON_REQUIRED,
  VALIDATION_ERROR,
} from '@kace/error-codes';
import { httpErrorMessage } from './httpErrorMessage.js';

const rejected = (body) => ({ response: { data: body } });

describe('httpErrorMessage', () => {
  it('translates the masked generic 400 instead of showing "Bad request"', () => {
    expect(
      httpErrorMessage(
        rejected({
          message: 'Bad request',
          data: { code: BAD_REQUEST_ERROR },
          errors: [{ code: BAD_REQUEST_ERROR, message: 'Bad request' }],
        })
      )
    ).toBe('No se pudo procesar la solicitud.');
  });

  it('translates the masked validation message', () => {
    expect(
      httpErrorMessage(
        rejected({
          errors: [
            {
              code: VALIDATION_ERROR,
              message: 'The request could not be processed.',
            },
          ],
        })
      )
    ).toBe('Revisa la información e inténtalo de nuevo.');
  });

  it('translates a reclassification blocker by its public code', () => {
    expect(
      httpErrorMessage(
        rejected({
          errors: [
            {
              code: CASE_RECLASSIFY_REASON_REQUIRED,
              message: 'The request could not be processed.',
            },
          ],
        })
      )
    ).toBe(
      'Debe indicar el motivo de la reclasificación (mínimo 3 caracteres).'
    );
  });

  it('keeps a detailed backend message it cannot translate', () => {
    expect(
      httpErrorMessage(
        rejected({
          errors: [{ code: VALIDATION_ERROR, message: 'Invalid id' }],
        })
      )
    ).toBe('Invalid id');
  });

  it('uses a string item of the errors array as the message', () => {
    expect(
      httpErrorMessage(
        rejected({
          errors: ['An unexpected error occurred. Please contact support.'],
        })
      )
    ).toBe('Ocurrió un error inesperado.');
  });

  it('uses a string errors body as the message', () => {
    expect(httpErrorMessage(rejected({ errors: 'Forbidden' }))).toBe(
      'No tienes permiso para realizar esta acción.'
    );
  });

  it('falls back to the body message and then to the error message', () => {
    expect(httpErrorMessage(rejected({ message: 'Not found' }))).toBe(
      'No se encontró el recurso solicitado.'
    );
    expect(httpErrorMessage(new Error('Network Error'))).toBe('Network Error');
  });

  it('names each rejected auxiliary field with its reason', () => {
    const labels = {
      'aux_cases.vehiculo.placa': 'el campo «Placa»',
      'aux_cases.vehiculo.cita': 'el campo «Fecha de cita»',
    };
    expect(
      httpErrorMessage(
        rejected({
          data: {
            code: CASE_AUXILIARY_DATA_INVALID,
            fields: [
              { field: 'aux_cases.vehiculo.placa', reason: 'duplicate' },
              { field: 'aux_cases.vehiculo.cita', reason: 'past_date' },
              { field: 'aux_cases.vehiculo.modelo', reason: 'required' },
              { field: 'aux_cases.vehiculo.kilometraje', reason: 'invalid' },
            ],
          },
          errors: [
            {
              code: CASE_AUXILIARY_DATA_INVALID,
              message: 'The request could not be processed.',
            },
          ],
        }),
        { fieldLabel: (field) => labels[field] }
      )
    ).toBe(
      'Revisa el formulario: el campo «Placa» ya está registrado en otro caso; ' +
        'el campo «Fecha de cita» no puede tener una fecha anterior a la actual; ' +
        'el campo «Modelo» es obligatorio; ' +
        'el campo «Kilometraje» no tiene un valor válido.'
    );
  });

  it('asks to review the form when the rejected fields are unknown', () => {
    expect(
      httpErrorMessage(
        rejected({
          data: { code: CASE_AUXILIARY_DATA_INVALID },
          errors: [
            {
              code: CASE_AUXILIARY_DATA_INVALID,
              message: 'The request could not be processed.',
            },
          ],
        })
      )
    ).toBe('Revisa los campos del formulario: hay valores que no son válidos.');
  });

  it('names a failed transition condition', () => {
    expect(
      httpErrorMessage(
        rejected({
          data: {
            code: '0x030004',
            conditions: {
              combinator: 'and',
              failed: [
                {
                  field: 'cases.motivo_baja',
                  operator: '=',
                  expected: 'A',
                  actual: 'B',
                },
              ],
            },
          },
          errors: [
            {
              code: '0x030004',
              message: 'The request could not be processed.',
            },
          ],
        })
      )
    ).toMatch(/^No se puede cambiar el estado/);
  });
});
