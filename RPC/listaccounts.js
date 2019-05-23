'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

exports.queryDaemon = function(coin, headers)
{
    return new Promise(async ok => {
        try {

            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "listaccounts", "params": [] }';
            const res = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
            
            return ok(res.data && res.data.length ? JSON.parse(res.data).result : {"*": 0});
        }
        catch(e) {
            return ok(null);
        }
    });
}
