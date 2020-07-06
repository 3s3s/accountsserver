'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));

    console.log(coin.name + "  fixbalance 0")
    try
    {
        const data = JSON.parse(post_data);

        const account = data.params && data.params.length ? data.params[0] : "*";

        let balance = await exports.GetAccountBalance(coin.name, account, 0);

        console.log(coin.name + "  fixbalance 2: account="+account+"; balance="+balance)
        if (balance > 0.0)
            return res.end(JSON.stringify({result: "no need fix balance "+balance, error: null}));

        await g_constants.dbTables["listtransactions"].Insert(
            coin.name,
            account,
            " ",
            " ",
            -1*balance,
            " ",
            "-1",
            "0",
            "10",
            " ",
            " ",
            "1",
            "1",
            " ",
            Date.now(),
            Date.now(),
            "admin fix balance",
            " ",
            " ",
            " ",
            utils.Hash(Date.now()+"-"+Math.random())
        );
        
        balance = await exports.GetAccountBalance(coin.name, account, 0);
        //g_Cache[strCache] = {time: Date.now(), data: JSON.stringify({result: balance, error: null})};
        return res.end(JSON.stringify({result: "new balance = "+balance, error: null}));
    }
    catch(e)
    {
        return res.end(JSON.stringify({result: e.message, error: false}));
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

            return ok(ret);
        }
        
        if (minconf == 0)
            return ok(rows && rows.length ? 1*rows[0].balance : 0);


        //return ok(rows && rows.length ? 1*rows[0].balance - 1*realSkip : 0);
        //return ok(rows && rows.length ? 1*rows[0].balance : 0);

    });
}

