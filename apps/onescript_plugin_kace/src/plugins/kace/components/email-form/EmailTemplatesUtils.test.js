import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildFrontendTemplateContext,
  replaceTemplateVariables,
  resolveTemplate,
} from './EmailTemplatesUtils.js';

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    get: vi.fn(),
  },
}));

import { storeService } from '#plugins/kace/services/storeService.js';

describe('EmailTemplatesUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildFrontendTemplateContext', () => {
    it('should return empty context when store is empty', () => {
      storeService.get.mockReturnValue(null);
      const context = buildFrontendTemplateContext();

      expect(context).toEqual({
        cases: {},
        clients: {},
        usuarios: {},
        clasificaciones: {},
        aux_cases: {},
        aux_clients: {},
        estados: {},
        estados_actual: {},
        estados_siguiente: {},
        caso: {},
        cliente: {},
        responsable: {},
        clasificacion: {},
        aux_casos: {},
        aux_clientes: {},
      });
    });

    it('should build context from case data', () => {
      const mockCaseData = {
        id: 'case-1',
        nombre: 'Test Case',
        cliente: {
          id: 'client-1',
          email: 'client@example.com',
        },
        responsable: {
          id: 'user-1',
          nombre: 'John Doe',
        },
        clasificacion: {
          nivel: 'alta',
        },
      };

      storeService.get.mockReturnValue({
        case_data: mockCaseData,
      });

      const context = buildFrontendTemplateContext();

      expect(context.cases).toEqual(mockCaseData);
      expect(context.caso).toEqual(mockCaseData);
      expect(context.clients).toEqual(mockCaseData.cliente);
      expect(context.cliente).toEqual(mockCaseData.cliente);
      expect(context.usuarios).toEqual(mockCaseData.responsable);
      expect(context.responsable).toEqual(mockCaseData.responsable);
      expect(context.clasificaciones).toEqual(mockCaseData.clasificacion);
    });

    it('should flatten aux_cases data', () => {
      const mockCaseData = {
        aux_case: {
          data: {
            pruebaDM: {
              email: 'test@example.com',
              ciudad: 'Madrid',
            },
            otros: {
              campo: 'valor',
            },
          },
        },
      };

      storeService.get.mockReturnValue({
        case_data: mockCaseData,
      });

      const context = buildFrontendTemplateContext();

      expect(context.aux_cases).toHaveProperty('pruebaDM');
      expect(context.aux_cases.email).toBe('test@example.com');
      expect(context.aux_cases.ciudad).toBe('Madrid');
      expect(context.aux_cases.campo).toBe('valor');
    });

    it('exposes estados, estados_actual, estados_siguiente from caseData', () => {
      storeService.get.mockReturnValue({
        case_data: {
          estado_actual: { nombre: 'En revisión' },
          estado_siguiente: { nombre: 'Resuelto' },
        },
      });

      const context = buildFrontendTemplateContext();

      expect(context.estados_actual).toEqual({ nombre: 'En revisión' });
      expect(context.estados_siguiente).toEqual({ nombre: 'Resuelto' });
      expect(context.estados).toEqual({ nombre: 'Resuelto' });
    });

    it('returns empty objects when estado_actual and estado_siguiente are absent', () => {
      storeService.get.mockReturnValue({
        case_data: {},
      });

      const context = buildFrontendTemplateContext();

      expect(context.estados_actual).toEqual({});
      expect(context.estados_siguiente).toEqual({});
      expect(context.estados).toEqual({});
      expect(replaceTemplateVariables('Hi {{estados.nombre}}', context)).toBe(
        'Hi '
      );
    });
  });

  describe('replaceTemplateVariables', () => {
    beforeEach(() => {
      storeService.get.mockReturnValue({
        case_data: {
          id: 'case-1',
          nombre: 'Test Case',
          cliente: {
            nombre: 'John Smith',
            email: 'john@example.com',
          },
          responsable: {
            nombre: 'Jane Doe',
          },
        },
      });
    });

    it('should replace simple variables', () => {
      const template = 'Estimado {{cliente.nombre}}';
      const result = replaceTemplateVariables(template);
      expect(result).toBe('Estimado John Smith');
    });

    it('should replace multiple variables', () => {
      const template = 'De: {{responsable.nombre}}, Para: {{cliente.email}}';
      const result = replaceTemplateVariables(template);
      expect(result).toBe('De: Jane Doe, Para: john@example.com');
    });

    it('should handle nested variables', () => {
      const template = 'Caso {{cases.id}} para {{cliente.nombre}}';
      const result = replaceTemplateVariables(template);
      expect(result).toBe('Caso case-1 para John Smith');
    });

    it('returns "" for unresolvable variables', () => {
      const template =
        'Cliente: {{cliente.telefono}}, Email: {{invalid.field}}';
      const result = replaceTemplateVariables(template);
      expect(result).toBe('Cliente: , Email: ');
    });

    it('returns "" for an unresolved body/subject placeholder (was {{key}})', () => {
      const template = {
        asunto: 'Update for {{cliente.missing}}',
        cuerpo: '<p>Hello {{unknown.field}}, your case is {{cases.id}}.</p>',
      };

      const resolved = resolveTemplate(template);

      expect(resolved.asunto).toBe('Update for ');
      expect(resolved.cuerpo).toBe('<p>Hello , your case is case-1.</p>');
    });

    it('should handle empty string', () => {
      const result = replaceTemplateVariables('');
      expect(result).toBe('');
    });

    it('should handle null', () => {
      const result = replaceTemplateVariables(null);
      expect(result).toBe(null);
    });

    it('should use provided context if given', () => {
      const customContext = {
        user: { name: 'Custom User' },
      };
      const template = 'User: {{user.name}}';
      const result = replaceTemplateVariables(template, customContext);
      expect(result).toBe('User: Custom User');
    });

    it('should ignore object values', () => {
      const template = 'Data: {{cliente}}';
      const result = replaceTemplateVariables(template);
      expect(result).toBe('Data: {{cliente}}');
    });

    it('should handle whitespace in variables', () => {
      const template = 'Name: {{ cliente.nombre }}';
      const result = replaceTemplateVariables(template);
      expect(result).toBe('Name: John Smith');
    });
  });

  describe('resolveTemplate', () => {
    beforeEach(() => {
      storeService.get.mockReturnValue({
        case_data: {
          id: 'case-1',
          cliente: {
            nombre: 'John Smith',
            email: 'john@example.com',
          },
          responsable: {
            nombre: 'Jane Doe',
          },
        },
      });
    });

    it('should resolve all template fields', () => {
      const template = {
        destinatario: '{{cliente.email}}',
        copia: 'cc@example.com',
        copia_oculta: 'bcc@example.com',
        asunto: 'Hello {{cliente.nombre}}',
        cuerpo: 'Body text',
      };

      const resolved = resolveTemplate(template);

      expect(resolved.destinatario).toBe('john@example.com');
      expect(resolved.copia).toBe('cc@example.com');
      expect(resolved.copia_oculta).toBe('bcc@example.com');
      expect(resolved.asunto).toBe('Hello John Smith');
      expect(resolved.cuerpo).toBe('Body text');
    });

    it('should handle missing fields with defaults', () => {
      const template = {
        asunto: 'Test',
      };

      const resolved = resolveTemplate(template);

      expect(resolved.destinatario).toBe('');
      expect(resolved.copia).toBe('');
      expect(resolved.copia_oculta).toBe('');
      expect(resolved.asunto).toBe('Test');
      expect(resolved.cuerpo).toBe('');
    });

    it('returns "" for unresolvable variables', () => {
      const template = {
        asunto: 'Case {{cases.id}} for {{cliente.unknown}}',
        cuerpo: '<p>Unknown field: {{invalid}}</p>',
      };

      const resolved = resolveTemplate(template);

      expect(resolved.asunto).toBe('Case case-1 for ');
      expect(resolved.cuerpo).toBe('<p>Unknown field: </p>');
    });

    it('preserves the {{key}} literal in email recipient fields when the placeholder cannot be resolved', () => {
      // Mirrors the backend behavior: forEmail=true leaves the literal
      // placeholder so the form-level validator / SendEmail.renderEmailsOrFail
      // can detect the gap and surface the error.
      const template = {
        destinatario: '{{responsable.email}}',
        copia: '{{aux_cases.correo}}',
        copia_oculta: '{{clients.unknown}}',
        asunto: 'Case {{cases.id}}',
        cuerpo: 'Body {{caso.campo_inexistente}}',
      };

      const resolved = resolveTemplate(template);

      expect(resolved.destinatario).toBe('{{responsable.email}}');
      expect(resolved.copia).toBe('{{aux_cases.correo}}');
      expect(resolved.copia_oculta).toBe('{{clients.unknown}}');
      expect(resolved.asunto).toBe('Case case-1');
      expect(resolved.cuerpo).toBe('Body ');
    });

    it('should handle null template object', () => {
      const template = null;
      const resolved = resolveTemplate(template);

      expect(resolved).toBeDefined();
      expect(resolved.destinatario).toBe('');
    });
  });
});
