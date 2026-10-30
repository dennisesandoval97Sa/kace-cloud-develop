export class CustomListResponse {
  /** @type {CustomList} */
  #customList;

  /**
   * @param {CustomList} customList - Agregado raíz ya cargado.
   */
  constructor(customList) {
    this.#customList = customList;
  }

  /**
   * Devuelve el JSON de respuesta para una Custom List.
   * Estructura similar a LiteralResponse: { data: { ... } }
   */
  toJson() {
    const a = this.#customList;
    if (!a) return { data: {} };

    return {
      data: {
        id: a.id?.value,
        name: a.name?.value,
        is_active: a.is_active?.value,
        aux_entity: a.aux_entity?.value,

        aux_items: (a.aux_items ?? []).map(it => ({
          literal: it.literal?.value ?? it.literal,
          order: it.order,
        })),

        groups: (a.groups ?? []).map(g => g?.value ?? g),

        created_at: a.created_at?.value ?? null,
        updated_at: a.updated_at?.value ?? null,
        created_by: a.created_by?.value ?? null,
        updated_by: a.updated_by?.value ?? null,
        deleted_at: a.deleted_at?.value ?? null,
        deleted_by: a.deleted_by?.value ?? null,
      },
    };
  }
}
