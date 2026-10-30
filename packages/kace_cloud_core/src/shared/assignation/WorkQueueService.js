export class WorkQueueService {
    /**
     * Creates an instance of WorkQueueService.
     *
     * @param {KnexUsersRepository} usuarioRepository - Repository for user-related operations.
     */
    constructor(usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * Returns the ID of the agent or supervisor with the fewest cases to assign work to.
     *
     * The method checks if the group has permission to assign a supervisor. It then selects either an agent or
     * a supervisor (depending on permissions) who has the fewest cases. If there is a tie, the user who
     * connected first (oldest last_login_at, as ordered by the repository) is chosen.
     *
     * @param {Group} grupo - The group object containing group ID and permissions.
     * @returns {string|null} - The ID of the selected user or `null` if no user is found.
     */
    async execute(grupo, workQueueConfigurations = {}, caseId = null) {
        const { id } = grupo;
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        // TODO: cuando se diferencie un usuario de admin a agente agregar logica para buscar solo usuarios agente
        const agentesGrupo = await this.usuarioRepository.findCandidateForWorkQueue(
            id.value,
            workQueueConfigurations,
            caseId
        );

        if (!agentesGrupo || !agentesGrupo.length) {
            return null;
        }

        const minCasos = Math.min(...agentesGrupo.map((a) => a.casos));
        const responsablesConMinCasos = agentesGrupo.filter((a) => a.casos == minCasos);
        return responsablesConMinCasos[0].responsable_id;
    }
}
