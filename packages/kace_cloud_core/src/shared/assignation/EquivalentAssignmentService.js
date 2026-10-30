export class EquivalentAssignmentService {
    /**
     * Creates an instance of EquivalentAssignmentService.
     *
     * @param {KnexUsersRepository} usuarioRepository - Repository for user-related operations.
     */
    constructor(usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * Returns the ID of the responsible user for the group based on roles and permissions.
     *
     * The method checks if the group allows assigning a supervisor. If so, it includes the 'supervisor' role
     * along with 'agent'. It then queries the repository and returns the ID of the first user found, or `null` if no user is found.
     *
     * @param {Group} group - The group object containing the group ID and its permissions.
     * @returns {string|null} - The ID of the responsible user, or `null` if no user is found.
     */
    async execute(grupo) {
        const { id } = grupo;
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        // TODO: cuando se diferencie un usuario de admin a agente agregar logica para buscar solo usuarios agente
        const responsables = await this.usuarioRepository.findByGroupForEquivalentAssignment(id.value);

        if (!responsables || !responsables.length) {
            return null;
        }
        return responsables[0]?.responsable_id;
    }
}
