/* exported packPortfolio, setTimeout, sleep, jsonRequest, normaliseCurrencySymbol, _log, byteArrayToString */

imports.gi.versions.Soup = '2.4';
const {GLib, Soup} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const byteArray = imports.byteArray;

const App = ExtensionUtils.getCurrentExtension();

/**
 * @param {string} message The message to log.
 */
function _log(message) {
    log(`${App.metadata.name}: ${message}`);
}

/**
 * Takes a string and trims/pads it to 3 characters.
 * This is used to prepare a symbol for use with Intl.NumberFormat.
 *
 * @param {string} symbol A currency symbol to normalise.
 */
function normaliseCurrencySymbol(symbol) {
    return symbol.substr(0, 3).padEnd(3, 'X');
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

/**
 * @param {Closure} func Function to run.
 * @param {number} delay Time in milliseconds to wait before running the function.
 * @param {...any} args Arguments to pass to the function.
 */
function setTimeout(func, delay, ...args) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        func(...args);
        return GLib.SOURCE_REMOVE;
    });
}

/**
 * @param {number} ms Time to sleep for.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


class HttpError extends Error {
    constructor(message, httpMessage) {
        super(message);
        this.httpMessage = httpMessage;
    }
}

/**
 * @param {string} url Url to request.
 * @param {string} bearerToken A bearer token.
 */
async function jsonRequest(url, bearerToken) {
    try {
        const session = new Soup.Session();
        const message = new Soup.Message({
            method: 'GET',
            uri: Soup.URI.new(url),
        });

        if (bearerToken && bearerToken !== '')
            message['request-headers'].append('Authorization', `bearer ${bearerToken}`);

        do {
            session.send_message(message);
            if (message.status_code === 429) {
                _log('rate limited, sleeping 5s');
                await sleep(5000);
            }
        } while (message.status_code === 429);

        if (message.status_code !== 200)
            throw new HttpError('Request failed', message);

        return JSON.parse(message.response_body.data);
    } catch (err) {
        logError(err);
    }
}

/**
 * Converts a byte array into a string.
 *
 * @param {Array} array A byte array
 */
function byteArrayToString(array) {
    // Only available in gnome-shell 41+
    if (TextDecoder)
        return new TextDecoder().decode(array);

    return byteArray.toString(array);
}
