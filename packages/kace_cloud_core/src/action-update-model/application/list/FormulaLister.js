import { Formulas } from '../../domain/Formulas.js';

export class FormulaLister {
    execute() {
        return Formulas.toArray();
    }
}
