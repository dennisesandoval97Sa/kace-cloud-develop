export class CustomerFields {
    static NOMBRES = new CustomerFields('Nombres', 'nombres');
    static APELLIDO1 = new CustomerFields('Primer Apellido', 'apellido1');
    static APELLIDO2 = new CustomerFields('Segundo Apellido', 'apellido2');
    static SEXO = new CustomerFields('Sexo', 'sexo');
    static ESTADO_CIVIL = new CustomerFields('Estado civil', 'estado_civil');
    static FECHA_NACIMIENTO = new CustomerFields('Fecha de nacimiento', 'fecha_nacimiento');
    static EMAIL = new CustomerFields('Email', 'email');
    static EMAIL_ALTERNO = new CustomerFields('Email alterno', 'email_alterno');
    static TELEFONO = new CustomerFields('Telefono', 'telefono');
    static TELEFONO_ALTERNO = new CustomerFields('Telefono alterno', 'telefono_alterno');
    static CAMPOS_EXTRA3 = new CustomerFields('Tercer campo extra', 'campos_extra3');
    static CAMPOS_EXTRA2 = new CustomerFields('Segundo campo extra', 'campos_extra2');
    static CAMPOS_EXTRA1 = new CustomerFields('Primer campo extra', 'campos_extra1');
    static HABEAS_DATA = new CustomerFields('Habeas data', 'habeas_data');

    constructor(key, value) {
        this.#ensureIsValidCampo(value);
        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            nombres: CustomerFields.NOMBRES,
            apellido1: CustomerFields.APELLIDO1,
            apellido2: CustomerFields.APELLIDO2,
            sexo: CustomerFields.SEXO,
            estado_civil: CustomerFields.ESTADO_CIVIL,
            fecha_nacimiento: CustomerFields.FECHA_NACIMIENTO,
            email: CustomerFields.EMAIL,
            email_alterno: CustomerFields.EMAIL_ALTERNO,
            telefono: CustomerFields.TELEFONO,
            telefono_alterno: CustomerFields.TELEFONO_ALTERNO,
            campos_extra3: CustomerFields.CAMPOS_EXTRA3,
            campos_extra2: CustomerFields.CAMPOS_EXTRA2,
            campos_extra1: CustomerFields.CAMPOS_EXTRA1,
            habeas_data: CustomerFields.HABEAS_DATA,
        };

        if (!map[value]) {
            throw new Error(`Invalid campo value: ${value}`);
        }
        return map[value];
    }

    #ensureIsValidCampo(value) {
        const validValues = new Set([
            'nombres',
            'apellido1',
            'apellido2',
            'sexo',
            'estado_civil',
            'fecha_nacimiento',
            'email',
            'email_alterno',
            'telefono',
            'telefono_alterno',
            'campos_extra3',
            'campos_extra2',
            'campos_extra1',
            'habeas_data',
        ]);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid campo value: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(CustomerFields)) {
            if (CustomerFields[key] instanceof CustomerFields) {
                json[key] = CustomerFields[key].value;
            }
        }
        return json;
    }
}
