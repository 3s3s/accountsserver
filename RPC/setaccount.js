'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

exports.Run = function(coin, headers, post_data, res)
{
    utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log(result.data);
        res.end(result.data || "");
    });
}

exports.toDB = function(coinName, account, address, time)
{
    return new Promise(async ok => {
        try {
            await g_constants.dbTables["addresses"].Insert(
                coinName,
                account,
                address,
                time,
                utils.Hash(coinName+account+address),
                JSON.stringify({})
            );
        }
        catch(e){
            console.log(e.message)
        }
        ok();
    })
}

