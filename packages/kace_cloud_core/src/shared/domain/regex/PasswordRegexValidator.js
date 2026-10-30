export class PasswordRegexValidator {
    constructor() {
        this.patternLowercase = /^(?=.*[a-z])/;
        this.patternUppercase = /^(?=.*[A-Z])/;
        this.patternNumber = /^(?=.*\d)/;
        this.patternSpecialCharacter = /^(?=.*[^\da-zA-Z])/;
        this.patternLength = /^(.{16,})/;
    }

    validateAttribute(model, field, value) {
        const result = this.validateValue(value);
        if (result) {
            this.addError(field, result[0]);
        }

        const modelWords = this.getWordsFromModel(model);
        const reservedWords = this.getReservedWords();
        const invalidWords = [...modelWords, ...reservedWords];

        invalidWords.forEach((word) => {
            if (value.includes(word)) {
                this.addError(field, 'No puedes usar palabras reservadas en tu contraseña.');
            }
        });

        return this;
    }

    validateValue(value) {
        const rules = [
            { pattern: this.patternLowercase, message: 'Debe contener al menos una minúscula.' },
            { pattern: this.patternUppercase, message: 'Debe contener al menos una mayúscula.' },
            { pattern: this.patternNumber, message: 'Debe contener al menos un número.' },
            { pattern: this.patternSpecialCharacter, message: 'Debe contener al menos un caracter especial.' },
            { pattern: this.patternLength, message: 'Debe contener al menos 16 caracteres.' },
        ];

        for (const rule of rules) {
            if (!rule.pattern.test(value)) {
                return [rule.message, value];
            }
        }

        return null;
    }

    addError(attribute, message) {
        if (!this.errors) {
            this.errors = {};
        }

        if (!this.errors[attribute]) {
            this.errors[attribute] = [];
        }

        this.errors[attribute].push(message);
    }

    getErrors() {
        return this.errors;
    }

    hasError() {
        return Boolean(this.errors);
    }

    getWordsFromModel(model) {
        const modelWords = [model.login || '', model.nombres || '', model.apellido1 || '', model.apellido2 || ''];

        return modelWords.filter((word) => word !== '');
    }

    getReservedWords() {
        return [
            'konecta',
            'Konecta',
            'KONECTA',
            'K0necta',
            'K0n3cta',
            'K0n3ct4',
            'Konect4',
            'Kon3ct4',
            'Konect4',
            'Kon3cta',
            'Allus',
            'allus',
            'ALLUS',
            '4llus',
            '4llu5',
            '4llu5',
        ];
    }
}
