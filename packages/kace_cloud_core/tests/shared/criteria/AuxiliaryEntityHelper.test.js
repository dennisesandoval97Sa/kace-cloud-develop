import { AuxiliaryEntityHelper } from '../../../src/shared/criteria/AuxiliaryEntityHelper';

describe('AuxiliaryEntityHelper - isAuxiliaryField', () => {
    it('should return false when field is null or undefined', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField(null)).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField(undefined)).toBe(false);
    });

    it('should return false when field is not a string', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField(123)).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField({})).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField([])).toBe(false);
    });

    it('should return true for fields starting with aux_', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux_cases')).toBe(true);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux_users.name')).toBe(true);
    });

    it('should return true for fields starting with aux-', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux-cases')).toBe(true);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux-users.email')).toBe(true);
    });

    it('should return true for fields containing case_auxiliar', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('case_auxiliar')).toBe(true);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('case_auxiliar.form1.field')).toBe(true);
    });

    it('should return true for fields containing clients_auxiliar', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('clients_auxiliar')).toBe(true);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('clients_auxiliar.custom.field')).toBe(true);
    });

    it('should return false for fields containing aux_definitions', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux_definitions')).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux_definitions.name')).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux_cases.aux_definitions.field')).toBe(false);
    });

    it('should return false for normal entity fields', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('cases')).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('cases.created_at')).toBe(false);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('users.email')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('')).toBe(false);
    });

    it('should correctly handle mixed cases', () => {
        expect(AuxiliaryEntityHelper.isAuxiliaryField('aux_cases.created_at')).toBe(true);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('clients_auxiliar.data.field')).toBe(true);
        expect(AuxiliaryEntityHelper.isAuxiliaryField('random_aux_field')).toBe(false);
    });
});
