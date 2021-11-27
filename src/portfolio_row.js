/* exported PortfolioRow */

const {GObject, Gtk} = imports.gi;
const {getCurrentExtension, getSettings} = imports.misc.extensionUtils;

const App = getCurrentExtension();
const {normaliseCurrencySymbol} = App.imports.utils;
const {USD_RATE} = App.imports.globals;
const {buildModifyAssetModal} = App.imports.modify_asset_modal;

var PortfolioRow = GObject.registerClass(
  class PortfolioRow extends GObject.Object {
      _init(index, [id, qty], assets, rates) {
          super._init();
          this.index = index;
          this.id = id;
          this.qty = qty;

          this.assets = assets;
          this.asset = this.assets[this.id];

          this.settings = getSettings(App.metadata['settings-schema']);

          const currencyId = this.settings.get_string('currency');
          this.rates = rates;
          this.rate = this.rates[currencyId];

          this.qtyFormatter = new Intl.NumberFormat(
              undefined,
              {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 8,
                  style: 'decimal',
              }
          );
      }

      activated() {
          buildModifyAssetModal(this, this.assets);
      }

      update([id, qty]) {
          this.id = id;
          this.qty = qty;
          this.asset = this.assets[this.id];
          this.populateLabels();
      }

      buildRow() {
          this.builder = Gtk.Builder.new_from_file(`${App.path}/ui/portfolio_row.ui`);
          this.settings.connect('changed::currency', this.populateLabels.bind(this));
          this.populateLabels();
          return this.builder.get_object('row');
      }

      populateLabels() {
          if (!this.builder)
              return;

          const currencyId = this.settings.get_string('currency');
          const rate = this.rates[currencyId] ?? USD_RATE;
          const currencyFormatter = new Intl.NumberFormat(
              undefined,
              {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                  style: 'currency',
                  currency: normaliseCurrencySymbol(rate.symbol),
              }
          );
          const conversionRate = rate.rateUsd;

          this.builder.get_object('asset_label').set_label(this.asset.name);
          this.builder.get_object('symbol_label').set_label(this.asset.symbol);

          this.builder.get_object('price_label').set_label(
              currencyFormatter.format(parseFloat(this.asset.priceUsd) / conversionRate)
          );

          this.builder.get_object('holding_value_label').set_label(
              currencyFormatter.format(this.qty * parseFloat(this.asset.priceUsd) / conversionRate)
          );

          this.builder.get_object('qty_label').set_label(this.qtyFormatter.format(this.qty));
      }
  }
);
