'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

let g_Cache = {};
exports.Run = async function(coin, headers, post_data, res)
{
    try
    {
        const data = JSON.parse(post_data);

        const account = data.params && data.params.length ? data.params[0] : "*";
        const minconf = data.params && data.params.length > 1 ? data.params[1] : "0";
        
        const disableCache = data.params && data.params.length > 2 ? data.params[2]*1 : 0;
        
        const strCache = JSON.stringify([coin.name, account, minconf]);
        if (disableCache == 0 && g_Cache[strCache] && g_Cache[strCache].time && Date.now() - g_Cache[strCache].time < 60000)
            return res.end(g_Cache[strCache].data);
        
        let balance = await exports.GetReceivedtBalance(coin.name, account, minconf);

        console.log(coin.name + "  getreceived: account="+account+"; balance="+balance)
        if (Math.abs(balance) < 0.0000001)
            balance = "0";

        g_Cache[strCache] = {time: Date.now(), data: JSON.stringify({result: balance, error: null})};
        return res.end(g_Cache[strCache].data);
    }
    catch(e)
    {
        console.log(coin.name + "  getreceived error: "+e.message)
        //utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        //   console.log(result.data || "");
            res.end(JSON.stringify({result: 0, error: "  getreceived error: "+e.message}));
        //});
    }

}

exports.GetReceivedBalance = function (coinName, account, minconf = 0)
{
    return new Promise(async ok => {
        if (account == "")
            account == "*";

        const rows = await g_constants.dbTables["listtransactions"].Select2("SUM(1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND category='receive' AND blocktime<>-1 AND confirmations>="+minconf);
        return ok(rows && rows.length ? rows[0].balance : 0);
    });
}

