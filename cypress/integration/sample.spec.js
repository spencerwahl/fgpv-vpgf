describe('Stuff', function() {

    beforeEach(function () {
        cy.visit('/samples/index-samples.html')
        cy.window().its('RAMP.mapInstances').should('not.have.length', 0)
        cy.window().then(function (window) {
            cy.wrap(window.RAMP.mapById('sample-map')).as('mapi');
        })
    })

    it('Legend should be hidden after toggle button is clicked', function () {
        cy.get('button[ng-if="self.config.ui.appBar.layers"]').click()
        cy.get('#mainToc').should('not.be.visible')
    })

    it('Help should open when button is clicked', function () {
        cy.get('[name="help"] > .md-icon-button').click()

        cy.get('.rv-help-summary').should('be.visible')
    })

    it('Adds the API to the window', function () {
        this.mapi.panels.legend.close()
        cy.get('#mainToc').should('not.be.visible')
    })

    it('is good', function () {
        this.mapi.panels.legend.toggle()
        expect(this.mapi.panels.legend.isClosed).to.be.true
    })
})