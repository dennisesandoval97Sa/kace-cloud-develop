import { describe, it, expect } from 'vitest';
import {
  getJoiMessages,
  getFormioMessages,
  getAlertPrefix,
  getDefaultFieldLabel,
  getInvalidFallback,
  localizePatternName,
} from './esValidationMessages.js';

describe('esValidationMessages', () => {
  describe('getJoiMessages', () => {
    it('includes {{#label}} so Joi renders the field name in every message', () => {
      const messages = getJoiMessages();
      for (const [key, template] of Object.entries(messages)) {
        expect(
          template,
          `joiMessages.${key} should start with {{#label}}`
        ).toMatch(/^\{\{#label\}\}/);
      }
    });

    it('preserves the {#limit} and {#multiple} placeholders that Joi substitutes', () => {
      const messages = getJoiMessages();
      expect(messages['string.min']).toBe(
        '{{#label}} debe tener al menos {#limit} caracteres'
      );
      expect(messages['string.max']).toBe(
        '{{#label}} debe tener como máximo {#limit} caracteres'
      );
      expect(messages['number.min']).toBe(
        '{{#label}} debe ser mayor o igual a {#limit}'
      );
      expect(messages['number.multiple']).toBe(
        '{{#label}} debe ser múltiplo de {#multiple}'
      );
      expect(messages['number.precision']).toBe(
        '{{#label}} debe tener como máximo {#limit} decimales'
      );
    });

    it('covers the ISO 8601 pattern names used by DateSchemaBuilder', () => {
      const messages = getJoiMessages();
      expect(messages['string.pattern.ISO 8601 with timezone']).toBe(
        '{{#label}} debe ser una fecha ISO 8601 con zona horaria'
      );
      expect(messages['string.pattern.ISO 8601 without timezone']).toBe(
        '{{#label}} debe ser una fecha ISO 8601 sin zona horaria'
      );
    });
  });

  describe('getFormioMessages', () => {
    it('returns the formioMessages map with the expected Spanish templates', () => {
      const messages = getFormioMessages();
      expect(messages.error).toBe(
        'Por favor corrige los siguientes errores antes de enviar.'
      );
      expect(messages.submitError).toBe(
        'Por favor revisa el formulario y corrige todos los errores antes de enviar.'
      );
      expect(messages.required).toBe('{{field}} es obligatorio');
      expect(messages.pattern).toBe(
        '{{field}} no coincide con el patrón {{pattern}}'
      );
      expect(messages.invalid_email).toBe(
        '{{field}} debe ser un correo electrónico válido.'
      );
      expect(messages.submit).toBe('Enviar formulario');
    });
  });

  describe('getAlertPrefix', () => {
    it('returns the Spanish alert prefix', () => {
      expect(getAlertPrefix()).toBe('Error de validación');
    });
  });

  describe('getDefaultFieldLabel', () => {
    it('returns the Spanish fallback for fields without a label', () => {
      expect(getDefaultFieldLabel()).toBe('Este campo');
    });
  });

  describe('getInvalidFallback', () => {
    it('returns the Spanish fallback for degraded error messages', () => {
      expect(getInvalidFallback()).toBe('Este campo no es válido.');
    });
  });

  describe('localizePatternName', () => {
    it('translates the hardcoded DateSchemaBuilder pattern names embedded via {#name}', () => {
      expect(
        localizePatternName(
          '"Fecha" no coincide con el patrón ISO 8601 with timezone'
        )
      ).toBe('"Fecha" no coincide con el patrón ISO 8601 con zona horaria');
      expect(
        localizePatternName(
          '"Fecha" no coincide con el patrón ISO 8601 without timezone'
        )
      ).toBe('"Fecha" no coincide con el patrón ISO 8601 sin zona horaria');
    });

    it('leaves unrelated messages untouched', () => {
      const message = '"Cuenta 1" debe ser una cadena de texto';
      expect(localizePatternName(message)).toBe(message);
    });

    it('is a no-op for non-string input', () => {
      expect(localizePatternName(undefined)).toBeUndefined();
      expect(localizePatternName(null)).toBeNull();
    });
  });

  describe('memoization', () => {
    it('returns the same frozen reference on repeated calls (no per-keystroke allocation)', () => {
      const a = getJoiMessages();
      const b = getJoiMessages();
      expect(a).toBe(b);
      expect(Object.isFrozen(a)).toBe(true);

      const c = getFormioMessages();
      const d = getFormioMessages();
      expect(c).toBe(d);
      expect(Object.isFrozen(c)).toBe(true);
    });
  });
});
