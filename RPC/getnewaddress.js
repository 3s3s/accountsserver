'use strict';
const utils = require("../utils");

exports.Run = function(coin, headers, post_data, res)
{
    utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log(result.data);
        
        res.end(result.data || "");
    });
}

exports.queryDaemon = function(coin, headers)
{
    return new Promise(async ok => {
        try {
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "getnewaddress", "params": [] }';
            const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
            
            if (result.success == false)
                return ok(null);
            
            return ok(result.data && result.data.result ? result.data.result : JSON.parse(result.data).result);
        }
        catch(e) {
            return ok(null)
        }
    });
}