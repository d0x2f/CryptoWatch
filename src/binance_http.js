/* exported fetchSymbols */

imports.gi.versions.Soup = '2.4';
const {Soup} = imports.gi;

let symbols;

/**
 * Fetch a list of all symbols from Binance.
 * Symbols are filtered by those that have a USDT pair available.
 * Fetched in a singleton pattern.
 */
function fetchSymbols() {
    if (symbols)
        return symbols;

    const session = new Soup.Session();
    const message = new Soup.Message({
        method: 'GET',
        uri: Soup.URI.new('https://api.binance.com/api/v3/exchangeInfo'),
    });
    session.send_message(message); // TODO: Handle failure
    const response = JSON.parse(message.response_body.data);
    symbols = response.symbols
            .filter(definition => definition.quoteAsset === 'USDT')
            .map(definition => definition.baseAsset);

    return symbols;
}
