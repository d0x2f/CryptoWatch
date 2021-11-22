/* exported PortfolioRow */

const {GObject, Gtk, GLib} = imports.gi;
const {gettext: _, getCurrentExtension, getSettings} = imports.misc.extensionUtils;

const CryptoKit = getCurrentExtension();
const {fetchSymbols} = CryptoKit.imports.binance_http;

const settings = getSettings('org.gnome.shell.extensions.cryptokit');
let symbolListStore;

const SYMBOLS = fetchSymbols();

/**
 * Get symbol store singleton.
 */
function getSymbolListStore() {
    return symbolListStore ?? Gtk.StringList.new(SYMBOLS);
}

/**
 * Packs the portfolio array into appropriate GVariants objects for storage in Gio.Settings.
 *
 * @param {Array} portfolio An array of portfolio tuples (symbol, qty)
 */
function packPortfolio(portfolio) {
    let tuples = [];
    for (const [symbol, qty] of portfolio) {
        tuples.push(
            GLib.Variant.new_tuple([
                GLib.Variant.new_string(symbol),
                GLib.Variant.new_double(qty),
            ])
        );
    }
    return GLib.Variant.new_array(GLib.VariantType.new('(sd)'), tuples);
}

var PortfolioRow = GObject.registerClass(
  class PortfolioRow extends GObject.Object {
      _init(index, [symbol, qty]) {
          super._init();
          this.index = index;
          this.symbol = symbol;
          this.qty = qty;
      }

      update([symbol, qty]) {
          this.symbol = symbol;
          this.qty = qty;
      }

      symbolChanged(dropDown) {
          const portfolio = settings.get_value('portfolio').deep_unpack();
          portfolio[this.index][0] = SYMBOLS[dropDown.selected];
          settings.set_value('portfolio', packPortfolio(portfolio));
      }

      qtyChanged(adjustment) {
          const portfolio = settings.get_value('portfolio').deep_unpack();
          portfolio[this.index][1] = adjustment.get_value();
          settings.set_value('portfolio', packPortfolio(portfolio));
      }

      static buildRow(row) {
          return row._buildRow();
      }

      _buildRow() {
          const builder = Gtk.Builder.new_from_file(`${CryptoKit.path}/ui/portfolio_row.ui`);

          const symbolInput = builder.get_object('symbol_input');
          symbolInput.set_model(getSymbolListStore());
          symbolInput.set_selected(SYMBOLS.indexOf(this.symbol));
          symbolInput.connect('notify::selected', this.symbolChanged.bind(this));

          const qtyInput = builder.get_object('qty_input');
          const qtyAdjustment = builder.get_object('qty_adjustment');
          qtyInput.connect('output', this.formatQty.bind(this));
          qtyAdjustment.connect('value-changed', this.qtyChanged.bind(this));
          qtyInput.value = this.qty;

          return builder.get_object('row');
      }

      formatQty(qtyInput) {
          const formatter = new Intl.NumberFormat(
              undefined,
              {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 8,
                  style: 'decimal',
              }
          );

          qtyInput.set_text(
              formatter.format(
                  qtyInput.get_adjustment().get_value()
              )
          );

          return true;
      }
  }
);
