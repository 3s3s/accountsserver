'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

exports.Run = async function(coin, headers, post_data, res)
{
    /*utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log(result.data);
        
        res.end(result.data || "");
    });*/
    
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));

    try
    {
        const data = JSON.parse(post_data);
        const account = data.params && data.params.length ? " AND account='"+escape(data.params[0])+"' " : " ";
        
        let balance = 0;
        if (account == " " || data.params[0] == "*")
        {
            const rows = await g_constants.dbTables["listtransactions"].Select2("SUM(1*amount + 1*fee ) AS balance", "coin='"+escape(coin.name)+"' AND category<>'move' AND blocktime<>-1");
            balance = rows && rows.length ? rows[0].balance : 0;
        }
        else
        {
            const rowsSkip = await g_constants.dbTables["listtransactions"].Select2("SUM( 1*amount + 1*fee) AS balance", "coin='"+escape(coin.name)+"' AND category<>'move' AND blocktime=-1 "+account);
            const rows = await g_constants.dbTables["listtransactions"].Select2("SUM ( 1*amount + 1*fee ) AS balance", "coin='"+escape(coin.name)+"' "+account);
            
            const skip = rowsSkip && rowsSkip.length ? rowsSkip[0].balance : 0;
            balance = rows && rows.length ? 1*rows[0].balance - 1*skip : 0;
        }
            
            
        if (Math.abs(balance) < 0.0000001)
            balance = "0";
        else
        {
            var i = 0;
        }
            
        return res.end(JSON.stringify({result: balance, error: null}));
    }
    catch(e)
    {
        utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
            //console.log(result.data);
            res.end(result.data || "");
        });
    }

}

