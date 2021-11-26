/* exported CurrencyRow */

const {GObject} = imports.gi;

var CurrencyRow = GObject.registerClass(
    {
        GTypeName: 'CurrencyRow',
        Properties: {
            'label': GObject.ParamSpec.string(
                'label',
                'Label',
                'A label representing this unit of currency.',
                GObject.ParamFlags.READWRITE,
                ''
            ),
        },
    },
    class CurrencyRow extends GObject.Object {
        _init(currency) {
            super._init();
            this.currency = currency;
            this.label = currency.symbol;
        }
    }
);
