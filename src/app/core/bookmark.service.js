(() => {

    /**
     * @ngdoc service
     * @name bookmarkService
     * @module app.core
     *
     * @description bookmarkService handles creation and parsing of bookmarks.
     *
     */
    angular
        .module('app.core')
        .factory('bookmarkService', bookmarkService);

    function bookmarkService($rootElement, $q, legendService, geoService, LayerBlueprint,
            LayerRecordFactory, configService) {

        const service = {
            getBookmark,
            parseBookmark
        };

        return service;

        /************************/

        /**
         * Creates a bookmark containing the current state of the viewer
         *
         * @function getBookmark
         * @returns {String}    The bookmark containing basemap, extent, layers and their options
         */
        function getBookmark() {
            // const basemap = encode64(geoService.mapManager.BasemapControl.basemapGallery.getSelected().id);
            const basemap = encode64(geoService.getCurrentBasemapId());
            console.log(basemap);
            console.log(geoService.getCurrentBasemapId());

            const mapExtent = geoService.mapObject.extent.getCenter();

            // get zoom level
            // get center coords
            const extent = {
                x: encode64(mapExtent.x),
                y: encode64(mapExtent.y),
                zoom: encode64(geoService.mapObject.getZoom())
            };

            // loop through layers in legend
            const legend = geoService.legend.items.filter(legendEntry => {
                return !legendEntry._layerRecord.config.flags.user.visible;
            });
            const layerBookmarks = legend.map(legendEntry => {
                // FIXME: remove moving through _layerRecord
                return encode64(legendEntry._layerRecord.makeLayerBookmark());
            });

            const bookmark = `${basemap},${extent.x},${extent.y},${extent.zoom}` +
                (layerBookmarks.length > 0 ? `,${layerBookmarks.toString()}` : '');
            console.log(bookmark);
            return bookmark;

        }

        /**
         * Reads and applies the options specified by bookmark to config
         *
         * @function parseBookmark
         * @param {String} bookmark     A bookmark created by getBookmark
         * @param {Object} origConfig   The config object to modify
         * @returns {Object}            The config with changes from the bookmark
         */
        function parseBookmark(bookmark, origConfig) {
            const config = angular.copy(origConfig);
            const pattern = /^([^,]+),([^,]+),([^,]+),([^,]+)(?:$|,(.*)$)/i;
            const layerPatterns = [
                /^(.+?)(\d{7})$/, // feature
                /^(.+?)(\d{6})$/, // wms
                /^(.+?)(\d{5})$/, // tile
                /^(.+?)(\d{6})$/, // dynamic
                /^(.+?)(\d{5})$/ // image
            ];
            const blankBasemapIdPattern = 'blank_basemap_';

            bookmark = decodeURI(bookmark);

            console.log(bookmark);

            const info = bookmark.match(pattern);

            // pull out non-layer info
            const [basemap, x, y, zoom] = [1, 2, 3, 4].map(i => decode64(info[i]));

            // mark initial basemap
            config.map.initialBasemapId = basemap;

            // apply extent
            let spatialReference;
            const currentBasemap = config.baseMaps.find(bm => bm.id === basemap);
            if (currentBasemap) {
                spatialReference = {
                    wkid: currentBasemap.wkid
                };
            } else {
                spatialReference = {
                    wkid: basemap.slice(blankBasemapIdPattern.length)
                };
            }

            window.RV.getMap($rootElement.attr('id')).centerAndZoom(x, y, spatialReference, zoom);

            // Make sure there are layers before trying to loop through them
            if (info[5]) {
                const layers = info[5].split(',');
                const bmLayers = {};

                // Loop through bookmark layers and create config snippets
                layers.forEach(layer => {
                    layer = decode64(layer);
                    const layerType = parseInt(layer.substring(0, 2));
                    const [, layerId, layerData] = layer.substring(2).match(layerPatterns[layerType]);

                    bmLayers[layerId] = LayerRecordFactory.parseLayerData(layerData, layerType);

                });

                let configLayers = config.layers;

                // Loop through config layers and apply bookmark info
                configLayers.slice().forEach(layer => {
                    const id = layer.id;
                    const bookmarkLayer = bmLayers[id];
                    if (bookmarkLayer) {
                        // apply bookmark layer info to config
                        angular.merge(config.layers[config.layers.indexOf(layer)], bookmarkLayer);

                        delete bmLayers[id];
                    } else {
                        // layer was removed in bookmarked state, remove it from config object
                        delete config.layers[config.layers.indexOf(layer)];
                    }
                });

                configService.setCurrent(addRcsConfigs(bmLayers, config));
            } else {
                configService.setCurrent($q.resolve(config));
            }
        }

        /**
         * Adds RCS layers to a config, used to modify a bookmark config before first use
         *
         * @function addRcsConfigs
         * @private
         * @param {Object} rcsBookmarks     Config snippets for rcs layers created from a bookmark
         * @param {Object} config           The config to add the final rcs layers to
         * @returns {Promise}               A promise that resolves with the modified config
         */
        function addRcsConfigs(rcsBookmarks, config) {
            if (Object.keys(rcsBookmarks).length > 0) {
                return configService.rcsAddKeys(Object.keys(rcsBookmarks).map(id => id.split('.')[1]))
                    .then(rcsConfigs => {
                        const configSnippets = rcsConfigs.map(cfg => angular.merge(cfg, rcsBookmarks[cfg.id]));
                        config.layers = config.layers.concat(configSnippets);

                        return config;
                    })
                    .catch(() => config);
            }

            return $q.resolve(config);
        }

        /**
         * Encodes the string using base64 and replaces '/' and '+'. This is a URL safe encoding; https://tools.ietf.org/html/rfc4648#page-7
         *
         * @function encode64
         * @private
         * @param {String} string   The string to encode
         * @returns {String}        The encoded string
         */
        function encode64(string) {
            return btoa(string).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
        }

        /**
         * Decodes a string that was encoded using {@link encode64}. URL safe; https://tools.ietf.org/html/rfc4648#page-7
         *
         * @function decode64
         * @private
         * @param {String} string   The string to decode
         * @returns {String}        The decoded string
         */
        function decode64(string) {
            return atob(string.replace(/_/g, '/').replace(/-/g, '+'));
        }
    }
})();
