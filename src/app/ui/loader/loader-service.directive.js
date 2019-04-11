/* global RV */

const templateUrl = require('./loader-service.html');

/**
 * @module rvLoaderService
 * @module app.ui
 * @restrict A
 * @description
 *
 * The `rv-loader-service` directive creates a stepper interface for importing map services and online-based geo files and turning them into layers.
 *
 */
angular.module('app.ui').directive('rvLoaderService', rvLoaderService);

function rvLoaderService() {
    const directive = {
        restrict: 'E',
        templateUrl,
        scope: {},
        controller: Controller,
        controllerAs: 'self',
        bindToController: true
    };

    return directive;
}

function Controller($q, $timeout, stateManager, Geo, Stepper, $rootElement, keyNames, layerSource, legendService, appInfo) {
    'ngInject';
    const self = this;

    self.closeLoaderService = closeLoaderService;
    self.isWMSLayerWithMultipleStyles = isWMSLayerWithMultipleStyles;
    self.isHTTPS = location.protocol === 'https:';

    self.serviceTypes = [
        Geo.Service.Types.FeatureLayer,
        Geo.Service.Types.DynamicService,
        Geo.Service.Types.TileService,
        Geo.Service.Types.ImageService,
        Geo.Service.Types.WMS,
        Geo.Service.Types.WFS,
        Geo.Service.Types.RasterLayer
    ];

    self.common = {
        toggleLayers,
        isSomeLayersSelected,
        isAllLayersSelected,
        onDynamicLayerSection
    };

    // TODO: turn into a proper class
    self.connect = {
        step: {
            titleValue: 'import.service.connect.title',
            stepNumber: 1,
            isActive: false,
            isCompleted: false,
            onContinue: connectOnContinue,
            onCancel: () => {
                connectReset();
                onCancel(self.connect.step);
            },
            onKeypress: event => {
                const connect = self.connect;
                // prevent enter presses from triggering service handshake if the input value is not validated
                if (event.keyCode === keyNames.ENTER) {
                    if (connect.form.$valid && connect.step.isContinueEnabled && !connect.step.isThinking) {
                        // check if enter key have been pressed and call the next step if so
                        connectOnContinue();
                    }

                    if (!connect.form.$valid) {
                        toggleErrorMessage(connect.form, 'serviceUrl', 'url', false);
                    }
                }
            },
            reset: connectReset
        },
        form: null,
        serviceUrl: null,
        serviceUrlResetValidation
    };

    self.select = {
        step: {
            titleValue: 'import.service.select.title',
            stepNumber: 2,
            isActive: false,
            isCompleted: false,
            onContinue: selectOnContinue,
            onCancel: () => onCancel(self.select.step),
            reset: selectReset
        },
        serviceTypeResetValidation,
        form: null,
        serviceType: null
    };

    self.configure = {
        step: {
            titleValue: 'import.service.configure.title',
            stepNumber: 3,
            isActive: false,
            isCompleted: false,
            onContinue: configureOnContinue,
            onCancel: () => onCancel(self.configure.step),
            reset: configureReset
        },
        form: null,
        defaultOptions: {},
        colourPickerSettings: {
            theme: 'bootstrap',
            position: 'top right'
        }
    };

    self.layerBlueprint = null;

    const stepper = new Stepper();
    stepper
        .addSteps(self.connect.step)
        .addSteps(self.select.step)
        .addSteps(self.configure.step)
        .start(); // activate stepper on the first step

    /***/

    /**
     * Tiny helper function to set/reset error messages on fields
     * TODO: need to abstract - loader-file has the same function
     * @function toggleErrorMessage
     * @param  {Object} form      form object
     * @param  {String} fieldName field name to set the error on
     * @param  {String} errorName name of the error message
     * @param  {Boolean} state     =             false; false - show error, true - hide error
     */
    function toggleErrorMessage(form, fieldName, errorName, state = false) {
        // when showing errors, dirty and touch the fields
        // this is needed when a preselected field causes validation to fail; since user hasn't interacted with the field, it's untouched and pristine and error messages are not shown for untouched fields;
        if (!state) {
            form[fieldName].$setDirty();
            form[fieldName].$setTouched();
        }

        form[fieldName].$setValidity(errorName, state);
    }

    /**
     * Cancels any stepper movements if the step is processing data; resets input and moves to the previous step if not.
     * @function onCancel
     * @param {Object} step FIXME add some docs
     */
    function onCancel(step) {
        if (step.isThinking) {
            stepper.cancelMove();
        } else {
            stepper.previousStep(); // going to the previous step will auto-reset the current one (even if there is no previous step to go to)
        }
    }

    /**
     * Tries to create a service LayerBlueprint from the url provided. If creation is successful, proceeds to the next step.
     * If creation fails, display a "broken service url" error message. This can happen because the provided url is not a service endpoint or if the service endpoint doesn't respond.
     * @function connectOnContinue
     */
    function connectOnContinue() {
        const connect = self.connect;

        const layerBlueprintPromise = layerSource
            // maps served over https can only accept https enabled services to avoid mixed content issues.
            .fetchServiceInfo(self.isHTTPS ? connect.serviceUrl.replace('http:', 'https:') : connect.serviceUrl)
            .then(({ options: layerBlueprintOptions, preselectedIndex }) => {
                self.layerBlueprintOptions = layerBlueprintOptions;
                self.layerBlueprint = layerBlueprintOptions[preselectedIndex];
            })
            .catch(error => {
                toggleErrorMessage(connect.form, 'serviceUrl', 'broken', false);
                return $q.reject(error);
            });

        stepper.nextStep(layerBlueprintPromise);

        /*

        // creating new service blueprint with the provided url
        // since there is no layer type provided, blueprint will try to get service data
        self.layerBlueprint = new LayerBlueprint.service({
            url: connect.serviceUrl
        }, geoService.epsgLookup);

        // TODO: refactor this
        self.layerBlueprint.initialConfig = { flags: { user: { visible: true } } };

        self.layerBlueprint.ready.catch(() => toggleErrorMessage(connect.form, 'serviceUrl', 'broken', false));

        stepper.nextStep(self.layerBlueprint.ready);

        */
    }

    /**
     * Clears service url field and all error displayed; sets the form to pristine, untouched state (so no default validation errors (like "required" or "not a proper url") will show)
     * @function connectReset
     */
    function connectReset() {
        const connect = self.connect;

        connect.serviceUrl = '';
        connect.form.$setPristine();
        connect.form.$setUntouched();

        // TODO: generalize resetting custom form validation
        connect.serviceUrlResetValidation();
    }

    /**
     * Resets service URL field validation.
     * @function serviceUrlResetValidation
     */
    function serviceUrlResetValidation() {
        // reset broken endpoint error message when user modifies service url
        toggleErrorMessage(self.connect.form, 'serviceUrl', 'broken', true);
    }

    /**
     * Validates created service Layer Blueprint against selected service type.
     * TODO: do the validation if at all possible;
     * @function selectOnContinue
     */
    function selectOnContinue() {
        // for WFS layers, there is a validation process
        // for consistency, also mock a validation for non-WFS services
        let validationPromise;

        try {
            validationPromise = self.layerBlueprint.validate();
        } catch (e) {
            console.error('loaderServiceDirective', 'service type is wrong', e);
            toggleErrorMessage(self.select.form, 'serviceType', 'wrong', false);
            return;
        }

        validationPromise.catch(error => {
            console.error('loaderServiceDirective', 'service type is wrong', error);
            toggleErrorMessage(self.select.form, 'serviceType', 'wrong', false);
        });

        stepper.nextStep(validationPromise);

        /*
        const validationPromise = self.layerBlueprint.validate();

        // TODO: move reseting options to defaults into blueprint; this can be done upon successful validation
        self.configure.defaultOptions = angular.copy(self.layerBlueprint.config);
        stepper.nextStep(validationPromise);
        */
    }

    // FIXME add docs
    function selectReset() {
        const select = self.select;

        select.form.$setPristine();
        select.form.$setUntouched();

        // TODO: generalize resetting custom form validation
        select.serviceTypeResetValidation();
    }

    // FIXME add docs
    function serviceTypeResetValidation() {
        // reset wrong service type error message
        toggleErrorMessage(self.select.form, 'serviceType', 'wrong', true);
    }

    /**
     * Builds layer with the specified options and adds it to the map; displays error message if something is not right.
     * @function configureOnContinue
     */
    function configureOnContinue() {
        const layerRecordPromise = self.layerBlueprint.makeLayerRecord();

        layerRecordPromise
            .then(() => {
                legendService.importLayerBlueprint(self.layerBlueprint);
                closeLoaderService();
            })
            .catch(error => {
                console.warn('loaderServiceDirective', 'service is invalid ', error);
                self.configure.form.$setValidity('invalid', false);
            });
    }

    /**
     * Restores default configuration options (layer name, etc.) and resets the form to pristine state to hide default error messages.
     * @function configureReset
     */
    function configureReset() {
        const configure = self.configure;

        configure.form.$setPristine();
        configure.form.$setUntouched();

        // if reset called before the first step is complete, layerBlueprint will not exist yet
        if (self.layerBlueprint) {
            self.layerBlueprint.reset();
        }
    }

    /**
     * A helper function called when the dynamic layer selection changes to update the `singleEntryCollapse` property of the dynamic layer being imported.
     * The option is enabled only if there is a single layer entry selected.
     * @function onDynamicLayerSection
     */
    function onDynamicLayerSection() {
        const config = self.layerBlueprint.config;

        config.singleEntryCollapse = config.layerEntries.length === 1;
    }

    /**
     * Checks if all sub-layer options are selected.
     *
     * @function isAllLayersSelected
     * @return {Boolean} true if all sub-layer options are selected
     */
    function isAllLayersSelected() {
        const selectedLayers = self.layerBlueprint.config.layerEntries;
        const availableLayers = self.layerBlueprint.layers;

        return selectedLayers.length === availableLayers.length;
    }

    /**
     * Checks if at least one, but not all sub-layer options are selected.
     *
     * @function isSomeLayersSelected
     * @return {Boolean} true if at least one, but not all sub-layer options are selected
     */
    function isSomeLayersSelected() {
        const selectedLayers = self.layerBlueprint.config.layerEntries;
        const availableLayers = self.layerBlueprint.layers;

        return selectedLayers.length !== 0 && selectedLayers.length !== availableLayers.length;
    }

    /**
     * Selects or deselects all sub-layer options depending on current state:
     * - all selected -> deselect all
     * - some selected -> select all
     * - none selected -> select all
     *
     * @function toggleLayers
     */
    function toggleLayers() {
        const selectedLayers = self.layerBlueprint.config.layerEntries;
        const availableLayers = self.layerBlueprint.layers;

        if (selectedLayers.length === availableLayers.length) {
            self.layerBlueprint.config.layerEntries = [];
        } else if (selectedLayers.length >= 0) {
            self.layerBlueprint.config.layerEntries = self.layerBlueprint.layers.slice(0);
        }
    }

    /**
     * Checks if any of the selected wms layers have more than one style
     *
     * @function isWMSLayerWithMultipleStyles
     * @return {Boolean} true if at least one with multiple styles
     */
    function isWMSLayerWithMultipleStyles() {
        return (
            self.layerBlueprint &&
            self.layerBlueprint.config.layerType === Geo.Layer.Types.OGC_WMS &&
            self.layerBlueprint.config.layerEntries.some(entry => entry.allStyles.length > 1)
        );
    }

    /**
     * Closes loader pane and switches to toc.
     * @function closeLoaderService
     */
    function closeLoaderService() {
        // reset the loader after closing the panel
        self.layerBlueprint = null;
        stepper.reset().start();
        appInfo.mapi.panels.serviceLoader.close({'destroy': false});

        // there is a bug with Firefox and Safari on a Mac. They don't focus back to add layer when close
        $timeout(() => {
            $rootElement
                .find('.rv-loader-add')
                .first()
                .rvFocus();
        }, 0);
    }
}
