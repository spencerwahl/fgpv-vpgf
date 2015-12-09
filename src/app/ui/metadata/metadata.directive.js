(() => {
    'use strict';

    /**
     * @ngdoc directive
     * @name rvMetadata
     * @module app.ui.metadata
     * @restrict E
     * @description
     *
     * The `rvMetadata` directive wraps the side panel's metadata content.
     *
     */
    angular
        .module('app.ui.metadata')
        .directive('rvMetadata', rvMetadata);

    /**
     * `rvMetadata` directive body.
     *
     * @return {object} directive body
     */
    function rvMetadata() {
        const directive = {
            restrict: 'E',
            templateUrl: 'app/ui/metadata/metadata.html',
            scope: {
            },
            controller: Controller,
            controllerAs: 'self',
            bindToController: true
        };

        return directive;
    }

    function Controller() {
        //const self = this;

        activate();

        ///////////

        function activate() {

        }
    }
})();
