export class AuxiliaryEntityHelper {
    static isAuxiliaryField(field) {
        if (!field || typeof field !== 'string') return false;

        return (
            (field.startsWith('aux_') ||
                field.startsWith('aux-') ||
                field.includes('case_auxiliar') ||
                field.includes('clients_auxiliar')) &&
            !field.includes('aux_definitions')
        );
    }
}
