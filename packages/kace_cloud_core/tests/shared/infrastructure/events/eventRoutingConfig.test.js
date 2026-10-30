import { buildQueueMapFromTenant } from '../../../../src/shared/infrastructure/events/eventRoutingConfig.js';

function makeTenant(overrides = {}) {
    const def = {
        id: { value: 't-1' },
        aws_cases_events_queue_url: { value: 'https://sqs.test/cases.fifo' },
        aws_action_jobs_events_queue_url: { value: 'https://sqs.test/action-jobs.fifo' },
        aws_automated_actions_events_queue_url: { value: 'https://sqs.test/automated-actions.fifo' },
        aws_ws_rest_events_queue_url: { value: 'https://sqs.test/ws-rest.fifo' },
        aws_reports_events_queue_url: { value: 'https://sqs.test/reports.fifo' },
    };
    return { ...def, ...overrides };
}

describe('eventRoutingConfig.buildQueueMapFromTenant', () => {
    it('builds map with all routed events from tenant fields', () => {
        const map = buildQueueMapFromTenant(makeTenant());
        expect(map['kace.core.case.created']).toBe('https://sqs.test/cases.fifo');
        expect(map['kace.core.case.updated']).toBe('https://sqs.test/cases.fifo');
        expect(map['kace.core.action_job.created']).toBe('https://sqs.test/action-jobs.fifo');
        expect(map['kace.core.automated_actions.requested']).toBe('https://sqs.test/automated-actions.fifo');
        expect(map['kace.core.ws_rest_flow_execution.requested']).toBe('https://sqs.test/ws-rest.fifo');
        expect(map['kace.core.channel_hub_workspace_priority_reorder.requested']).toBe('https://sqs.test/ws-rest.fifo');
        expect(map['kace.core.report_execution.requested']).toBe('https://sqs.test/reports.fifo');
    });

    it('throws when aws_cases_events_queue_url is missing', () => {
        const t = makeTenant({ aws_cases_events_queue_url: undefined });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/aws_cases_events_queue_url/);
    });

    it('throws when aws_action_jobs_events_queue_url is missing', () => {
        const t = makeTenant({ aws_action_jobs_events_queue_url: undefined });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/aws_action_jobs_events_queue_url/);
    });

    it('throws when aws_automated_actions_events_queue_url is missing', () => {
        const t = makeTenant({ aws_automated_actions_events_queue_url: undefined });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/aws_automated_actions_events_queue_url/);
    });

    it('throws when aws_ws_rest_events_queue_url is missing', () => {
        const t = makeTenant({ aws_ws_rest_events_queue_url: undefined });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/aws_ws_rest_events_queue_url/);
    });

    it('throws when aws_reports_events_queue_url is missing', () => {
        const t = makeTenant({ aws_reports_events_queue_url: undefined });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/aws_reports_events_queue_url/);
    });

    it('error message includes the tenant id', () => {
        const t = makeTenant({ id: { value: 'tenant-acme' }, aws_cases_events_queue_url: undefined });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/tenant-acme/);
    });

    it('includes case.post_processing.requested when aws_case_post_processing_queue_url is present', () => {
        const t = makeTenant({
            aws_case_post_processing_queue_url: { value: 'https://sqs.test/case-post-processing.fifo' },
        });
        const map = buildQueueMapFromTenant(t);
        expect(map['kace.core.case.post_processing.requested']).toBe('https://sqs.test/case-post-processing.fifo');
    });

    it('does NOT throw and omits the post-processing entry when its url is missing', () => {
        const t = makeTenant();
        expect(t.aws_case_post_processing_queue_url).toBeUndefined();
        let map;
        expect(() => {
            map = buildQueueMapFromTenant(t);
        }).not.toThrow();
        expect(map['kace.core.case.created']).toBe('https://sqs.test/cases.fifo');
        expect(map['kace.core.case.updated']).toBe('https://sqs.test/cases.fifo');
        expect('kace.core.case.post_processing.requested' in map).toBe(false);
    });

    it('still throws when an existing required url is missing even if post-processing url is present', () => {
        const t = makeTenant({
            aws_cases_events_queue_url: undefined,
            aws_case_post_processing_queue_url: { value: 'https://sqs.test/case-post-processing.fifo' },
        });
        expect(() => buildQueueMapFromTenant(t)).toThrow(/aws_cases_events_queue_url/);
    });
});
