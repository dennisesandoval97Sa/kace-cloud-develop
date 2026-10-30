describe("Boards flows", () => {
    it("loads boards page", () => {
        cy.visit("/boards");
        cy.get("[data-testid=boards-page]").should("exist");
    });
});
