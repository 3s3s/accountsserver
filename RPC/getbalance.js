'use strict';
const utils = require("../utils");
const g_constants = require("../constants");

let g_Cache = {};
exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));

    //utils.log2(coin.name + "  getbalance 0")
    try
    {
        const data = JSON.parse(post_data);

        const account = data.params && data.params.length ? data.params[0] : "*";
        const minconf = data.params && data.params.length > 1 ? data.params[1] : "0";
        
        const disableCache = data.params && data.params.length > 2 ? data.params[2]*1 : 0;
        
        const strCache = JSON.stringify([coin.name, account, minconf]);
        if (disableCache == 0 && g_Cache[strCache] && g_Cache[strCache].time && Date.now() - g_Cache[strCache].time < 60000)
            return res.end(g_Cache[strCache].data);
        
        //console.log(coin.name+ "  getbalance 1")
        
        //utils.log2("getbalance "+coin.name+" "+account+" "+minconf)
        
        let balance = await exports.GetAccountBalance(coin, account, minconf, headers);

        //utils.log2(coin.name + "  getbalance 2: account="+account+"; balance="+balance)
        if (Math.abs(balance) < 0.0000001)
            balance = "0";

        g_Cache[strCache] = {time: Date.now(), data: JSON.stringify({result: balance, error: null})};
        return res.end(g_Cache[strCache].data);
    }
    catch(e)
    {
        utils.log2("getbalance catched: "+coin.name + "  getbalance error: "+e.message)
        //utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        //   console.log(result.data || "");
            res.end(JSON.stringify({result: 0, error: "  getbalance error: "+e.message}));
        //});
    }

}

exports.GetAccountBalance = function (coin, account, minconf = 0, headers = "")
{
    return new Promise(async ok => {
        
        const coinName = coin.name;
        
        if (account == "" || account == "*")
        {
            //const rows = await g_constants.dbTables["listtransactions"].Select2("SUM(1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND category<>'move' AND blocktime<>-1 AND fee<=0 AND confirmations>="+minconf);
            //return ok(rows && rows.length ? rows[0].balance : 0);
            return ok(await exports.queryDaemon(coin, account, headers, minconf));
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
            
            const ret = rows && rows.length ? 1*rows[0].balance + (1*moved+1*uSend-1*realSkip) : 0;
            
            //utils.log2("GetAccountBalance (minconf>0) ret="+ret+"; account="+account+"); realSkip="+realSkip+"; moved="+moved+"; uSend="+uSend+"; rows="+JSON.stringify(rows));

            return ok(ret);
        }
        
        if (minconf == 0)
        {
            //utils.log2("GetAccountBalance (minconf=0) account="+account+"; rows="+JSON.stringify(rows));
            //utils.log2("SUM ( 1*amount + 1*fee ) AS balance" + " WHERE coin='"+escape(coinName)+"' AND account='"+escape(account)+"' AND confirmations>="+minconf)
            return ok(rows && rows.length ? 1*rows[0].balance : 0);
        }


        //return ok(rows && rows.length ? 1*rows[0].balance - 1*realSkip : 0);
        //return ok(rows && rows.length ? 1*rows[0].balance : 0);

    });
}

let g_CachedDaemonBalance = {};

exports.queryDaemon = function(coin, account, headers, minconf = 0)
{
    return new Promise(async ok => {
        try {
            
            if (!g_CachedDaemonBalance[coin.hostname+coin.port])
                g_CachedDaemonBalance[coin.hostname+coin.port] = {};
            
            if (g_CachedDaemonBalance[coin.hostname+coin.port].balance && 
                g_CachedDaemonBalance[coin.hostname+coin.port].balance*1 >= 0 &&
                g_CachedDaemonBalance[coin.hostname+coin.port].time &&
                g_CachedDaemonBalance[coin.hostname+coin.port].time*1 > Date.now()-1000*60)
            {
                return ok(g_CachedDaemonBalance[coin.hostname+coin.port].balance);
            }
            
            if (g_CachedDaemonBalance[coin.hostname+coin.port].time)
                g_CachedDaemonBalance[coin.hostname+coin.port].time = Date.now();
                
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "getbalance", "params": ["*", '+minconf*1+'] }';
            const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
            
            utils.log2("getbalance "+coin.name+" result: "+JSON.stringify(result));
            if (result.success == false || !result.data)
                return ok(-1);
                
            const data = JSON.parse(result.data);
                
            g_CachedDaemonBalance[coin.hostname+coin.port] = {balance: data.result, time: Date.now()};
                
            return ok(data.result);
        }
        catch(e) {
            utils.log2("getbalance catch error: "+e.message);
            return ok(-3)
        }
    });
}