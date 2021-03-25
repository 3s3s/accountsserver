'use strict';
const utils = require("../utils");
const getreceivedbyaddress = require("./getreceivedbyaddress");
const g_constants = require("../constants");

exports.Run = async function(coin, headers, post_data, res)
{
    const newAddress = await exports.queryDaemon(coin, headers);
    
    res.end(newAddress || "");
}

exports.queryDaemon = function(coin, headers)
{
    return new Promise(async ok => {
        try {
            utils.log2("getnewaddress "+coin.name+"..."+coin.hostname+":"+coin.port)
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "getnewaddress", "params": [] }';
            const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
            
            utils.log2("getnewaddress result: "+JSON.stringify(result));
            if (result.success == false)
            {
                return ok(null);
            }
                
            const newAddress = result.data && result.data.result ? result.data.result : JSON.parse(result.data).result;
            
            utils.log2("New address = "+newAddress)
            
            const received = await getreceivedbyaddress.queryDaemon(coin, headers, newAddress);
            
            utils.log2("received = "+JSON.stringify(received))

            if (received*1 != 0)
                return ok("");

            const rows = await g_constants.dbTables["addresses"].Select2("*", "coin='"+escape(coin.name)+"' AND address='"+escape(newAddress)+"'");
            
            if (rows && rows.length)
                return ok("");

            return ok(newAddress);
        }
        catch(e) {
            utils.log2("getnewaddress "+coin.name+" catch error "+e.message)
            return ok(null)
        }
    });
}