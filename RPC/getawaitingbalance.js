'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));

    try
    {
        const data = JSON.parse(post_data);

        const account = data.params && data.params.length ? data.params[0] : "*";
        const minconf = data.params && data.params.length > 1 ? data.params[1] : "0";
        let balance = await exports.GetAwaitingBalance(coin.name, account, minconf);

        if (Math.abs(balance) < 0.0000001)
            balance = "0";

        return res.end(JSON.stringify({result: balance, error: null}));
    }
    catch(e)
    {
        return res.end(JSON.stringify({result: "0", error: e}));
    }

}

exports.GetAwaitingBalance = function (coinName, account, minconf = 0)
{
    return new Promise(async ok => {
        
        const rows = await g_constants.dbTables["listtransactions"].Select2("SUM ( 1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND account='"+escape(account)+"' AND category='receive' AND confirmations<="+minconf);
        
        return ok(rows && rows.length ? 1*rows[0].balance : 0);

    });
}

