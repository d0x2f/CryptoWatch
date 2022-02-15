/* exported init */

const {Clutter, GObject, St} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;

const App = ExtensionUtils.getCurrentExtension();
const {CoincapAssetWS, fetchRates} = App.imports.coincap;
const {normaliseCurrencySymbol} = App.imports.utils;
const {USD_RATE} = App.imports.globals;

const Domain = Gettext.domain(App.metadata['gettext-domain']);
const _ = Domain.gettext;

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _(App.metadata.name));

            this.rate = USD_RATE;
            this.updateFormatter();

            this.refreshInterval = 0;
            this.lastUpdate = new Date();

            this.label = new St.Label({
                text: '...',
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this.label);

            let item = new PopupMenu.PopupMenuItem(_('Settings'));
            item.connect('activate', () => ExtensionUtils.openPrefs());
            this.menu.addMenuItem(item);
        }

        setValue(value) {
            this.value = value;
            this.updateLabel();
        }

        setPrecision(precision) {
            this.precision = precision;
            this.updateFormatter();
            this.updateLabel();
        }

        setRate(rate) {
            this.rate = rate;
            this.updateFormatter();
            this.updateLabel();
        }

        setRefreshInterval(refreshInterval) {
            this.refreshInterval = parseInt(refreshInterval, 10);
        }

        updateFormatter() {
            this.formatter = new Intl.NumberFormat(
                undefined,
                {
                    minimumFractionDigits: this.precision,
                    maximumFractionDigits: this.precision,
                    style: 'currency',
                    currency: normaliseCurrencySymbol(this.rate.symbol),
                }
            );
        }

        updateLabel() {
            if (!this.value) {
                this.label.text = '...';
                return;
            }

            const now = new Date();
            if (now - this.lastUpdate > this.refreshInterval) {
                this.label.text = this.formatter.format(this.value / this.rate.rateUsd);
                this.lastUpdate = now;
            }
        }
    }
);

class Extension {
    constructor(uuid) {
        this.uuid = uuid;
        this.portfolio = [];
        ExtensionUtils.initTranslations(App.metadata['gettext-domain']);
    }

    enable() {
        this.indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this.indicator);

        this.settings = ExtensionUtils.getSettings(App.metadata['settings-schema']);
        this.settings.connect('changed::precision', this.refreshPrecision.bind(this));
        this.settings.connect('changed::refresh-interval', this.refreshRefreshInterval.bind(this));
        this.settings.connect('changed::portfolio', this.refreshPortfolio.bind(this));
        this.settings.connect('changed::currency', this.refreshCurrency.bind(this));

        this.refreshRefreshInterval();
        this.refreshPortfolio();
        this.refreshPrecision();
        this.refreshCurrency();

        this.coincap = new CoincapAssetWS(
            this.portfolio.map(([assetId]) => assetId),
            this.settings.get_string('coincap-api-key')
        );
        this.coincap.connect('update', (_self, quotes) => this.calculatePortfolioValue(quotes));
    }

    disable() {
        this.indicator?.destroy();
        this.indicator = null;

        this.settings?.run_dispose();
        this.settings = null;

        this.coincap?.destroy();
        this.coincap = null;
    }

    refreshRefreshInterval() {
        this.indicator?.setRefreshInterval(this.settings.get_string('refresh-interval'));
    }

    refreshPrecision() {
        this.indicator?.setPrecision(this.settings.get_int('precision'));
    }

    refreshPortfolio() {
        this.portfolio = this.settings.get_value('portfolio').deep_unpack();
        const uniqueAssets = Array.from(new Set(this.portfolio.map(([id]) => id)));
        this.coincap?.setAssets(uniqueAssets);
    }

    async refreshCurrency() {
        const currencyId = this.settings.get_string('currency');
        const rates = await fetchRates(this.settings.get_string('coincap-api-key'));
        const rate = rates[currencyId];
        if (rate)
            this.indicator?.setRate(rate);
    }


    calculatePortfolioValue(quotes) {
        if (this.portfolio.length === 0 || Object.values(quotes).includes(null)) {
            this.indicator?.setValue(null);
            return;
        }
        const value = this.portfolio.reduce(
            (acc, [asset, qty]) => acc + (quotes[asset] * qty),
            0.0
        );
        this.indicator?.setValue(value);
    }
}

/**
 * @param {Object} meta Metadata
 */
function init(meta) {
    return new Extension(meta.uuid);
}
