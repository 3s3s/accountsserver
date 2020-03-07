'use strict';
const util = require('util');
const http = require('http');
const https = require('https');
const g_crypto = require('crypto');
const g_constants = require("./constants");

const listtransactions = require("./RPC/listtransactions");
const listaccounts = require("./RPC/listaccounts");
const getaddressesbyaccount = require("./RPC/getaddressesbyaccount");
const setaccount = require("./RPC/setaccount");


const log_file_db = require("fs").createWriteStream(__dirname + '/debug_db.log', {flags : 'w'});
const log_file2 = require("fs").createWriteStream(__dirname + '/debug2.log', {flags : 'w'});

exports.log_db = function(d) {
    log_file_db.write(util.format(d) + '\n');
}

exports.log2 = function(d) {
    log_file2.write(util.format(d) + '\n');
}

exports.Hash = function(str)
{
    return g_crypto.createHash("sha256").update(str).digest('base64');
};

exports.Sleep = function(msec)
{
    return new Promise(ok => {
        setTimeout(ok, msec);
    })
}

let g_offlines = {};
exports.Offline = function(coinName, flag)
{
    g_offlines[coinName] = flag;
}
exports.IsOffline = function(coinName)
{
    return g_offlines[coinName] == true;
}

exports.ForEachSync = function(array, func, cbEndAll, cbEndOne)
{
    if (!array || !array.length)
    {
        console.log('success: ForEachAsync (!array || !array.length)');
        cbEndAll(false);
        return;
    }
    
    Run(0);
    
    function Run(nIndex)
    {
        if (nIndex >= array.length) throw new Error('error: ForEachSync_Run (nIndex >= array.length)');
        func(array, nIndex, onEndOne);
        
        function onEndOne(err, params)
        {
            if (!cbEndOne)
            {
                if (err) return cbEndAll(err);
                
                if (nIndex+1 < array.length && !err)
                    Run(nIndex+1);
                else
                    cbEndAll(false); //if all processed then stop and return from 'ForEachSync'
                return;
            }
            
            if (!params) params = {};
            
            params.nIndex = nIndex;
            
            cbEndOne(err, params, function(error) {
                if (error) {
                    //if func return error, then stop and return from 'ForEachSync'
                    console.log('error: ForEachSync_Run_cbEndOne return error');
                    return cbEndAll(true);
                }
                if (nIndex+1 < array.length)
                    Run(nIndex+1);
                else
                    cbEndAll(false); //if all processed then stop and return from 'ForEachSync'
            });
        }
    }
};

var lastSocketKey = 0;
var socketMap = {};
exports.postString = function(host, port, path, headers, strBody, cd) 
{
    return new Promise((ok, cancel) => {
        
        const callback = cd || ok;

        const options = { 
            hostname: host, 
            port: port.nPort, 
            path: path, 
            method: 'POST', 
            headers: headers
        }; 
        
        if (!port.name)
        {
            var i=0;
        }
        var proto = (port.nPort == 443 || port.name.indexOf('https')==0) ? https : http;
            
        var req = proto.request(options, res => { 
            console.log('Status: ' + res.statusCode); 
            console.log('Headers: ' + JSON.stringify(res.headers)); 
            
            res.setEncoding('utf8'); 
            
    		var res_data = '';
    		res.on('data', chunk => {
    			res_data += chunk;
    		});
    		res.on('end', () => {
    			setTimeout(callback, 10, {'success': 'success', 'data': res_data});
    		});	
        }); 
        
        req.on('socket', socket => {
            socket.setTimeout(30000);  
            socket.on('timeout', function() {
                req.abort();
            });
            
            /* generate a new, unique socket-key */
            const socketKey = ++lastSocketKey;
            /* add socket when it is connected */
            socketMap[socketKey] = socket;
            socket.on('close', () => {
                /* remove socket when it is closed */
                delete socketMap[socketKey];
            });
        });
    
        req.on('error', e => { 
            if (e.code === "ECONNRESET") {
                console.log("Timeout occurs");
            }
            console.log('problem with request: ' + (e.message || "")); 
            setTimeout(callback, 10, {'success': false, message: 'problem with request: ' + (e.message || "")});
        }); 
        
        // write data to request body 
        req.end(strBody);    
        

    })
};

exports.SaveAddresses = function(coin, headers, account)
{
    return new Promise(async ok => {
       /* if (account == "14ae808519f026fdbb31c426b2096a35")
        {
            let i = 0;
        }*/
        const addrs = await getaddressesbyaccount.queryDaemon(coin, headers, account);
        
        if (!addrs || !addrs.length)
            return ok();
        
        for (let i=0; i<addrs.length; i++)    
            await setaccount.toDB(coin.name, account, addrs[i], Date.now());
            
        return ok();
    });
}

exports.SaveAllTransactions = function(coin, headers)
{
    return new Promise(async (ok, cancel) => {
        try
        {
            const accounts = await listaccounts.queryDaemon(coin, headers);
    
            for (let key in accounts)
            {
                if (exports.IsOffline(coin.name)) return cancel(new Error("SaveAllTransactions: CANCEL coin is offlibe " + coin.name));
                    
                console.log('new account for '+coin.name+" key="+key);
                
                await exports.SaveAddresses(coin, headers, key);
            }
    
            await exports.SaveLastTransactions(coin, headers, 20000);
            
            return ok();
        }
        catch(e) {
            return cancel(e);
        }
    });    
}

let g_lastTXs = {};
exports.SaveLastTransactions = function(coin, headers, count=1000)
{
    return new Promise(async (ok, cancel) => {
        try
        {
            console.log('SaveLastTransactions for '+coin.name);
            let txs = await listtransactions.queryDaemon(coin, headers, "*", count);
                
            if (txs) exports.Offline(coin.name, false);
                
            if (!txs) 
            {
                console.log('SaveLastTransactions cancel for '+coin.name);
                return cancel(new Error("SaveLastTransactions: CANCEL coin daemon failed "+coin.name));
            }
                
            if (g_lastTXs[coin.name])
            {
                let filteredTXs = [];
                for (let i=0; i<txs.length; i++)
                {
                    const tx = txs[i];
                    let bFound = false;
                    for(let j=0; j<g_lastTXs[coin.name].length; j++)
                    {
                        if (tx.txid && tx.txid.length > 3 && tx.txid == g_lastTXs[coin.name][j].txid)
                        {
                            bFound = true;
                            break;
                        }
                    }
                    if (!bFound)
                        filteredTXs.push(tx);
                        
                    await exports.Sleep(1);
                }
                txs = filteredTXs;
            }
 
            g_lastTXs[coin.name] = txs;
                
            /*if (txs.length && g_lastTXs[coin.name] == txs[0].txid && g_lastTXs[coin.name+"_"] == txs[txs.length-1].txid)
                return ok();
                
            if (txs.length && txs[0].txid && txs[0].txid.length > 3 && txs[txs.length-1].txid && txs[txs.length-1].txid.length < 3)
            {
                g_lastTXs[coin.name] = txs[0].txid;
                g_lastTXs[coin.name+"_"] == txs[txs.length-1].txid;
            }*/
                
            console.log('FillLast save for '+coin.name+" count="+txs.length);
                
            await exports.SaveTransactions(coin, headers, txs);
                    
            console.log('SAVED for '+coin.name+" count="+txs.length);
            
            return ok();
        }
        catch(e) {
            console.log('SaveLastTransactions cancel for '+coin.name+" FAILED: "+e.message)
            return cancel(e);
        }
    });
}

exports.SaveTransactions = function(coin, headers, txs)
{
    const coinName = coin.name;
    
    return new Promise(async (ok, cancel) => {
            
        let bFirstSkip = true;
        //for (let i=txs.length-1; i>=0; i--)
        for (let i=txs.length-1; i>=0; i--)
        {
            try {
                exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions "+coinName+"; i="+i+"; txs[i].txid="+txs[i].txid)
                if (txs[i].comment)
                {
                    try {
                        const data = JSON.parse(txs[i].comment);
                        if (txs[i].category == 'send' && data[0].from && data[0].from.length > 3)
                            txs[i].account = data[0].from;
                    }
                    catch(e) {}
                }

                const uid = exports.Hash(coinName+(txs[i].time||-1)+txs[i].comment+(txs[i].address||"")+(txs[i].category||"")+(txs[i].amount||"")+(txs[i].vout||"")+(txs[i].txid||""));
                        
                const rows = await g_constants.dbTables["listtransactions"].Select2("*", "uid='"+escape(uid)+"'");
                
                //exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions1 "+coinName+"; i="+i+"; txs[i].txid="+txs[i].txid)
                if (rows.length)
                {
                    let account = rows[0].account == "%20" ? 
                        (txs[i].account && txs[i].account.length > 3 ? txs[i].account : await GetAccount(txs[i].address)) : 
                        rows[0].account;
                            
                    if (txs[i].category == 'send' && txs[i].account && txs[i].account.length)
                        account = txs[i].account;
                    //console.log('SaveTransactions1 coin='+coinName+', account='+txs[i].account);
                    
                    if (txs[i].confirmations && rows[0].confirmations != txs[i].confirmations)
                    {
                        const confirmations = escape(txs[i].confirmations) || 0;
                        
                        console.log("try update confirmations "+coinName+"; uid='"+escape(uid)+"'"+"; account="+account)
                        await g_constants.dbTables["listtransactions"].Update(
                            "confirmations="+confirmations+", account='"+account+"'",
                            "uid='"+escape(uid)+"'"
                        );
                    }
                    if ((rows[0].blocktime == -1 && txs[i].blocktime && txs[i].blocktime != -1) ||
                        (rows[0].account == "%20"))// && txs[i].account && txs[i].account.length))
                    {
                        const otheraccount = txs[i].otheraccount && txs[i].otheraccount.length ? escape(txs[i].otheraccount) : rows[0].otheraccount;
    
                        console.log("try update block "+coinName+"; uid='"+escape(uid)+"'"+"; account="+escape(account))
                        await g_constants.dbTables["listtransactions"].Update(
                            "blockhash='"+escape(txs[i].blockhash)+"', blockindex="+escape(txs[i].blockindex)+", blocktime="+escape(txs[i].blocktime)+
                            ", account='"+escape(account)+"' "+ ", otheraccount='"+otheraccount+"' ",
                            "uid='"+escape(uid)+"'"
                        );
                        
                        //console.log('Update listtransactions for coinName='+coinName+', account='+account+"(txs[i].txid="+txs[i].txid+", txs[i].account="+txs[i].account+")");
                        continue;
                    }
                    if (bFirstSkip) console.log("skip insert for "+coinName+', account='+txs[i].account);
                    bFirstSkip = false;
                    
                    //LogBalance(coinName, txs[i].account);
                    continue;
                }

                //exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions2 "+coinName+"; i="+i+"; txs[i].txid="+txs[i].txid)
                try {
                    const account = txs[i].category == 'send' ? txs[i].account : await GetAccount(txs[i].address);
                    
                    exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + ' SaveTransactions (insert) coin='+coinName+', account='+account+"; amount="+txs[i].amount+"; txid="+txs[i].txid)
                    
                    await g_constants.dbTables["listtransactions"].Insert(
                        coinName,
                        account,
                        txs[i].address||" ",
                        txs[i].category||" ",
                        txs[i].amount||"0",
                        txs[i].label||" ",
                        txs[i].vout||"-1",
                        txs[i].fee||"0",
                        txs[i].confirmations||"0",
                        txs[i].trusted||" ",
                        txs[i].blockhash||" ",
                        txs[i].blockindex||"-1",
                        txs[i].blocktime||"-1",
                        txs[i].txid||" ",
                        txs[i].time||"-1",
                        txs[i].timereceived||"-1",
                        txs[i].comment||" ",
                        txs[i].otheraccount||" ",
                        txs[i].bip125_replaceable||"",
                        txs[i].abandoned||" ",
                        uid
                    );
                }
                catch(err) {
                    exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions (catch error) "+coinName+"; error="+err.message)
                    console.log(err.message+"(SaveTransactions2 coin="+coinName+", account="+txs[i].account+")");
                }
            }
            catch(e) {
                exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions (catch error2) "+coinName+"; error="+e.message)
            }
        }

        ok();
    });
}

function GetAccount(address)
{
    return new Promise((async ok => {
        const rows = await g_constants.dbTables["addresses"].Select2("*", "address='"+escape(address)+"'");

        return rows.length ? ok(unescape(rows[0].account)) : ok(" ");
    }));
}

/*let isLogged = {};
async function LogBalance(coinName, account)
{
    if (isLogged[coinName + account])
        return;
        
    isLogged[coinName + account] = true;
    
    const rowsSkip = await g_constants.dbTables["listtransactions"].Select2("SUM( 1*amount + 1*fee ) AS balance", "coin='"+escape(coinName)+"' AND category<>'move' AND blocktime=-1 AND account='"+account+"' ");
    const rows = await g_constants.dbTables["listtransactions"].Select2("SUM (1*amount + 1*fee) AS balance", "coin='"+escape(coinName)+"' AND account='"+account+"' ");
    
    const skip = rowsSkip && rowsSkip.length ? rowsSkip[0].balance : 0;
    const balance = rows && rows.length ? rows[0].balance : 0;
    
    if (Math.abs(balance*1-skip*1) > 0.000001 && account.indexOf("fae6ce5db2d643014fbe57546c82bc9a") == -1)
        exports.log_db("account="+account+" "+coinName+" balance="+(balance*1-skip*1));
}*/