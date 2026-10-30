import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeValues = {};

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    get: (path) => storeValues[path],
    set: (path, value) => {
      storeValues[path] = value;
    },
  },
}));

const { ClassificationsService } = await import('./classificationsService.js');

/** Filtro de `POST /classifications/search`, indexado por `field`. */
function filterByField(post) {
  const [, body] = post.mock.calls[0];
  return Object.fromEntries(body.filter.map((f) => [f.field, f]));
}

function buildService() {
  const api = {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({
      status: 200,
      data: { data: { items: [] } },
    }),
  };
  const service = new ClassificationsService({
    apiService: api,
    store: {},
    userService: {
      get: vi
        .fn()
        .mockResolvedValue({ user: { grupo_activo: 'grupo-activo' } }),
    },
    emitEvent: vi.fn(),
  });
  return { service, api };
}

describe('ClassificationsService.fetchGroupClassification', () => {
  beforeEach(() => {
    for (const key of Object.keys(storeValues)) delete storeValues[key];
  });

  it('por defecto filtra por el grupo activo y exige can_start_sub_cases_flow', async () => {
    const { service, api } = buildService();

    await service.fetchGroupClassification();

    const filter = filterByField(api.post);
    expect(filter['classification_group_relationships.group_id'].value).toBe(
      'grupo-activo'
    );
    expect(filter['clasificaciones.can_start_sub_cases_flow']).toEqual({
      field: 'clasificaciones.can_start_sub_cases_flow',
      operator: 'eq',
      value: 'true',
      type: 'AND',
    });
    expect(filter['clasificaciones.is_active'].value).toBe(1);
    expect(filter['clasificaciones.deleted_by'].operator).toBe('null');
  });

  it('groupId sustituye el grupo activo sin tocar el resto del filtro', async () => {
    const { service, api } = buildService();

    await service.fetchGroupClassification({ groupId: 'grupo-del-caso' });

    const filter = filterByField(api.post);
    expect(filter['classification_group_relationships.group_id'].value).toBe(
      'grupo-del-caso'
    );
    expect(filter['clasificaciones.can_start_sub_cases_flow']).toBeDefined();
  });

  it('el catálogo de reclasificación solo ofrece clasificaciones principales', async () => {
    const { service, api } = buildService();

    await service.fetchGroupClassification({
      fullCatalog: true,
      groupId: 'grupo-del-caso',
    });

    const filter = filterByField(api.post);
    expect(filter['clasificaciones.can_start_sub_cases_flow'].value).toBe(
      'true'
    );
  });

  it('en un subcaso ofrece las subclasificaciones del padre, también con fullCatalog', async () => {
    const { service, api } = buildService();
    storeValues['cases.parent_id'] = 'caso-padre';
    const subclasificaciones = [
      { id: 'sub-1', can_start_sub_cases_flow: false },
    ];
    api.get.mockImplementation(async (url) =>
      url === '/cases/caso-padre'
        ? { status: 200, data: { data: { clasificacion_id: 'clas-padre' } } }
        : { status: 200, data: { data: { relations: subclasificaciones } } }
    );

    const result = await service.fetchGroupClassification({
      fullCatalog: true,
    });

    expect(api.get).toHaveBeenCalledWith('/classifications/clas-padre', {});
    expect(api.post).not.toHaveBeenCalled();
    expect(result).toEqual(subclasificaciones);
  });

  it('fullCatalog ignora la clasificación embebida del caso en edición', async () => {
    const { service, api } = buildService();
    storeValues['cases.case_id'] = 'caso-1';
    storeValues['cases.case_data'] = {
      clasificacion_id: 'clas-1',
      clasificacion: { id: 'clas-1', nombre: 'Actual' },
    };

    const embedded = await service.fetchGroupClassification();
    expect(embedded).toEqual([{ id: 'clas-1', nombre: 'Actual' }]);
    expect(api.post).not.toHaveBeenCalled();

    await service.fetchGroupClassification({ fullCatalog: true });
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
