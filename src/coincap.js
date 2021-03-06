/* exported fetchAssets, fetchRates, CoincapAssetWS */

imports.gi.versions.Soup = '2.4';
const {Soup, GLib} = imports.gi;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;

const App = ExtensionUtils.getCurrentExtension();

const {jsonRequest, setTimeout, _log, byteArrayToString} = App.imports.utils;

let _assets, _rates;

/**
 * Fetch a list of all assets from coincap.
 * Fetched in a singleton pattern.
 *
 * @param {string?} apiKey A coincap api key.
 */
async function fetchAssets(apiKey) {
    if (_assets)
        return _assets;

    const response = await jsonRequest('https://api.coincap.io/v2/assets?limit=2000', apiKey);
    _assets = Object.fromEntries(response.data.sort((a, b) => a.rank >= b.rank).map(a => [a.id, a]));

    return _assets;
}

/**
 * Fetch a list of all assets from coincap.
 * Fetched in a singleton pattern.
 *
 * @param {string?} apiKey A coincap api key.
 */
async function fetchRates(apiKey) {
    if (_rates)
        return _rates;

    const response = await jsonRequest('https://api.coincap.io/v2/rates', apiKey);
    _rates = Object.fromEntries(response.data.sort((a, b) => a.symbol >= b.symbol).map(r => [r.id, r]));

    return _rates;
}

/**
 * @param {Array} needles An array of assets to filter by.
 * @param {Object} haystack A map of assets from the coincap api.
 */
function filterAssets(needles, haystack) {
    return Object.fromEntries(
        Object.entries(haystack)
            .filter(([id]) => needles.includes(id))
            .map(([id, q]) => [id, q.priceUsd])
    );
}

/**
 * An object representing a websocket connection that emits signals whenever there's a price update.
 */
var CoincapAssetWS = class CoincapAssetWS {
    constructor(assets, apiKey) {
        if (assets.length === 0)
            throw new Error('Attempted to create a websocket that watches no assets.');

        this.assets = assets;
        this.latestQuotes = Object.fromEntries(this.assets.map(a => [a, null]));
        this.reconnectTimeoutHandle = null;
        this.destroyed = false;

        fetchAssets(apiKey).then(quotes => {
            this.latestQuotes = filterAssets(assets, quotes);
            this.emit('update', this.latestQuotes);
        });

        this.reconnectSocket();
    }

    clearTimeouts() {
        if (this.reconnectTimeoutHandle) {
            GLib.Source.remove(this.reconnectTimeoutHandle);
            this.reconnectTimeoutHandle = null;
        }
    }

    reconnectSocket() {
        _log(`Connecting socket to watch assets: ${this.assets.join(',')}`);

        if (this.ws?.get_state() === Soup.WebsocketState.OPEN)
            this.ws.close(Soup.WebsocketCloseCode.NORMAL, '');

        const session = new Soup.Session();
        const message = new Soup.Message({
            method: 'GET',
            uri: Soup.URI.new(`wss://ws.coincap.io/prices?assets=${this.assets.join(',')}`),
        });
        session.websocket_connect_async(
            message,
            App.metadata.uuid,
            ['wss'],
            null,
            (_, result) => {
                try {
                    this.ws = session.websocket_connect_finish(result);
                    this.ws.keepalive_interval = 1;

                    this.ws.connect('error', (_self, e) => logError(e));
                    this.ws.connect('closed', this.handleDisconnect.bind(this));
                    this.ws.connect('message', this.processMessage.bind(this));
                } catch (e) {
                    logError(e);
                }
            }
        );
    }

    /**
     *  Wait 5 seconds, if the socket is still closed, then try to reconnect.
     */
    handleDisconnect() {
        // Don't reconnect if the object has been destroyed.
        if (this.destroyed)
            return;

        _log('Socket disconnected, waiting 5 seconds before retrying socket.');

        // Clear any previous timeouts
        this.clearTimeouts();

        this.reconnectTimeoutHandle = setTimeout(
            () => {
                if (this.ws?.get_state() === Soup.WebsocketState.OPEN) {
                    _log('Socket connected, no need to reconnect.');
                    return;
                }

                this.reconnectSocket();
            },
            5000
        );
    }

    destroy() {
        this.destroyed = true;

        this.clearTimeouts();

        if (this.ws?.get_state() === Soup.WebsocketState.OPEN)
            this.ws.close(Soup.WebsocketCloseCode.NORMAL, '');

        this.ws = null;
    }

    processMessage(_self, _type, message) {
        const data = JSON.parse(byteArrayToString(message.get_data()));
        Object.assign(this.latestQuotes, data);
        this.emit('update', this.latestQuotes);
    }

    setAssets(assets, apiKey = null) {
        this.assets = assets;
        fetchAssets(apiKey).then(quotes => {
            this.latestQuotes = Object.assign(
                filterAssets(assets, quotes),
                this.latestQuotes
            );
        });
        this.reconnectSocket();
    }
};

Signals.addSignalMethods(CoincapAssetWS.prototype);
