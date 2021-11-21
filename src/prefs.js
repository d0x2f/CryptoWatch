const {GObject, Gtk, Gio, GLib} = imports.gi;
const {gettext: _, initTranslations, getCurrentExtension, getSettings} = imports.misc.extensionUtils;

const CryptoKit = getCurrentExtension();
const {BinanceHTTP} = CryptoKit.imports.binance_http;

const GETTEXT_DOMAIN = 'cryptokit';

let symbolListStore, symbolListItemFactory;

/**
 * Get symbol store singleton.
 */
function getSymbolListStore() {
    if (symbolListStore)
        return symbolListStore;

    const symbols = BinanceHTTP.fetchSymbols();
    symbolListStore = Gtk.StringList.new(symbols);
    return symbolListStore;
}

/**
 *  Get symbol list item factory singleton.
 */
function getSymbolListItemFactory() {
    if (symbolListItemFactory)
        return symbolListItemFactory;

    let uiXml = GLib.file_get_contents(`${CryptoKit.path}/ui/symbol_list_item.ui`)[1];
    symbolListItemFactory = Gtk.BuilderListItemFactory.new_from_bytes(null, uiXml);
    return symbolListItemFactory;
}

const PortfolioListRow = GObject.registerClass(
    class PortfolioListRow extends GObject.Object {
        _init([symbol, qty]) {
            super._init();

            this.symbol = symbol;
            this.qty = qty;

            // this.settings = getSettings('org.gnome.shell.extensions.cryptokit');
        }

        static buildRow(row) {
            return row._buildRow();
        }

        _buildRow() {
            const builder = Gtk.Builder.new_from_file(`${CryptoKit.path}/ui/asset_row.ui`);

            const assetInput = builder.get_object('asset_input');
            // assetInput.set_factory(getSymbolListItemFactory());
            assetInput.set_model(getSymbolListStore());

            this.qtyInput = builder.get_object('qty_input');
            this.qtyAdjustment = builder.get_object('qty_adjustment');
            this.qtyInput.connect('output', this.formatQty.bind(this));
            this.qtyInput.value = this.qty;

            return builder.get_object('row');
        }

        formatQty() {
            const formatter = new Intl.NumberFormat(
                undefined,
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 8,
                    style: 'decimal',
                }
            );

            const value = this.qtyAdjustment.get_value();
            this.qtyInput.set_text(formatter.format(value));

            return true;
        }
    }
);

const Preferences = GObject.registerClass(
    class Preferences extends Gtk.ScrolledWindow {
        _init() {
            super._init();

            this.settings = getSettings('org.gnome.shell.extensions.cryptokit');
            this.settings.connect('changed::portfolio', this.refreshPortfolio.bind(this));

            const builder = Gtk.Builder.new_from_file(`${CryptoKit.path}/ui/prefs.ui`);

            this.set_child(builder.get_object('topbox'));

            const refreshIntervalInput = builder.get_object('refresh_interval_input');
            this.settings.bind(
                'refresh-interval',
                refreshIntervalInput,
                'active_id',
                Gio.SettingsBindFlags.DEFAULT
            );

            const precisionInput = builder.get_object('precision_input');
            this.settings.bind(
                'precision',
                precisionInput,
                'value',
                Gio.SettingsBindFlags.DEFAULT
            );

            const portfolioList = builder.get_object('portfolio_list');
            this.portfolioStore = new Gio.ListStore();
            portfolioList.bind_model(this.portfolioStore, PortfolioListRow.buildRow);
            this.refreshPortfolio();

            this.connect('destroy', () => this._settings.run_dispose());
        }

        refreshPortfolio() {
            const portfolio = this.settings.get_value('portfolio')
                .deep_unpack()
                .map(asset => new PortfolioListRow(asset));
            this.portfolioStore.remove_all();
            portfolio.map(row => this.portfolioStore.append(row));
        }
    }
);


/**
 *
 */
function init() {
    initTranslations(GETTEXT_DOMAIN);
}

/**
 *
 */
function buildPrefsWidget() {
    return new Preferences();
}
