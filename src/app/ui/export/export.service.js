const FileSaver = require('file-saver');
const fancyTemplate = require('./export.html');
const simpleTemplate = require('./export-simple.html')

const EXPORT_IMAGE_GUTTER = 20; // padding around the export image
const EXPORT_CLASS = '.rv-export';

/**
 *
 * @name exportService
 * @module app.ui
 * @requires dependencies
 * @description
 *
 * The `exportService` service description opens the export dialog and generates the export image.
 * Provides two functions:
 *  - open: opens the export dialog and start a new print task
 *  - close: closes the export dialog
 */
angular.module('app.ui').service('exportService', exportService);

function exportService($mdDialog, $mdToast, referenceService, configService, events, appInfo) {
    const service = {
        open,
        close
    };

    // wire in a hook to any map for exporting.  this makes it available on the API
    events.$on(events.rvMapLoaded, (_, i) => {
        configService.getSync.map.instance.export = fileType => {
            if (fileType && fileType !== 'png' && fileType !== 'jpg')
                throw new Error(`Invalid or unsupported file type ${fileType}.`);
            service.open(null, fileType);
        };
    });

    return service;

    /***/

    /**
     * Opens the export dialog.
     * @function open
     * @param {Object} event original click event
     */
    function open(event, fileType = 'png') {
        const shellNode = referenceService.panels.shell;

        const templateUrl = (appInfo.features.export ? simpleTemplate : fancyTemplate)

        $mdDialog.show({
            locals: {
                shellNode,
                fileType
            },
            controller: ExportController,
            controllerAs: 'self',
            bindToController: true,
            templateUrl,
            parent: shellNode,
            targetEvent: event,
            hasBackdrop: true,
            disableParentScroll: false,
            clickOutsideToClose: true,
            fullscreen: true,
            onRemoving: $mdToast.hide,
            onShowing: (scope, element) => (scope.element = element.find(EXPORT_CLASS)) // store dialog DOM node for reference
        });
    }

    /**
     * Closes the export dialog.
     * @function close
     */
    function close() {
        $mdDialog.hide();
    }

    function ExportController(
        $translate,
        $mdToast,
        $q,
        $filter,
        appInfo,
        exportSizesService,
        exportComponentsService,
        graphicsService
    ) {
        'ngInject';
        const self = this;

        const ref = {
            timeout: configService.getSync.services.export.timeout
        };

        self.isError = false;
        self.isGenerateError = false;
        self.errorMessage = '';
        self.isTainted = false; // indicates the canvas is tainted and cannot be directly saved

        self.exportSizes = exportSizesService.update();
        self.lastUsedSizeOption = self.exportSizes.selectedOption;

        // functions
        self.saveImage = saveImage;
        self.close = service.close;
        self.isGenerating = isGenerating;
        self.isDownloadBlocked = isDownloadBlocked;
        self.isSettingsEditable = isSettingsEditable;
        self.updateTitleComponent = updateTitleComponent;
        self.updateComponents = updateComponents;
        self.scrollCustomSettings = scrollCustomSettings;
        self.exportComponents = exportComponentsService;

        // updating export components will initialize them if this is called for the first time;
        exportComponentsService.init().then(() => {
            if (appInfo.features.export) {
                return;
                //Call whatever export plugin stuff needs to be called
                //appInfo.features.export
            } else {
                updateComponents();

                // title component is special since the user can modify its value; we expose it to bind the value to the input field
                self.titleComponent = self.exportComponents.get('title');
                self.mapComponent = self.exportComponents.get('map');

                // watch for the selected option to change and update all the export components
                self.scope.$watch('self.exportSizes.selectedOption', (newValue, oldValue) => {
                    if (oldValue !== newValue && newValue !== self.exportSizes.customOption) {
                        self.exportSizes.customToggled = true;
                        updateComponents();
                    }
                });
            }
        });

        return;

        /**
         * Will regenerate the graphic for the title component when the title value is changed by the user.
         * @function updateTitleComponent
         * @private
         */
        function updateTitleComponent() {
            if (self.titleComponent) {
                self.titleComponent.generate(self.exportSizes.selectedOption, ref.timeout, showToast, true);
            }
        }

        /**
         * Updates all export components forcing them to regenerate their graphics based on the current export size and their values.
         * @function updateComponents
         * @private
         */
        function updateComponents() {
            self.lastUsedSizeOption = self.exportSizes.selectedOption;
            exportComponentsService.update(ref.timeout, showToast).catch(error => {
                self.errorMessage = error.timeout ? 'export.error.timeout' : 'export.error.cantgenerate';
                self.isGenerateError = true;
            });
        }

        /**
         * Checks if any of the components is actively generating export graphics.
         * @function isGenerating
         * @private
         * @return {Boolean} true if any of the components is actively generating export graphics
         */
        function isGenerating() {
            if (!self.exportComponents) {
                return true;
            }

            return self.exportComponents.items.some(item => item.isGenerating);
        }

        /**
         * Checks if anything is blocking the image download. The following things will block the download:
         *  - component graphics being generated
         *  - errors (tainted canvas is an error)
         *  - Safari browser on desktop computer
         *  - if the custom size option was modified but not saved
         *  - if the graphics were generated for an size option different from the currently selected one
         *
         * @function isDownloadBlocked
         * @private
         * @return {Boolean} true if something is blocking the image download
         */
        function isDownloadBlocked() {
            return (
                self.isGenerating() ||
                self.isError ||
                self.isSafari ||
                (self.exportSizes.isCustomOptionSelected() && !self.exportSizes.isCustomOptionUpdated()) ||
                self.lastUsedSizeOption !== self.exportSizes.selectedOption
            );
        }

        /**
         * Checks if any of the export settings can be edited.
         * @function isSettingsEditable
         * @private
         * @return {Boolean} true if some of the export settings can be edited
         */
        function isSettingsEditable() {
            if (!self.exportComponents) {
                return undefined;
            }

            return self.exportComponents.items.some(item => item.isSelectable);
        }

        /**
         * Show a notification toast.
         * I think I'm being clever with default values here.
         * @function showToast
         * @private
         * @param {String} textContent translation key of the string to display in the toast
         * @param {Object} [optional] action word to be displayed on the toast; toast delay before hiding
         * @return {Promise} promise resolves when the user clicks the toast button or the timer runs out
         */
        function showToast(textContent, { action = 'close', hideDelay = 0 } = {}) {
            const options = {
                parent: self.scope.element || self.shellNode,
                position: 'bottom rv-flex-global',
                textContent: $translate.instant(`export.${textContent}`),
                action: action !== '' ? $translate.instant(`export.${action}`) : action,
                hideDelay
            };

            return $mdToast.show($mdToast.simple(options));
        }

        /**
         * If custom size option is selected from the select option, scroll to the rv-export-custom-size section
         * @function scrollCustomSettings
         * @private
         * @param {Object} option the export size object seleted
         */
        function scrollCustomSettings(option) {
            if (option._name === 'export.size.custom') {
                // scroll to custom options section. If scroll down, user can't see the section
                // and if he clicks on customOption section nothing happened. Feels like something is broken.
                self.scope.element.find('md-dialog-content').scrollTop(0);
            }
        }

        /**
         * Generates the final canvas from created pieces and saves it as a file.
         * Takes all the graphics from the export components and smashes them together; tries to save the results as a file; displayes error notifications if the file cannot be saved.
         * @function saveImage
         * @private
         */
        // eslint-disable-next-line max-statements
        function saveImage() {
            // get generated graphics from the export components
            const exportGraphics = self.exportComponents.items
                .filter(component => component.isSelected && component.graphic.height > 0)
                .map(component => component.graphic);

            // extract graphic heights
            const graphicHeights = exportGraphics.map(graphic => graphic.height);

            // find the total height of the legend image including the gutters between component graphics
            const totalHeight = graphicHeights.reduce(
                (runningHeihgt, currentHeight) => runningHeihgt + currentHeight + EXPORT_IMAGE_GUTTER,
                EXPORT_IMAGE_GUTTER
            );

            // figure out offsets for individual graphics assuming they are arranged vertically one after another
            let runningHeight = EXPORT_IMAGE_GUTTER;
            const graphicOffsets = graphicHeights.map(h => {
                runningHeight += h + EXPORT_IMAGE_GUTTER;
                return [EXPORT_IMAGE_GUTTER, runningHeight];
            });

            // add initial offset
            graphicOffsets.unshift([EXPORT_IMAGE_GUTTER, EXPORT_IMAGE_GUTTER]);

            // create the final canvas of the end size
            const canvas = graphicsService.createCanvas(
                self.exportSizes.selectedOption.width + EXPORT_IMAGE_GUTTER * 2,
                totalHeight,
                '#fff'
            );

            // SMASH!!!
            graphicsService.mergeCanvases([canvas, ...exportGraphics], graphicOffsets);

            let fileName = `${appInfo.id}`;

            // file name is either the `app id + title` provided by the user or `app id + timestamp`
            if (self.titleComponent && self.titleComponent.value !== '') {
                fileName += ` - ${self.titleComponent.value}`;
            } else {
                const timestampComponent = self.exportComponents.get('timestamp');
                if (timestampComponent) {
                    fileName += ` - ${timestampComponent.value}`;
                }
            }

            // safari can't save image directly
            if (RV.isSafari) {
                showToast('error.safari');
                self.isSafari = true;
                return;
            }

            // check if the canvas is tained
            if (graphicsService.isTainted(canvas)) {
                // show error; nothing works
                self.isError = true;

                showToast('error.tainted');

                // some browsers (not IE) allow to right-click a canvas on the page and save it manually;
                // only when tainted, display resulting canvas inside the dialog, so users can save it manually, if the browser supports it
                self.isTainted = true;
                self.taintedGraphic = canvas;
                return;
            }


            try {
                // https://github.com/fgpv-vpgf/fgpv-vpgf/issues/3184
                // IE 10+ and Edge have their own `toBlob` implmenetation called `msToblob` ...
                if (canvas.msToBlob) {
                    // ... and it's synchronous!
                    FileSaver.saveAs(canvas.msToBlob(), `${fileName}.${self.fileType}`);
                } else {
                    canvas.toBlob(blob => {
                        FileSaver.saveAs(blob, `${fileName}.${self.fileType}`);
                    });
                }
            } catch (error) {
                console.error(error);
                // something else happened
                showToast('error.somethingelseiswrong');
            }
        }
    }
}
