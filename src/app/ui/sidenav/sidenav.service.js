import marked from 'marked';
const moment = window.moment;
const templateURLs = {
    about: require('./about-dialog.html'),
    share: require('./share-dialog.html')
};

// this is a default configuration of the side menu
// options are grouped into sections and will be rendered as distinct lists in the side menu panel
const SIDENAV_CONFIG_DEFAULT = {
    logo: true,
    items: [
        [
            'layers',
            'basemap'
        ],
        [
            'fullscreen',
            'export',
            'share',
            'touch',
            'help'
        ],
        [
            'language'
        ]
    ]
};

/**
 *
 * @module sideNavigationService
 * @memberof app.ui
 *
 * @description
 * The `sideNavigationService` service provides access and controls the side navigation menu.
 * Exposes methods to close/open the side navigation panel.
 */
angular
    .module('app.ui')
    .factory('sideNavigationService', sideNavigationService);

// need to find a more elegant way to include all these dependencies
function sideNavigationService($mdSidenav, $rootElement, configService, basemapService, fullScreenService, exportService, referenceService, helpService, reloadService,
    translations, $mdDialog, geosearchService, $mdDateLocale, events, appInfo) {

    const service = {
        open,
        close,

        controls: {},

        ShareController,
        AboutController
    };

    service.controls = {
        layers: {
            type: 'link',
            label: 'appbar.tooltip.layers',
            icon: 'maps:layers',
            isChecked: () => appInfo.mapi && appInfo.mapi.panels.legend.isOpen,
            action: () => {
                service.close();
                appInfo.mapi.panels.legend.toggle();
            }
        },
        basemap: {
            type: 'link',
            label: 'nav.label.basemap',
            icon: 'maps:map',
            action: () => {
                service.close();
                basemapService.open();
            }
        },
        geoSearch: {
            type: 'link',
            label: 'appbar.tooltip.geosearchshort',
            icon: 'action:search',
            action: () => {
                service.close();
                geosearchService.toggle();
            }
        },
        export: {
            type: 'link',
            label: 'sidenav.label.export',
            icon: 'community:export',
            action: () => {
                service.close();
                exportService.open();
            }
        },
        share: {
            type: 'link',
            label: 'sidenav.label.share',
            icon: 'social:share',
            action: () => {
                service.close();

                $mdDialog.show({
                    controller: service.ShareController,
                    controllerAs: 'self',
                    templateUrl: templateURLs.share,
                    parent: referenceService.panels.shell,
                    disableParentScroll: false,
                    clickOutsideToClose: true,
                    fullscreen: false,
                    onShowing: (scope, element) =>
                        (scope.element = element.find('.side-nav-summary'))
                }).then(() =>
                    ($rootElement.find('.rv-shareLink').select()));
            }
        },
        about: {
            type: 'link',
            label: 'sidenav.label.about',
            icon: 'action:info_outline',
            action: () => {
                service.close();

                $mdDialog.show({
                    controller: service.AboutController,
                    controllerAs: 'self',
                    templateUrl: templateURLs.about,
                    parent: referenceService.panels.shell,
                    disableParentScroll: false,
                    clickOutsideToClose: true,
                    fullscreen: false
                });
            }
        },
        fullscreen: {
            type: 'link',
            label: 'sidenav.label.fullscreen',
            icon: 'navigation:fullscreen',
            isChecked: fullScreenService.isExpanded,
            action: () => fullScreenService.toggle()
        },
        touch: {
            type: 'link',
            label: 'sidenav.label.touch',
            icon: 'action:touch_app',
            isChecked: () => $rootElement.hasClass('rv-touch'),
            action: () => $rootElement.toggleClass('rv-touch')
        },
        help: {
            type: 'link',
            label: 'sidenav.label.help',
            icon: 'community:help',
            action: () => {
                service.close();
                helpService.open();
            }
        },
        language: {
            type: 'group',
            label: 'sidenav.label.language',
            icon: 'action:translate',
            children: []
        },
        plugins: {
            type: 'group',
            label: 'sidenav.menu.plugin',
            icon: 'action:settings_input_svideo',
            children: []
        }
    };

    events.$on(events.rvApiMapAdded, () => {
        // When the map is reloaded (language switch, projection switch)
        // Plugins are initialized again so clear out old plugin buttons
        if (service.controls.plugins.children.length > 0) {
            service.controls.plugins.children = [];
        }
    })

    events.$on(events.rvApiPrePlugin, (_, mApi) => {
        mApi.changeLanguage = reloadService.loadNewLang;

        configService.getSync.map.instance.addPluginButton = (label, action) => {
            // first plugin created should add the plugin group
            if (service.controls.plugins.children.length === 0) {
                SIDENAV_CONFIG_DEFAULT.items.push(['plugins']);
            }

            let mItem = {
                type: 'link',
                label,
                action
            }

            mItem.isChecked = () => mItem.isActive;
            service.controls.plugins.children.push(mItem);
            return mItem;
        };
    });

    init();

    return service;

    function ShareController(scope, $mdDialog, $rootElement, $http, configService, appInfo, LEGACY_API) {
        'ngInject';
        const self = this;

        // url cache to avoid unneeded API calls
        const URLS = {
            short: undefined,
            long: undefined
        };

        self.switchChanged = switchChanged;
        self.close = $mdDialog.hide;

        getLongLink();

        // fetch googleAPIKey - if it exists the short link switch option is shown
        configService.onEveryConfigLoad(conf =>
            (self.googleAPIUrl = conf.googleAPIKey ?
                `https://www.googleapis.com/urlshortener/v1/url?key=${conf.googleAPIKey}` : null)
        );

        /**
        * Handles onClick event on URL input box
        * @function switchChanged
        * @param    {Boolean}    value   the value of the short/long switch option
        */
        function switchChanged(value) {
            self.linkCopied = false;
            return value ? getShortLink() : getLongLink();
        }

        /**
        * Fetches a long url from the page if one has not yet been cached
        * @function getLongLink
        */
        function getLongLink() {
            if (typeof URLS.long === 'undefined') { // no cached url exists
                // eslint-disable-next-line no-return-assign
                URLS.long = self.url = window.location.href.split('?')[0] + '?rv=' + String(LEGACY_API.getBookmark());
                selectURL();
            } else {
                self.url = URLS.long;
                selectURL();
            }
        }

        /**
        * Fetches a short url from the Google API service if one has not yet been cached
        * @function getShortLink
        */
        function getShortLink() {
            // no cached url exists - making API call
            if (typeof URLS.short === 'undefined') {
                $http.post(self.googleAPIUrl, { longUrl: self.url })
                    .then(r => {
                        URLS.short = self.url = r.data.id;
                        selectURL();
                    })
                    .catch(() => (URLS.short = undefined)); // reset cache from failed API call);
            // cache exists, API call not needed
            } else {
                self.url = URLS.short;
                selectURL();
            }
        }

        /**
        * Select URL in input box
        * @function selectURL
        */
        function selectURL() {
            if (scope.element !== undefined) {
                scope.element.find('.rv-shareLink').select();
            }
        }
    }

    function AboutController(scope, $mdDialog, $sanitize, $http, configService) {
        'ngInject';
        const self = this;

        self.close = $mdDialog.hide;
        self.loading = true;

        // get about map description from markdown or config file
        configService.onEveryConfigLoad(config => {
            if (config.ui.about.content) {
                self.about = config.ui.about.content;
                self.loading = false;
            } else if (config.ui.about.folderName) {
                useMarkdown(config.ui.about.folderName).then(html => {
                    self.about = html;
                }).catch(error => {
                    console.warn(error);
                }).finally(() => (self.loading = false));
            }
       });

        /**
         * Takes a folder path, fetches markdown files and parses them.
         * @param {String} foldername path to the markdown files
         * @return {Promise} a promise resolving to rendered HTML
         */
        function useMarkdown(foldername) {
            const renderer = new marked.Renderer();
            // make it easier to use images in markdown by prepending path to href if href is not an external source
            // this avoids the need for ![](help/images/myimg.png) to just ![](myimg.png). This overrides the default image renderer completely.
            renderer.image = (href, title) => {
                if (href.indexOf('http') === -1) {
                    href = `about/${foldername}/images/` + href;
                }
                return `<img src="${href}" alt="${title}">`;
            };

            const mdLocation = `about/${foldername}/${configService.getSync.language}.md`;
            return $http.get(mdLocation).then(r => marked(r.data, { renderer }));
        }
    }

    /**
     * Opens side navigation panel.
     * @function open
     */
    function open() {
        $mdSidenav('left')
            .open()
            .then(() => $('md-sidenav[md-component-id="left"] button').first().rvFocus());
    }

    /**
     * Closes side navigation panel.
     * @function close
     */
    function close() {
        return $mdSidenav('left').close();
    }

    /**
     * Set up initial mapnav cluster buttons.
     * Set up language change listener to update the buttons and language menus when a new config is loaded.
     *
     * @function init
     * @private
     */
    function init() {
        configService.onEveryConfigLoad(config => {
            // all menu items should be defined in the config's ui section
            // should we account for cases when the export url is not specified, but export option is enabled in the side menu thought the config and hide it ourselves?
            // or just let it failed
            // or do these checks together with layer definition validity checks and remove export from the sidemenu options at that point
            //service.controls.export.isHidden = typeof config.services.exportMapUrl === 'undefined';

            // generate the language selector menu;
            const langs = config.languages;
            service.controls.language.children = langs.map(l =>
                ({
                    type: 'link',
                    label: translations[l].lang[l.substring(0, 2)],
                    action: switchLanguage,
                    isChecked: isCurrentLanguage,
                    value: l
                }));

            // if there is isn't French data available, add it
            // from: https://github.com/moment/moment/blob/develop/locale/fr-ca.js
            if (!moment.locales().includes('fr-CA')) {
                moment.locale('fr-CA', {
                    months : 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_'),
                    monthsShort : 'janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.'.split('_'),
                    monthsParseExact : true,
                    weekdays : 'dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'.split('_'),
                    weekdaysShort : 'dim._lun._mar._mer._jeu._ven._sam.'.split('_'),
                    weekdaysMin : 'di_lu_ma_me_je_ve_sa'.split('_'),
                    weekdaysParseExact : true,
                    longDateFormat : {
                        LT : 'HH:mm',
                        LTS : 'HH:mm:ss',
                        L : 'YYYY-MM-DD',
                        LL : 'D MMMM YYYY',
                        LLL : 'D MMMM YYYY HH:mm',
                        LLLL : 'dddd D MMMM YYYY HH:mm'
                    },
                    calendar : {
                        sameDay : '[Aujourd’hui à] LT',
                        nextDay : '[Demain à] LT',
                        nextWeek : 'dddd [à] LT',
                        lastDay : '[Hier à] LT',
                        lastWeek : 'dddd [dernier à] LT',
                        sameElse : 'L'
                    },
                    relativeTime : {
                        future : 'dans %s',
                        past : 'il y a %s',
                        s : 'quelques secondes',
                        ss : '%d secondes',
                        m : 'une minute',
                        mm : '%d minutes',
                        h : 'une heure',
                        hh : '%d heures',
                        d : 'un jour',
                        dd : '%d jours',
                        M : 'un mois',
                        MM : '%d mois',
                        y : 'un an',
                        yy : '%d ans'
                    },
                    dayOfMonthOrdinalParse: /\d{1,2}(er|e)/,
                    ordinal : function (number, period) {
                        switch (period) {
                            // Words with masculine grammatical gender: mois, trimestre, jour
                            default:
                            case 'M':
                            case 'Q':
                            case 'D':
                            case 'DDD':
                            case 'd':
                                return number + (number === 1 ? 'er' : 'e');

                            // Words with feminine grammatical gender: semaine
                            case 'w':
                            case 'W':
                                return number + (number === 1 ? 're' : 'e');
                        }
                    }
                });
            }

            moment.locale(configService.getLang());
            const localeData = moment.localeData();

            $mdDateLocale.months = localeData.months();
            $mdDateLocale.shortMonths = moment.monthsShort();
            $mdDateLocale.days = localeData.weekdays();
            $mdDateLocale.shortDays = localeData.weekdaysMin();
            $mdDateLocale.firstDayOfWeek = localeData._week.dow;

            // mark each plugin inactive (unchecked) before loading the new language
            service.controls.plugins.children.forEach(child => {
                child.isActive = false;
            });
        });

        /**
         * Switches the language to the language represented by the sidemenu language control object.
         *
         * @function switchLanguage
         * @param {Object} control sidemenu language control object
         * @private
         */
        function switchLanguage(control) {
            // reload service with the new language and close side panel
            reloadService.loadNewLang(control.value);
            service.close();
        }

        /**
         * Checks if the provided sidemenu language control object represents the currently selected language
         *
         * @function isCurrentLanguage
         * @private
         * @param {Object} control sidemenu language control object
         * @return {Boolean} true is sidemenu language control object represents the currently selected language
         */
        function isCurrentLanguage(control) {
            return control.value === configService.getLang();
        }
    }
}
