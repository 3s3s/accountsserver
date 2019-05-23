'use strict';
const utils = require("../utils");
const g_constants = require("../constants");
const handler = require("../reqHandler");

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));
        
    try
    {
        const data = JSON.parse(post_data);
        const account = data.params && data.params.length ? " AND account='"+escape(data.params[0])+"' " : "";
        const limit = data.params && data.params.length && data.params[1] ? escape(data.params[1]) : 10000;
        
        const rows = await g_constants.dbTables["listtransactions"].Select2("*", "coin='"+escape(coin.name)+"' "+account, "ORDER BY 1*time DESC LIMIT "+limit);

        return res.end(JSON.stringify({result: rows, error: null}));
    }
    catch(e)
    {
        utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
            //console.log(result.data);
            res.end(result.data || "");
        });
    }
}

exports.queryDaemon = function(coin, headers, key, count = 1000)
{
    return new Promise(async ok => {
        try {
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "listtransactions", "params": ["'+key+'",  '+count+', 0] }';
            const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
            
            if (result.success == false)
                return ok(null);
            
            return ok(result.data && result.data.result ? result.data.result : JSON.parse(result.data).result);
        }
        catch(e) {
            return ok(null);
        }
    });
}
