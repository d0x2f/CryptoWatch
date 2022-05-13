/* exported init, buildPrefsWidget */

const {Gtk, Gio} = imports.gi;
const {initTranslations, getCurrentExtension, getSettings} = imports.misc.extensionUtils;

const App = getCurrentExtension();
const {PortfolioRow} = App.imports.portfolio_row;
const {CurrencyRow} = App.imports.currency_row;
const {fetchAssets, fetchRates} = App.imports.coincap;
const {packPortfolio} = App.imports.utils;

let settings;
let portfolioStore;
let currencyStore;

let assetsPromise; // Supported crypto
let ratePromise; // Supported conversion currencies

/**
 *
 */
function init() {
    initTranslations(App.metadata['gettext-domain']);
}

/**
 * When the portfolio changes in Gio.Settings, reflect those changes in the store.
 *
 * @param {Array} assets Array of available assets
 * @param {Array} rates Array of supported rates
 */
function refreshPortfolio(assets, rates) {
    const portfolio = settings.get_value('portfolio').deep_unpack();
    for (const [index, row] of portfolio.entries()) {
        const item = portfolioStore.get_item(index);
        if (item !== null)
            item.update(row);
        else
            portfolioStore.append(new PortfolioRow(index, row, assets, rates));
    }

    for (let i = portfolio.length; i < portfolioStore.get_n_items(); i++)
        portfolioStore.remove(i);
}

/**
 * Add a new asset row.
 *
 * @param {Array} assets Array of available assets
 */
function addAsset(assets) {
    const portfolio = settings.get_value('portfolio').deep_unpack();
    portfolio.push([Object.keys(assets)[0], 0.0]);
    settings.set_value('portfolio', packPortfolio(portfolio));
}

/**
 *
 */
function showKeyModal() {
    const builder = Gtk.Builder.new_from_file(`${App.path}/ui/key_modal.ui`);
    const window = builder.get_object('window');
    const keyBuffer = builder.get_object('key_buffer');
    const key = settings.get_string('coincap-api-key');
    keyBuffer.set_text(key, key.length);
    builder.get_object('save_button').connect('clicked', () => {
        settings.set_string('coincap-api-key', keyBuffer.get_text());
        window.close();
        window.destroy();
    });
    window.show();
    window.set_modal(true);
}

/**
 * Create the preferences window.
 */
function buildPrefsWidget() {
    settings = getSettings(App.metadata['settings-schema']);

    portfolioStore = new Gio.ListStore();
    currencyStore = new Gio.ListStore();
    assetsPromise = fetchAssets(settings.get_string('coincap-api-key'));
    ratePromise = fetchRates(settings.get_string('coincap-api-key'));

    const builder = Gtk.Builder.new_from_file(`${App.path}/ui/prefs.ui`);

    const refreshIntervalInput = builder.get_object('refresh_interval_input');
    settings.bind(
        'refresh-interval',
        refreshIntervalInput,
        'active_id',
        Gio.SettingsBindFlags.DEFAULT
    );

    const precisionInput = builder.get_object('precision_input');
    settings.bind(
        'precision',
        precisionInput,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );

    const currencyInput = builder.get_object('currency_input');
    currencyInput.connect('notify::selected-item', input => {
        settings.set_string('currency', input.get_selected_item().currency.id);
    });

    const portfolioList = builder.get_object('portfolio_list');
    portfolioList.bind_model(portfolioStore, row => row.buildRow());
    portfolioList.connect('row-activated', (_listBox, rowWidget) => {
        const index = rowWidget.get_index();
        const row = portfolioStore.get_item(index);
        row.activated();
    });

    const setKeyButton = builder.get_object('key_button');
    setKeyButton.connect('clicked', showKeyModal);

    const addAssetButton = builder.get_object('add_asset_button');

    const topBox = builder.get_object('top_box');
    topBox.connect('destroy', () => settings.run_dispose());

    const loadingBox = builder.get_object('loading_box');
    const prefsBox = builder.get_object('prefs_box');

    Promise.all([assetsPromise, ratePromise]).then(([assets, rates]) => {
        settings.connect('changed::portfolio', () => refreshPortfolio(assets, rates));
        addAssetButton.connect('clicked', () => addAsset(assets));

        let selectedCurrency = settings.get_string('currency');
        for (const currency of Object.values(rates))
            currencyStore.append(new CurrencyRow(currency));
        currencyInput.set_model(currencyStore);
        currencyInput.set_selected(Object.keys(rates).indexOf(selectedCurrency));

        refreshPortfolio(assets, rates);

        loadingBox.set_visible(false);
        prefsBox.set_visible(true);
    }).catch(logError);

    return topBox;
}
