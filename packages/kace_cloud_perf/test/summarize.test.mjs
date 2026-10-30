import { renderMarkdown, groupByService } from '../reporter/summarize.mjs';

describe('groupByService', () => {
    it('groups results by their service field', () => {
        const results = [
            { id: 'a', service: 'cases', p95: 100 },
            { id: 'b', service: 'cases', p95: 200 },
            { id: 'c', service: 'users', p95: 50 },
        ];
        const grouped = groupByService(results);

        expect([...grouped.keys()]).toEqual(['cases', 'users']);
        expect(grouped.get('cases')).toHaveLength(2);
    });
});

describe('renderMarkdown', () => {
    it('produces a markdown table per service with header rows', () => {
        const metadata = {
            baselineId: '2026-05-12-f1-read',
            phase: 'F1-R',
            ranAt: '2026-05-12T14:00:00Z',
            environment: { apiBaseUrl: 'https://example.com' },
            loadProfile: { rps: 50, duration: '10m', warmup: '30s' },
            results: [
                {
                    id: 'cases-search',
                    service: 'cases',
                    endpoint: 'GET /cases/',
                    status: 'OK',
                    p50: 100,
                    p95: 500,
                    p99: 900,
                    errorRate: 0,
                    rps: 49.8,
                },
            ],
        };

        const md = renderMarkdown(metadata);

        expect(md).toMatch(/# Baseline 2026-05-12-f1-read/);
        expect(md).toMatch(/## cases/);
        expect(md).toMatch(/cases-search/);
        expect(md).toMatch(/500/); // p95 visible
    });
});
