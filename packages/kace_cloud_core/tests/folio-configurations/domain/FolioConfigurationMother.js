import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../../src/shared/index.js';
import { FolioConfiguration } from '../../../src/folio-configurations/domain/FolioConfiguration.js';

export class FolioConfigurationMother {
    /**
     * The configuration from the specification: literal "5" + two-digit year + a value
     * from the case auxiliary + a 9-digit consecutive starting at 50, which renders as
     * 5261000000050.
     * @param {Object} override
     * @returns {Object}
     */
    static dto(override = {}) {
        return {
            id: uuidv4(),
            nombre: `Radicado de prueba ${uuidv4().slice(0, 8)}`,
            descripcion: 'Configuración de folio para pruebas',
            segments: [
                { type: 'literal', value: '5' },
                { type: 'date', format: 'YY' },
                { type: 'field', path: 'aux_cases.asistencia_movilidad.monitoreo_proveedor_hidden.canal' },
                { type: 'sequence', length: 9, pad_char: '0' },
            ],
            reset_policy: 'never',
            start_value: 50,
            overflow_policy: 'fail',
            status: StatusEnum.ACTIVE.value,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            ...override,
        };
    }

    /**
     * Same layout with another leading literal: two active configurations may not share a
     * layout, since both would issue the same folios.
     * @param {string} literal
     * @param {Object} override
     * @returns {Object}
     */
    static dtoWithLiteral(literal, override = {}) {
        const dto = FolioConfigurationMother.dto(override);
        const [first, ...rest] = dto.segments;
        return { ...dto, segments: [{ ...first, value: literal }, ...rest] };
    }

    /**
     * The context a folio is rendered against. Same keys as
     * KnexCaseRepository.getCaseContextById produces.
     * @param {Object} override
     * @returns {Object}
     */
    static context(override = {}) {
        return {
            cases: { id: uuidv4(), external_code: 'EXT-001', reference: 42 },
            aux_cases: {
                asistencia_movilidad: {
                    monitoreo_proveedor_hidden: { canal: '1', tipo: 'Petición' },
                    placa: 'ABC123',
                },
            },
            clasificaciones: { nivel1: 'Soporte', nivel2: 'Hardware', external_id: 'CLS-7' },
            clients: {},
            aux_clients: {},
            estados: {},
            ...override,
        };
    }

    /**
     * @param {KnexFolioConfigurationRepository} repository
     * @param {Object} override
     * @returns {Promise<FolioConfiguration>}
     */
    static async create(repository, override = {}) {
        const configuration = FolioConfiguration.create(FolioConfigurationMother.dto(override));
        await repository.save(configuration);
        return configuration;
    }
}
