/* exported init, buildPrefsWidget */

const {Gtk, Gio} = imports.gi;
const {gettext: _, initTranslations, getCurrentExtension, getSettings} = imports.misc.extensionUtils;

const CryptoKit = getCurrentExtension();
const {PortfolioRow} = CryptoKit.imports.portfolio_row;

const GETTEXT_DOMAIN = 'cryptokit';

const settings = getSettings('org.gnome.shell.extensions.cryptokit');
const portfolioStore = new Gio.ListStore();

/**
 *
 */
function init() {
    initTranslations(GETTEXT_DOMAIN);
}

/**
 * When the portfolio changes in Gio.Settings, reflect those changes in the store.
 */
function refreshPortfolio() {
    const portfolio = settings.get_value('portfolio').deep_unpack();
    for (const [index, row] of portfolio.entries()) {
        const item = portfolioStore.get_item(index);
        if (item !== null)
            item.update(row);
        else
            portfolioStore.append(new PortfolioRow(index, row));
    }
}

/**
 * Create the preferences window.
 */
function buildPrefsWidget() {
    settings.connect('changed::portfolio', refreshPortfolio);

    const builder = Gtk.Builder.new_from_file(`${CryptoKit.path}/ui/prefs.ui`);

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

    const portfolioList = builder.get_object('portfolio_list');
    portfolioList.bind_model(portfolioStore, PortfolioRow.buildRow);
    refreshPortfolio();

    const window = builder.get_object('window');
    window.connect('destroy', () => settings.run_dispose());
    return window;
}
