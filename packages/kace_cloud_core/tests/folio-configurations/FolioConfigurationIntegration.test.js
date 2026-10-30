import { v4 as uuidv4 } from 'uuid';

import { knexConfig } from '../knexfile.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { FolioConfigurationMother } from './domain/FolioConfigurationMother.js';
import { KnexFolioConfigurationRepository } from '../../src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '../../src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { FolioConfigurationCreator } from '../../src/folio-configurations/application/create/FolioConfigurationCreator.js';
import { FolioConfigurationUpdater } from '../../src/folio-configurations/application/update/FolioConfigurationUpdater.js';
import { FolioConfigurationDeleter } from '../../src/folio-configurations/application/delete/FolioConfigurationDeleter.js';
import { FolioConfigurationFinder } from '../../src/folio-configurations/application/find/FolioConfigurationFinder.js';
import { FolioConfigurationSearcher } from '../../src/folio-configurations/application/search/FolioConfigurationSearcher.js';
import { FolioConfigurationClassificationsFinder } from '../../src/folio-configurations/application/classifications/FolioConfigurationClassificationsFinder.js';
import { CaseFolioResolver } from '../../src/cases/application/folio/CaseFolioResolver.js';
import { Case } from '../../src/cases/domain/Case.js';
import CasesMother from '../cases/domain/CasesMother.js';

describe('FolioConfiguration Integration', () => {
    const repository = new KnexFolioConfigurationRepository(knexConfig);
    const sequenceRepository = new KnexFolioSequenceRepository(knexConfig);

    async function insertClassification(overrides = {}) {
        const id = uuidv4();
        await knexConfig('clasificaciones').insert({
            id,
            nivel1: 'Soporte',
            is_active: true,
            created_at: new Date().toISOString(),
            ...overrides,
        });
        return id;
    }

    describe('CRUD', () => {
        it('persiste y recupera la lista de segmentos', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);

            const found = await new FolioConfigurationFinder(repository).execute(dto.id);

            expect(found.segments.value).toEqual(dto.segments);
            expect(found.start_value).toBe(50);
            expect(found.reset_policy).toBe('never');
        });

        it('rechaza una configuración sin consecutivo', async () => {
            const dto = FolioConfigurationMother.dto({ segments: [{ type: 'literal', value: 'A' }] });

            await expect(new FolioConfigurationCreator(repository).execute(dto)).rejects.toThrow(ValidationFailError);
        });

        it('rechaza una configuración con dos consecutivos', async () => {
            const dto = FolioConfigurationMother.dto({
                segments: [
                    { type: 'sequence', length: 4 },
                    { type: 'sequence', length: 4 },
                ],
            });

            await expect(new FolioConfigurationCreator(repository).execute(dto)).rejects.toThrow(ValidationFailError);
        });

        it('rechaza un start_value que no cabe en el ancho del consecutivo', async () => {
            const dto = FolioConfigurationMother.dto({
                segments: [{ type: 'sequence', length: 2 }],
                start_value: 1000,
            });

            await expect(new FolioConfigurationCreator(repository).execute(dto)).rejects.toThrow(/no cabe/);
        });

        it('rechaza reset_policy "prefix" sin nada delante del consecutivo', async () => {
            const dto = FolioConfigurationMother.dto({
                segments: [{ type: 'sequence', length: 4 }],
                reset_policy: 'prefix',
            });

            await expect(new FolioConfigurationCreator(repository).execute(dto)).rejects.toThrow(/prefix/);
        });

        it('actualiza los segmentos', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);

            const segments = [
                { type: 'literal', value: 'X' },
                { type: 'sequence', length: 3 },
            ];
            await new FolioConfigurationUpdater(repository).execute(dto.id, { segments, updated_at: new Date() });

            const found = await new FolioConfigurationFinder(repository).execute(dto.id);
            expect(found.segments.value).toEqual(segments);
        });

        it('busca configuraciones', async () => {
            await new FolioConfigurationCreator(repository).execute(FolioConfigurationMother.dto());
            await new FolioConfigurationCreator(repository).execute(FolioConfigurationMother.dtoWithLiteral('7'));

            const result = await new FolioConfigurationSearcher(repository).execute({
                filter: [],
                relationship: [],
                limit: 10,
                offset: 0,
                order: null,
            });

            expect(result.toJson().data.items).toHaveLength(2);
        });
    });

    describe('borrado', () => {
        it('se niega a borrar una configuración con clasificaciones asociadas', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            await insertClassification({ folio_config_id: dto.id });

            await expect(
                new FolioConfigurationDeleter(repository).execute(dto.id, {
                    deleted_at: new Date(),
                    deleted_by: uuidv4(),
                })
            ).rejects.toThrow(CustomError);
        });

        it('borra una configuración sin asociaciones', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);

            await new FolioConfigurationDeleter(repository).execute(dto.id, {
                deleted_at: new Date(),
                deleted_by: uuidv4(),
            });

            await expect(new FolioConfigurationFinder(repository).execute(dto.id)).rejects.toThrow(CustomError);
        });
    });

    /*
     * La asociación se escribe desde el formulario de la clasificación (folio_config_id);
     * aquí sólo se lista, así que estos tests cubren la lectura.
     */
    describe('clasificaciones asociadas', () => {
        const finder = () => new FolioConfigurationClassificationsFinder(repository);

        it('lista las asociadas con la descripción compuesta por sus niveles', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            const id = await insertClassification({
                folio_config_id: dto.id,
                nivel1: 'Soporte',
                nivel2: 'Hardware',
                nivel4: 'Impresoras',
            });

            const result = await finder().execute(dto.id);

            // Une los niveles no vacíos, saltándose los huecos, igual que ClassificationResponse.
            expect(result).toEqual([{ id, description: 'Soporte -> Hardware -> Impresoras' }]);
        });

        it('no incluye clasificaciones de otra configuración ni borradas', async () => {
            const dto = FolioConfigurationMother.dto();
            const otra = FolioConfigurationMother.dtoWithLiteral('7');
            await new FolioConfigurationCreator(repository).execute(dto);
            await new FolioConfigurationCreator(repository).execute(otra);

            const propia = await insertClassification({ folio_config_id: dto.id });
            await insertClassification({ folio_config_id: otra.id });
            await insertClassification({ folio_config_id: dto.id, deleted_at: new Date().toISOString() });

            const result = await finder().execute(dto.id);

            expect(result.map((row) => row.id)).toEqual([propia]);
        });

        it('devuelve una lista vacía cuando no hay ninguna asociada', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);

            expect(await finder().execute(dto.id)).toEqual([]);
        });
    });

    describe('estructuras que se solapan entre configuraciones', () => {
        const resolver = () => new CaseFolioResolver(repository, sequenceRepository);
        const layout = (literal, length, override = {}) => ({
            ...FolioConfigurationMother.dto(),
            segments: [
                { type: 'literal', value: literal },
                { type: 'sequence', length, pad_char: '0' },
            ],
            start_value: 1,
            ...override,
        });

        async function issue(dto) {
            const classificationId = await insertClassification({ folio_config_id: dto.id });
            await resolver().execute({ classificationId, caseDto: {}, auxData: {} });
            return classificationId;
        }

        it('rechaza una estructura distinta que renderiza los mismos folios que otra activa', async () => {
            await new FolioConfigurationCreator(repository).execute(layout('RAD-', 4));

            await expect(new FolioConfigurationCreator(repository).execute(layout('RAD-0', 3))).rejects.toThrow(
                /los mismos folios/i
            );
        });

        it('rechaza la gemela de una configuración desactivada que ya emitió', async () => {
            const old = layout('PQR-', 4);
            await new FolioConfigurationCreator(repository).execute(old);
            await issue(old);
            await new FolioConfigurationUpdater(repository, sequenceRepository).execute(old.id, {
                status: StatusEnum.INACTIVE.value,
            });

            await expect(new FolioConfigurationCreator(repository).execute(layout('PQR-', 4))).rejects.toThrow(
                /ya emitió folios/i
            );
        });

        it('rechaza la gemela de una configuración borrada que ya emitió', async () => {
            const old = layout('PQR-', 4);
            await new FolioConfigurationCreator(repository).execute(old);
            const classificationId = await issue(old);
            await knexConfig('clasificaciones').where({ id: classificationId }).update({ folio_config_id: null });
            await new FolioConfigurationDeleter(repository).execute(old.id, {
                deleted_at: new Date(),
                deleted_by: uuidv4(),
            });

            await expect(new FolioConfigurationCreator(repository).execute(layout('PQR-', 4))).rejects.toThrow(
                /ya emitió folios/i
            );
        });

        it('acepta la gemela de una configuración desactivada que nunca emitió', async () => {
            const old = layout('PQR-', 4);
            await new FolioConfigurationCreator(repository).execute(old);
            await new FolioConfigurationUpdater(repository, sequenceRepository).execute(old.id, {
                status: StatusEnum.INACTIVE.value,
            });

            await expect(new FolioConfigurationCreator(repository).execute(layout('PQR-', 4))).resolves.toBeUndefined();
        });

        it('revisa los solapes cuando solo cambia overflow_policy', async () => {
            const narrow = layout('OVF-', 4);
            await new FolioConfigurationCreator(repository).execute(narrow);
            await new FolioConfigurationCreator(repository).execute(layout('OVF-', 5));

            // Con 'grow', OVF- + 4 dígitos llega a OVF-10000, que ya emite la de 5 dígitos.
            await expect(
                new FolioConfigurationUpdater(repository, sequenceRepository).execute(narrow.id, {
                    overflow_policy: 'grow',
                })
            ).rejects.toThrow(/los mismos folios/i);
        });

        it('recuerda el ancho con el que una configuración emitió antes de ensancharse', async () => {
            const old = layout('X-', 3);
            await new FolioConfigurationCreator(repository).execute(old);
            await issue(old);
            await new FolioConfigurationUpdater(repository, sequenceRepository).execute(old.id, {
                segments: layout('X-', 4).segments,
            });

            await expect(new FolioConfigurationCreator(repository).execute(layout('X-', 3))).rejects.toThrow(
                /ya emitió folios/i
            );
        });
    });

    describe('edición con contadores vivos', () => {
        const resolver = () => new CaseFolioResolver(repository, sequenceRepository);
        const auxData = FolioConfigurationMother.context().aux_cases;
        const updater = () => new FolioConfigurationUpdater(repository, sequenceRepository);

        async function configurationThatAlreadyIssued() {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });
            await resolver().execute({ classificationId, caseDto: {}, auxData });
            return dto;
        }

        it('rechaza cambiar el valor inicial cuando ya se emitieron folios', async () => {
            const dto = await configurationThatAlreadyIssued();

            await expect(updater().execute(dto.id, { start_value: 900 })).rejects.toThrow(
                /no se puede cambiar el valor inicial/i
            );
        });

        it('permite cambiar el valor inicial mientras no se haya emitido ninguno', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);

            await updater().execute(dto.id, { start_value: 900 });

            expect((await new FolioConfigurationFinder(repository).execute(dto.id)).start_value).toBe(900);
        });

        const withSequenceLength = (dto, length) =>
            dto.segments.map((segment) => (segment.type === 'sequence' ? { ...segment, length } : segment));

        async function counterAt(dto, value) {
            await sequenceRepository
                .connection(sequenceRepository.qualifiedName())
                .where({ config_id: dto.id, scope_key: '' })
                .update({ current_value: value });
        }

        it('deja pasar una ampliación del consecutivo', async () => {
            const base = FolioConfigurationMother.dto();
            const dto = { ...base, segments: withSequenceLength(base, 6) };
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });
            await resolver().execute({ classificationId, caseDto: {}, auxData });

            await updater().execute(dto.id, { segments: withSequenceLength(dto, 9) });

            const found = await new FolioConfigurationFinder(repository).execute(dto.id);
            expect(found.segments.value.find((segment) => segment.type === 'sequence').length).toBe(9);
        });

        /*
         * Tras emitir, la estructura es historia: el contador sigue desde donde va, así que
         * cualquier cambio que no sea ensanchar el consecutivo puede volver a renderizar
         * folios ya entregados.
         */
        it('rechaza estrechar el consecutivo aunque el siguiente número quepa', async () => {
            const dto = await configurationThatAlreadyIssued();
            await counterAt(dto, 999);

            await expect(updater().execute(dto.id, { segments: withSequenceLength(dto, 4) })).rejects.toThrow(
                /solo se permite ampliar el ancho del consecutivo/i
            );
        });

        it('rechaza A-1 + 3 dígitos → A- + 4 dígitos, que repetiría A-1001 en n = 1001', async () => {
            const dto = {
                ...FolioConfigurationMother.dto(),
                segments: [
                    { type: 'literal', value: 'A-1' },
                    { type: 'sequence', length: 3, pad_char: '0' },
                ],
                start_value: 1,
            };
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });
            await resolver().execute({ classificationId, caseDto: {}, auxData });

            await expect(
                updater().execute(dto.id, {
                    segments: [
                        { type: 'literal', value: 'A-' },
                        { type: 'sequence', length: 4, pad_char: '0' },
                    ],
                })
            ).rejects.toThrow(/cree una configuración nueva/i);
        });

        it('rechaza cambiar un segmento que no es el consecutivo', async () => {
            const dto = await configurationThatAlreadyIssued();
            const segments = dto.segments.map((segment) =>
                segment.type === 'literal' ? { ...segment, value: '6' } : segment
            );

            await expect(updater().execute(dto.id, { segments })).rejects.toThrow(/cree una configuración nueva/i);
        });

        it('acepta volver a guardar los mismos segmentos', async () => {
            const dto = await configurationThatAlreadyIssued();

            await expect(
                updater().execute(dto.id, { segments: dto.segments, nombre: `${dto.nombre} v2` })
            ).resolves.toBeUndefined();
        });

        it('rechaza cambiar el reinicio del contador cuando ya se emitieron folios', async () => {
            const dto = await configurationThatAlreadyIssued();

            // 'never' -> 'yearly' no toca el prefijo, así que el contador nuevo reemitiría
            // folios idénticos a los ya entregados y el índice único los rechazaría.
            await expect(updater().execute(dto.id, { reset_policy: 'yearly' })).rejects.toThrow(
                /no se puede cambiar el reinicio del contador/i
            );
        });

        it('permite cambiar el reinicio mientras no se haya emitido ninguno', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);

            await updater().execute(dto.id, { reset_policy: 'yearly' });

            expect((await new FolioConfigurationFinder(repository).execute(dto.id)).reset_policy).toBe('yearly');
        });
    });

    describe('CaseFolioResolver', () => {
        const resolver = () => new CaseFolioResolver(repository, sequenceRepository);
        const auxData = FolioConfigurationMother.context().aux_cases;

        it('genera el folio del enunciado y lo incrementa en el siguiente caso', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });

            const first = await resolver().execute({ classificationId, caseDto: {}, auxData });
            const second = await resolver().execute({ classificationId, caseDto: {}, auxData });

            expect(first).toMatch(/^5\d{2}1000000050$/);
            expect(second).toBe(first.replace(/50$/, '51'));
        });

        it('devuelve null cuando la clasificación no tiene configuración', async () => {
            const classificationId = await insertClassification();

            expect(await resolver().execute({ classificationId, caseDto: {}, auxData })).toBeNull();
        });

        it('devuelve null cuando la configuración está inactiva', async () => {
            const dto = FolioConfigurationMother.dto({ status: 2 });
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });

            expect(await resolver().execute({ classificationId, caseDto: {}, auxData })).toBeNull();
        });

        it('falla sin consumir consecutivo cuando falta el campo del auxiliar', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });

            await expect(resolver().execute({ classificationId, caseDto: {}, auxData: {} })).rejects.toThrow(
                /segmento 3 \(field\)/
            );

            // El contador no se ha tocado: el primer folio válido sigue siendo el 50.
            expect(await sequenceRepository.peek(dto.id, '')).toBeNull();
            const folio = await resolver().execute({ classificationId, caseDto: {}, auxData });
            expect(folio).toMatch(/000000050$/);
        });

        it('con reset_policy "prefix" mantiene contadores separados por prefijo', async () => {
            const dto = FolioConfigurationMother.dto({
                segments: [
                    { type: 'field', path: 'aux_cases.f.tipo' },
                    { type: 'sequence', length: 4 },
                ],
                reset_policy: 'prefix',
                start_value: 1,
            });
            await new FolioConfigurationCreator(repository).execute(dto);
            const classificationId = await insertClassification({ folio_config_id: dto.id });

            const a = await resolver().execute({ classificationId, caseDto: {}, auxData: { f: { tipo: 'A' } } });
            const b = await resolver().execute({ classificationId, caseDto: {}, auxData: { f: { tipo: 'B' } } });
            const a2 = await resolver().execute({ classificationId, caseDto: {}, auxData: { f: { tipo: 'A' } } });

            expect([a, b, a2]).toEqual(['A0001', 'B0001', 'A0002']);
        });

        it('la vista previa funciona sin contexto, marcando el campo que aún no existe', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            const configuration = await new FolioConfigurationFinder(repository).execute(dto.id);

            // Es lo que manda la pantalla de configuración: no hay ningún caso contra el
            // que resolver el segmento de campo.
            const folio = await resolver().preview(configuration, {});

            expect(folio).toMatch(/‹canal›/);
            expect(folio).toMatch(/000000050$/);
            expect(await sequenceRepository.peek(dto.id, '')).toBeNull();
        });

        it('la vista previa no consume consecutivo', async () => {
            const dto = FolioConfigurationMother.dto();
            await new FolioConfigurationCreator(repository).execute(dto);
            const configuration = await new FolioConfigurationFinder(repository).execute(dto.id);
            const context = FolioConfigurationMother.context();

            const once = await resolver().preview(configuration, context);
            const twice = await resolver().preview(configuration, context);

            expect(once).toBe(twice);
            expect(await sequenceRepository.peek(dto.id, '')).toBeNull();
        });
    });

    describe('Case.clone', () => {
        it('no hereda el folio del caso original', async () => {
            // Sin esto el clon violaría idx_cases_folio_unique y devolvería un 500.
            const kase = Case.create({ ...(await CasesMother.dto()), folio: '5261000000050' });

            expect(kase.folio.value).toBe('5261000000050');
            expect(kase.clone(uuidv4(), uuidv4()).folio.value).toBeNull();
        });
    });
});
