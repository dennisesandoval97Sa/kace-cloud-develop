import dotenv from 'dotenv';
import knex from 'knex';
import { testServerCredentials } from './adminConnection.js';

dotenv.config({ path: '../../.env' });

// Inventario de las bases que dejan las corridas de test: plantillas (`kace_tpl_`)
// y bases por archivo (`kace_t_`), con su tamano y su ultimo uso aparente. Solo
// lista; borrar es una decision aparte.
const admin = knex({ client: 'pg', connection: { ...testServerCredentials(), database: 'postgres' } });

const { rows } = await admin.raw(`
    select datname,
           pg_size_pretty(pg_database_size(datname)) as tamano,
           pg_database_size(datname) as bytes,
           (select count(*) from pg_stat_activity a where a.datname = d.datname) as conexiones
    from pg_database d
    where starts_with(datname, 'kace_tpl_') or starts_with(datname, 'kace_t_')
    order by bytes desc
`);

const plantillas = rows.filter((r) => r.datname.startsWith('kace_tpl_'));
const porArchivo = rows.filter((r) => !r.datname.startsWith('kace_tpl_'));
const total = rows.reduce((acc, r) => acc + Number(r.bytes), 0);

for (const row of plantillas) {
    process.stdout.write(`PLANTILLA  ${row.datname}  ${row.tamano}  conexiones=${row.conexiones}\n`);
}
for (const row of porArchivo) {
    process.stdout.write(`POR-ARCHIVO ${row.datname}  ${row.tamano}  conexiones=${row.conexiones}\n`);
}
process.stdout.write(
    `\nplantillas: ${plantillas.length}   bases por archivo: ${porArchivo.length}   total: ${Math.round(total / 1024 / 1024)} MB\n`
);

await admin.destroy();
