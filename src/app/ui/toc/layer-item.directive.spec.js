/* global bard, $compile, $rootScope, tocService */

describe('rvLayerItem', () => {
    let scope;
    let directiveScope; // needed since directive requests an isolated scope
    let directiveElement;

    // mock a group object
    const mockLayer = {
        type: 'layer',
        name: 'Layer Name 1 Layer Name 1 Layer Name 1 Layer Name 1',
        layerType: 'feature',
        id: 0,
        legend: [
            {
                icon: 'url',
                name: 'something'
            }
        ],
        toggles: {
            // needed for layer-item-button directives
        },
        state: 'default', // error, loading,
        flags: {
            // needed for layer-item-flag directives
        }
    };

    beforeEach(() => {
        // mock the module with bardjs; include templates modules
        bard.appModule('app.ui.toc', 'app.templates', 'ngMaterial', 'app.common.router');

        // inject angular services
        bard.inject('$compile', '$rootScope', 'tocService');

        // spy on group visibility toggle method
        spyOn(tocService.actions, 'toggleLayerFiltersPanel');

        // crete new scope
        scope = $rootScope.$new();

        // add mockGroup object to the scope, so directive has access to it
        scope.item = mockLayer;

        directiveElement = angular.element(
            '<rv-layer-item layer="item"></rv-layer-item>'
        );

        directiveElement = $compile(directiveElement)(scope);
        scope.$digest();

        // get isolated scope from the directive created;
        // http://stackoverflow.com/a/20312653
        directiveScope = directiveElement.isolateScope();
    });

    describe('rvLayerItem', () => {
        it('should be created successfully', () => {
            // check that directive element exists
            expect(directiveElement)
                .toBeDefined();

            // check that directive pulled the toggleGroup function from mocked tocController
            expect(directiveScope.self.toggleLayerFiltersPanel)
                .toBeDefined();

            // call toggleGroup method on the directive
            directiveScope.self.toggleLayerFiltersPanel();

            // check if the corresponding method has been called
            expect(tocService.actions.toggleLayerFiltersPanel)
                .toHaveBeenCalled();
        });
    });
});
