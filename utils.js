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
    log_file_db.write((new Date()).toUTCString()+"  "+util.format(d) + '\n');
}

exports.log2 = function(d) {
    log_file2.write((new Date()).toUTCString()+"  "+util.format(d) + '\n');
}

Array.prototype.unique = function() {
    var a = this.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
};

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
            
            /*if (port.nPort == 34451)
            {
                exports.log2('headers: ' + JSON.stringify(headers))
                exports.log2('strBody: ' + strBody)
                exports.log2('Status: ' + res.statusCode)
                exports.log2('Headers: ' + JSON.stringify(res.headers))
            }*/
            
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

/*exports.SaveAddresses = function(coin, headers, account)
{
    return new Promise(async ok => {
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
}*/

let g_lastTXs = {};
exports.SaveLastTransactions = function(coin, headers, count=100)
{
    return new Promise(async (ok, cancel) => {
        try
        {
            exports.log2('start SaveLastTransactions for '+coin.name);
            let txs = await listtransactions.queryDaemon(coin, headers, "*", count);
                
            if (txs) exports.Offline(coin.name, false);
                
            if (!txs) 
            {
                exports.log2('SaveLastTransactions cancel for '+coin.name);
                return cancel(new Error("SaveLastTransactions: CANCEL coin daemon failed "+coin.name));
            }
                
            if (g_lastTXs[coin.name])
            {
                //console.log("g_lastTXs["+coin.name+"] = true; txs.length="+txs.length+"g_lastTXs[coin.name].length="+g_lastTXs[coin.name].length)
                let filteredTXs = [];
                for (let i=0; i<txs.length; i++)
                {
                    const tx = txs[i];
                    let bFound = false;
                    for(let j=0; j<g_lastTXs[coin.name].length; j++)
                    {
                        //console.log("TMP "+coin.name+": tx.txid="+tx.txid+"g_lastTXs[coin.name][j].txid="+g_lastTXs[coin.name][j].txid)
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
            else
            {
                g_lastTXs[coin.name] = [];
            }
            
            const array3 = g_lastTXs[coin.name].concat(txs).unique();
 
            g_lastTXs[coin.name] = array3;
                
            exports.log2('FillLast save for '+coin.name+" count="+txs.length);
                
            await exports.SaveTransactions(coin, headers, txs);
                    
            exports.log2('SAVED for '+coin.name+" count="+txs.length);
            
            return ok();
        }
        catch(e) {
            exports.log2('SaveLastTransactions cancel for '+coin.name+" FAILED: "+e.message)
            return cancel(e);
        }
    });
}

exports.SaveTransactions = function(coin, headers, txs)
{
    const coinName = coin.name;
    
    return new Promise(async (ok, cancel) => {
        
        //if (coinName != "Dogecoin")
        //    return ok();
            
        let bFirstSkip = true;
        //for (let i=txs.length-1; i>=0; i--)
        for (let i=txs.length-1; i>=0; i--)
        {
            await exports.Sleep(100);
            try {
                if (!txs[i].txid)
                    continue;
                    
                exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions "+coinName+"; i="+i+"; txs[i].txid="+txs[i].txid)
                if (txs[i].comment)
                {
                    try {
                        const data = JSON.parse(txs[i].comment);
                        if (txs[i].category == 'send' && data[0].from && data[0].from.length > 3)
                            txs[i].account = data[0].from;
                    }
                    catch(e) {
                        exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions "+coinName+"; i="+i+"; txs[i].txid="+txs[i].txid + 
                        "catch error="+e.message)
                    }
                }

                const uid = exports.Hash(coinName+(txs[i].time||-1)+txs[i].comment+(txs[i].address||"")+(txs[i].category||"")+(txs[i].amount||"")+(txs[i].vout||"")+(txs[i].txid||""));
                const txid = "txid='"+escape(txs[i].txid)+"' AND category='"+escape(txs[i].category)+"' AND amount='"+escape(txs[i].amount)+"' ORDER BY time*1";
                        
                const rows0 = await g_constants.dbTables["listtransactions"].Select2("*", "uid='"+escape(uid)+"'");
                const rows = await g_constants.dbTables["listtransactions"].Select2("*", txid);
                
                const account = txs[i].category == 'send' ? txs[i].account : await GetAccount(txs[i].address, txs[i].blocktime);
                
                if (rows.length != rows0.length)
                {
                    for (let k=1; k<rows.length; k++)
                    {
                        if (account == rows[k].account && rows[k].category == 'receive')
                        {
                            exports.log2("!!!ERROR!!! txid="+txs[i].txid+" ("+rows.length+", "+rows0.length+")");
                            await g_constants.dbTables["listtransactions"].Update("amount='0'", "uid='"+escape(rows[k].uid)+"'");
                        }
                    }
                    //exports.log2("rows0="+JSON.stringify(rows0));
                    //exports.log2("rows="+JSON.stringify(rows));
                    continue;
                }
                
                
                if (txs[i].category == 'receive' && txs[i].amount*1 > 0 && account == "-")
                {
                    await g_constants.dbTables["listtransactions"].Update("amount='0'", "uid='"+escape(uid)+"'");
                    exports.log2("!!!was updated!!! "+coinName+"; "+txs[i].amount+"; uid='"+escape(uid)+"'; ");
                    continue;
                }
                
                if (txs[i].category == 'receive')
                {
                    for (let j=0; j<rows.length; j++)
                    {
                        if (rows[j].account.length < 10)
                        {
                            exports.log2("check receiving account "+rows[j].account+"; new account = "+account+" ("+coinName+")")
                            if (account.length > 10)
                            {
                                await g_constants.dbTables["listtransactions"].Update("account='"+escape(account)+"'", "uid='"+escape(uid)+"'");
                                exports.log2("!!!was updated account!!! "+account+"; uid='"+escape(uid)+"'; ");
                                break;
                            }
                        }
                    }
                }
                
                
                //exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions1 "+coinName+"; i="+i+"; txs[i].txid="+txs[i].txid)
                if (rows.length)
                {
                    if (txs[i].confirmations && rows[0].confirmations != txs[i].confirmations)
                    {
                        const confirmations = escape(txs[i].confirmations) || 0;
                        
                        //console.log("try update confirmations "+coinName+"; uid='"+escape(uid)+"'"+"; account="+account)
                        await g_constants.dbTables["listtransactions"].Update(
                            "confirmations="+confirmations,
                            "uid='"+escape(uid)+"'"
                        );
                    }
                    if (!txs[i].blockindex || !txs[i].blocktime || !txs[i].blockhash )
                        continue;
                        
                    if ((rows[0].blocktime == -1 && txs[i].blocktime && txs[i].blocktime != -1) ||
                        (rows[0].account == "%20"))// && txs[i].account && txs[i].account.length))
                    {
                        const otheraccount = txs[i].otheraccount && txs[i].otheraccount.length ? escape(txs[i].otheraccount) : rows[0].otheraccount;
    
                        //console.log("try update block "+coinName+"; uid='"+escape(uid)+"'"+"; account="+escape(account))
                        await g_constants.dbTables["listtransactions"].Update(
                            "blockhash='"+escape(txs[i].blockhash)+"', blockindex="+escape(txs[i].blockindex)+", blocktime="+escape(txs[i].blocktime)+
                            ", otheraccount='"+otheraccount+"' ",
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

                    exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + ' SaveTransactions (insert) coin='+coinName+', account='+account+"; amount="+txs[i].amount+"; txid="+txs[i].txid)
                    
                    await g_constants.dbTables["listtransactions"].Insert(
                        coinName,
                        account == " " && txs[i].label && txs[i].label.length > 4 ? txs[i].label : account,
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
                exports.log2(new Date().toJSON().slice(0,10).replace(/-/g,'/') + " SaveTransactions (catch error2) "+coinName+"; error="+e.message+
                " txs[i].txid="+(txs && txs.length > i ? txs[i].txid : "???"))
            }
        }

        ok();
    });
}

exports.GetAccount = function(address, blocktime = 0)
{
   return  GetAccount(address, blocktime);
}

let g_accounts = {}

function GetAccount(address, blocktime = 0)
{
    return new Promise((async ok => {
        if (g_accounts[address])
            return ok(g_accounts[address]);
            
        const rows = await g_constants.dbTables["addresses"].Select2("*", "address='"+escape(address)+"'");
        
        if (rows.length && blocktime*1 > 0 && rows[0].time*1 > blocktime*1000)
        {
            exports.log2("!!!ERROR 2!!!");
            g_accounts[address] = "-";
            return ok(g_accounts[address]);
        }

        g_accounts[address] = rows.length ? ok(unescape(rows[0].account)) : ok(" ");
        return ok(g_accounts[address]);
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