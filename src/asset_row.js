/* exported AssetRow */

const {GObject} = imports.gi;

var AssetRow = GObject.registerClass(
    {
        GTypeName: 'AssetRow',
        Properties: {
            'label': GObject.ParamSpec.string(
                'label',
                'Label',
                'A label representing this asset.',
                GObject.ParamFlags.READWRITE,
                ''
            ),
        },
    },
    class AssetRow extends GObject.Object {
        _init(asset) {
            super._init();
            this.asset = asset;
            this.label = `${asset.symbol} - ${asset.name}`;
        }
    }
);
