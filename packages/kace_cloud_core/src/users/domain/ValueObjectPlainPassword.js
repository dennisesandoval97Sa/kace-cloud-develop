import { User } from './User';
import { Guards, InvalidArgumentError, PasswordRegexValidator, ValueObjectString } from '../../shared/index.js';

export class ValueObjectPlainPassword extends ValueObjectString {
    constructor(field, value, UserModel) {
        super(field, value, true);
        if (!(UserModel instanceof User)) {
            throw new InvalidArgumentError('User must be an instance of User');
        }

        if (value) {
            Guards.stringType(this);
            Guards.stringMinLength(this, 8);
            Guards.stringMaxLength(this, 64);

            const validator = new PasswordRegexValidator();
            const passwordValidate = validator.validateAttribute(UserModel, field, value);

            if (passwordValidate.hasError()) {
                throw new Error(
                    `${field}: ${Object.values(passwordValidate.getErrors())
                        .map((message) => message)
                        .join(', ')}`
                );
            }
        }
    }
}
