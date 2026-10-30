export async function up(knex) {
    const rows = await knex('global_configurations')
        .whereRaw("settings->'layouts'->'application'->'admin'->'cases'->>'enable_custom_view' = 'true'")
        .whereRaw(
            "(settings->'layouts'->'application'->'admin'->'cases'->>'custom_view_name' IS NULL " +
                "OR settings->'layouts'->'application'->'admin'->'cases'->>'custom_view_name' = '')"
        );

    for (const row of rows) {
        const settings =
            typeof row.settings === 'string' ? JSON.parse(row.settings) : JSON.parse(JSON.stringify(row.settings));
        if (!settings.layouts) settings.layouts = {};
        if (!settings.layouts.application) settings.layouts.application = {};
        if (!settings.layouts.application.admin) settings.layouts.application.admin = {};
        if (!settings.layouts.application.admin.cases) settings.layouts.application.admin.cases = {};
        settings.layouts.application.admin.cases.custom_view_name = 'view_case_details';
        await knex('global_configurations').where('id', row.id).update({ settings });
    }
}

export async function down(knex) {
    const rows = await knex('global_configurations').whereRaw(
        "settings->'layouts'->'application'->'admin'->'cases'->>'custom_view_name' = 'view_case_details'"
    );

    for (const row of rows) {
        const settings =
            typeof row.settings === 'string' ? JSON.parse(row.settings) : JSON.parse(JSON.stringify(row.settings));
        if (settings?.layouts?.application?.admin?.cases) {
            settings.layouts.application.admin.cases.custom_view_name = '';
        }
        await knex('global_configurations').where('id', row.id).update({ settings });
    }
}
