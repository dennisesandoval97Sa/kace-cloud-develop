export class BoardResponse {
    #board;

    /**
     * @param {Board} board
     */
    constructor(board) {
        this.#board = board;
    }

    /**
     * Convierte el objeto Board a una representación JSON plana.
     * @returns {Object}
     */
    toJson() {
        if (!this.#board) return {};
        const criteria = this.#board.criteria.value.items.map((item) => {
            if (item.field.includes('aux_') && item.field.includes('data')) {
                const obj = JSON.parse(item.value);
                let current = obj;
                while (typeof current === 'object' && current !== null) {
                    const keys = Object.keys(current);
                    if (keys.length !== 1) break;
                    current = current[keys[0]];
                }
                item.value = current;
            }
            return item;
        });
        return {
            data: {
                id: this.#board.id.value,
                name: this.#board.name.value,
                description: this.#board.description.value,
                primary_entity: this.#board.primary_entity.value,
                criteria: { items: criteria },
                page_size: this.#board.page_size.value,
                display_order: this.#board.display_order.value,
                is_active: this.#board.is_active.value,
                icon_class: this.#board.icon_class.value,
                onescript_form_id: this.#board.onescript_form_id.value,
                filter_onescript_id: this.#board.filter_onescript_id.value,
                relations: this.#board.relations.value,
                columns: this.#board.columns.value,
                havings: this.#board.havings.value,
                access_groups: this.#board.access_groups.value,
                access_users: this.#board.access_users.value,
                // Solo los expone el listado (BoardSearcher los resuelve); se omiten en
                // /boards/{id} y /boards/available para no cambiar esas respuestas.
                ...(this.#board.access_users_data && { access_users_data: this.#board.access_users_data }),
                ...(this.#board.access_groups_data && { access_groups_data: this.#board.access_groups_data }),
                options: this.#board.options.value,
                orders: this.#board.orders.value,
                quick_ans_filter: this.#board.quick_ans_filter.value,
                can_view_record: this.#board.can_view_record.value,
                can_create_record: this.#board.can_create_record.value,
                can_edit_record: this.#board.can_edit_record.value,
                can_admin_bulk_actions: this.#board.can_admin_bulk_actions.value,
                can_agent_bulk_actions: this.#board.can_agent_bulk_actions.value,
                can_admin_delete_record: this.#board.can_admin_delete_record.value,
                can_agent_delete_record: this.#board.can_agent_delete_record.value,
                created_by: this.#board.created_by.value,
                created_at: this.#board.created_at.value,
                updated_at: this.#board.updated_at.value,
                updated_by: this.#board.updated_by.value,
                deleted_at: this.#board.deleted_at.value,
                deleted_by: this.#board.deleted_by.value,
            },
        };
    }
}
