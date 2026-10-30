export const configureWorkspacePriorityOutboxRecovery = ({
    scope,
    endpoint,
    appsServiceName,
    wsRestQueue,
    eventBus,
    getNodejsFunction,
    grantDynamoDbPermissions,
    createOrchestrator,
    Rule,
    scheduleExpression,
    LambdaTarget,
    durationSeconds,
}) => {
    const recoveryLambda = getNodejsFunction(`${endpoint}-workspace-priority-outbox-recovery`, {
        entry: 'src/ws-rest/outboxRecoveryHandler.mjs',
        timeout: durationSeconds(60),
        memorySize: 512,
    });
    grantDynamoDbPermissions('WorkspacePriorityOutboxRecovery', recoveryLambda);
    wsRestQueue.grantSendMessages(recoveryLambda);
    eventBus.grantPutEventsTo(recoveryLambda);

    const orchestrator = createOrchestrator({
        endpoint: `${endpoint}-workspace-priority-outbox-recovery`,
        targetLambdaArn: recoveryLambda.functionArn,
        scope,
        suffix: appsServiceName,
    });
    const recoverySchedule = new Rule(scope, 'WorkspacePriorityOutboxRecoverySchedule', {
        schedule: scheduleExpression('cron(* * * * ? *)'),
        description: 'Publishes staged Channel Hub workspace priority reorder events for every tenant',
    });
    recoverySchedule.addTarget(new LambdaTarget(orchestrator));

    return { recoveryLambda, orchestrator, recoverySchedule };
};
