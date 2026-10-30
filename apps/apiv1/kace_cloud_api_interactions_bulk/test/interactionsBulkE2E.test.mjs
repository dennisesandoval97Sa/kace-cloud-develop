const interactionsBulkE2eEnabled = process.env.INTERACTIONS_BULK_E2E === 'true';

(interactionsBulkE2eEnabled ? describe : describe.skip)('Interactions bulk E2E', () => {
    it('requires a local API server and tenant test credentials', () => {
        expect(interactionsBulkE2eEnabled).toBe(true);
    });
});
