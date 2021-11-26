/* exported buildModifyAssetModal */

const {Gtk, Gio} = imports.gi;
const {getCurrentExtension, getSettings} = imports.misc.extensionUtils;

const App = getCurrentExtension();
const {packPortfolio} = App.imports.utils;
const {AssetRow} = App.imports.asset_row;

/**
 * @param {PortfolioRow} row The asset row being modified.
 * @param {Array} assets Array of supported assets.
 */
function buildModifyAssetModal(row, assets) {
    const settings = getSettings(App.metadata['settings-schema']);
    const builder = Gtk.Builder.new_from_file(`${App.path}/ui/asset_modal.ui`);

    const window = builder.get_object('window');

    const assetInput = builder.get_object('asset_input');
    const assetStore = new Gio.ListStore();
    for (const asset of Object.values(assets))
        assetStore.append(new AssetRow(asset));
    assetInput.set_model(assetStore);
    assetInput.set_selected(Object.keys(assets).indexOf(row.asset.id));

    const qtyInput = builder.get_object('qty_input');
    qtyInput.set_value(row.qty);

    const removeButton = builder.get_object('remove_button');
    removeButton.connect('clicked', () => {
        const portfolio = settings.get_value('portfolio').deep_unpack();
        portfolio.splice(row.index, 1);
        settings.set_value('portfolio', packPortfolio(portfolio));
        window.close();
        window.destroy();
    });

    const saveButton = builder.get_object('save_button');
    saveButton.connect('clicked', () => {
        const portfolio = settings.get_value('portfolio').deep_unpack();
        const selectedRow = assetInput.get_selected_item();
        portfolio[row.index][0] = selectedRow.asset.id;
        portfolio[row.index][1] = qtyInput.get_value();
        settings.set_value('portfolio', packPortfolio(portfolio));
        window.close();
        window.destroy();
    });

    window.show();
}
