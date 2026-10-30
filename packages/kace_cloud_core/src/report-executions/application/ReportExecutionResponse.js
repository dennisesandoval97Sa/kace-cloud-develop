export class ReportExecutionResponse {
    /**
     * @param {ReportExecution} execution
     */
    constructor(execution) {
        this.execution = execution;
    }

    toJson() {
        return {
            id: this.execution.id.value,
            name: this.execution.name?.value,
            report_name: this.execution.name?.value,
            period: this.execution.period?.value,
            conditions: this.execution.conditions?.value,
            parameters: {
                period: this.execution.period?.value,
                conditions: this.execution.conditions?.value,
            },
            status: this.execution.status.value,
            result: this.execution.result?.value,
            error: this.execution.error?.value,
            started_at: this.execution.started_at?.value,
            completed_at: this.execution.completed_at?.value,
            created_at: this.execution.created_at?.value,
        };
    }
}
