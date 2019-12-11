'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

let g_Cache = {};
exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));

    try
    {
        const data = JSON.parse(post_data);

        const account = data.params && data.params.length ? data.params[0] : "*";
        const minconf = data.params && data.params.length > 1 ? data.params[1] : "0";
        
        const disableCache = data.params && data.params.length > 2 ? data.params[2]*1 : 0;
        
        const strCache = JSON.stringify([coin.name, account, minconf]);
        if (disableCache == 0 && g_Cache[strCache] && g_Cache[strCache].time && Date.now() - g_Cache[strCache].time < 60000)
            return res.end(g_Cache[strCache].data);
        
        let balance = await exports.GetAccountBalance(coin.name, account, minconf);

        if (Math.abs(balance) < 0.0000001)
            balance = "0";

        g_Cache[strCache] = {time: Date.now(), data: JSON.stringify({result: balance, error: null})};
         return res.end(g_Cache[strCache].data);
    }
    catch(e)
    {
        utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
            //console.log(result.data);
            res.end(result.data || "");
        });
    }

}

exports.GetAccountBalance = function (coinName, account, minconf = 0)
{
    return new Promise(async ok => {
        if (account == "" || account == "*")
        {
            const rows = await g_constants.dbTables["listtransactions"].Select2("SUM(1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND category<>'move' AND blocktime<>-1 AND fee<=0 AND confirmations>="+minconf);
            return ok(rows && rows.length ? rows[0].balance : 0);
        }

        const rows = await g_constants.dbTables["listtransactions"].Select2("SUM ( 1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND account='"+escape(account)+"' AND confirmations>="+minconf);
        
        if (minconf > 0)
        {
            const rowsSkip = await g_constants.dbTables["listtransactions"].Select2("SUM( 1*amount + 1*fee) AS balance", "coin='"+escape(coinName)+"' AND category<>'move' AND blocktime=-1 AND account='"+escape(account)+"'");
            const skip = rowsSkip && rowsSkip.length ? rowsSkip[0].balance : 0;
            const realSkip = skip > 0 ? skip : 0;
            
            const rowsMove = await g_constants.dbTables["listtransactions"].Select2("SUM ( 1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND account='"+escape(account)+"' AND category='move'");
            const moved = rowsMove && rowsMove.length ? rowsMove[0].balance : 0;
            
            const unconfirmedSend = await g_constants.dbTables["listtransactions"].Select2("SUM ( 1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND account='"+escape(account)+"' AND category='send' AND confirmations<"+minconf);
            const uSend = unconfirmedSend && unconfirmedSend.length ? unconfirmedSend[0].balance : 0;
            
            const ret = rows && rows.length ? 1*rows[0].balance + (1*moved+1*uSend-1*realSkip): 0;
            if (coinName == "Marycoin" && account == "3b0a5347a1ad24e1a75fe7ce2c7906f4" && skip < 0)
            {
                let r = 0;
            }

            return ok(ret);
        }
        

        //return ok(rows && rows.length ? 1*rows[0].balance - 1*realSkip : 0);
        return ok(rows && rows.length ? 1*rows[0].balance : 0);

    });
}

