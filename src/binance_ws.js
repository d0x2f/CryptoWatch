const {Soup, GLib} = imports.gi;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;

const CryptoKit = ExtensionUtils.getCurrentExtension();

var BinanceWS = class BinanceWS {
    constructor(symbols, interval) {
        this.latestTicks = {};
        this.symbols = symbols.map(s => s.toLowerCase());
        this.requestIdCounter = 0;
        this.initialised = false;
        this.connectSocket();

        this.configureRefreshInterval(interval);
    }

    destroy() {
        if (this.intervalHandle)
            GLib.source_remove(this.intervalHandle);

        if (this.ws?.get_state() === Soup.WebsocketState.OPEN)
            this.ws.close(0, '');
    }

    connectSocket() {
        if (this.ws?.get_state() === Soup.WebsocketState.OPEN)
            return;

        const session = new Soup.Session();
        const message = new Soup.Message({
            method: 'GET',
            uri: Soup.URI.new('wss://stream.binance.com:9443/ws/ticker'),
        });
        session.websocket_connect_async(
            message,
            CryptoKit.metadata.uuid,
            ['wss'],
            null,
            (_, result) => {
                try {
                    this.ws = session.websocket_connect_finish(result);
                    this.ws.keepalive_interval = 1;

                    this.ws.connect('error', (_self, e) => logError(e));
                    this.ws.connect('closed', this.connectSocket.bind(this));
                    this.ws.connect('message', this.importMessage.bind(this));

                    this.subscribeToStreams();
                } catch (e) {
                    logError(e); // TODO: Handle error
                }
            }
        );
    }

    subscribeToStreams() {
        // TODO: Unsubscribe from previous streams
        const streams = this.symbols.map(symbol => `${symbol}usdt@miniTicker`);

        const requestId = this.requestIdCounter++;
        this.ws.send_text(JSON.stringify({method: 'SUBSCRIBE', params: streams, id: requestId}));
        // TODO: Check for successful response
    }

    setSymbols(symbols) {
        this.symbols = symbols.map(s => s.toLowerCase());
        this.subscribeToStreams();
    }

    parseMessage(message) {
        const data = JSON.parse(new TextDecoder().decode(message.get_data()));
        if (data.e !== '24hrMiniTicker')
            return null;

        const {
            s: symbol,
            c: close,
        } = data;
        return {symbol, close};
    }

    importMessage(_self, _type, message) {
        const tickerData = this.parseMessage(message);
        if (tickerData === null)
            return;
        this.latestTicks[tickerData.symbol] = tickerData;
        this.initialised = true;
    }

    configureRefreshInterval(interval) {
        if (this.intervalHandle) {
            GLib.source_remove(this.intervalHandle);
            this.intervalHandle = 0;
        }

        this.intervalHandle = GLib.timeout_add(GLib.PRIORITY_DEFAULT, parseInt(interval), () => {
            if (this.initialised)
                this.emit('update', this.latestTicks);

            if (this.ws?.get_state() === Soup.WebsocketState.CLOSED)
                this.connectSocket();

            return GLib.SOURCE_CONTINUE;
        });
    }
};

Signals.addSignalMethods(BinanceWS.prototype);
