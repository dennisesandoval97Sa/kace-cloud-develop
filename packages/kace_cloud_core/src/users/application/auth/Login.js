import { AccountTypeEnum } from '../../../shared/domain/enum/AccountTypeEnum';
import { CustomError } from '../../../shared/errors/CustomError';
import { UserLoginFinder } from '../../domain/UserLoginFinder';
import { UserResponse } from '../UserResponse';
import PasswordEncoder from '../../../shared/domain/crypto/PasswordEncoder.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import {TenantContext} from "../../../shared/index.js";

export class Login {
    /** @type {KnexUsersRepository} is initialized in the constructor*/
    #repository;
    /** @type {UserLoginFinder} is initialized in the constructor */
    #loginFinder;

    /**
     *
     * @param {KnexUsersRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#loginFinder = new UserLoginFinder(repository);
    }

    /**
     *
     * @param {string} login login user
     * @param {string} password password user
     * @returns {Promise<string|null>}
     * @throws {CustomError} if the credentials are invalid
     * @throws {CustomError} if the user is not found
     */
    async execute(login, password) {
        /** @type {User} */
        const user = await this.#loginFinder.execute(login);

        if (!user) {
            Helper.logInfo(`Login fail: User login "${login}" not found`);
            throw new CustomError('Invalid credentials', 400);
        }

        if (user.account_type.value === AccountTypeEnum.SERVICE.value) {
            if (false === PasswordEncoder.compareHash(password, user.password.value)) {
                Helper.logInfo(`Login fail: User login "${login}" invalid password`);
                throw new CustomError('Invalid credentials', 400);
            }
        }
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        //TODO: Agregar validación para cuentas tipo identity

        const token = user.authenticate(TenantContext.getTenant().secret_key.value);
        user.update({ token });
        this.#repository.update(user);
        return new UserResponse(user);
    }
}
