'use strict';

const utils = require("./utils");
const g_constants = require("./constants");

let isKnownCoin = {};
exports.handle = function(app)
{
    app.post('/', OnRequest);
};

async function OnRequest(req, res)
{
    try
    {
        const coin = JSON.parse(new Buffer(req.headers['coin-info'], 'base64').toString('ascii'));
        
        const auth = req.headers['authorization'];
        
        let post_data = await processPost(req, res);
        //console.log('auth: '+auth+'\ncoin:'+JSON.stringify(coin)+'\nPOST:'+post_data+"\n");
        
        const headers = {
            'Content-Type': 'text/plain', 
            'Authorization': auth
        }

        if (!isKnownCoin[coin.name])
            FillData(coin, headers);
        
        try {
            require("./RPC/"+JSON.parse(post_data).method).Run(coin, headers, post_data, res);
        }
        catch(e) {
            //console.log(e.message);
            utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
                //console.log(result.data);
                res.end(result.data || "");

               /* try {
                    const txs = JSON.parse(result.data).result;
                    exports.SaveTransactions(coin.name, txs);
                }
                catch(e) {}*/

            });
        }
    }
    catch(e) {
        res.end();
    }
}

function processPost(request, response) 
{
    let queryData = "";
    return new Promise(ok => {
        request.on('data', data => {
            queryData += data;
            if(queryData.length > 1e6) {
                queryData = "";
                response.writeHead(413, {'Content-Type': 'text/plain'}).end();
                request.connection.destroy();
            }
        });
    
        request.on('end', () => {
            ok(queryData);
        });
    });
}


async function FillData (coin, headers, last = 1000000)
{
    isKnownCoin[coin.name] = true;

    FillAll(coin, headers);
    
    FillLast(coin, headers);
    
    async function FillAll(coin, headers)
    {
        try {
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "listaccounts", "params": [] }';
            const res = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
        
            const accounts = res.data && res.data.length ? JSON.parse(res.data).result : {"*": 0};

            for (let key in accounts)
            {
                await utils.Sleep(1000);
                
                if (utils.IsOffline(coin.name)) throw "";
                
                console.log('new account for '+coin.name+" key="+key);
                    
                const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "listtransactions", "params": ["'+key+'", 200000, 0] }';
                const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
                
                console.log('new result for '+coin.name);
                try {
                    const txs = result.data && result.data.result ? result.data.result : JSON.parse(result.data).result;
                    
                    if (coin.name == 'Cryply')
                    {
                        let k = 0;
                    }
                    if (!txs || !txs.length) throw "";
                            
                    console.log('save for '+coin.name+" count="+txs.length);
                            
                    await exports.SaveTransactions(coin, headers, txs);
                    
                    console.log('SAVED for '+coin.name+" count="+txs.length);
                }
                catch(e) {
                    console.log("catch for "+coin.name+" ");
                }
            }
        }
        catch(e) {
            console.log("catch error for "+coin.name);
        }
        
        console.log('WAIT 120 sec for '+coin.name);
        
        setTimeout(FillAll, 120000, coin, headers);
    }
    
    async function FillLast(coin, headers)
    {
        try {
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "listtransactions", "params": ["*",  1000, 0] }';
            const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
    
            console.log('start parsing for '+coin.name);
                
            const txs = result.data && result.data.result ? result.data.result : JSON.parse(result.data).result;
            
            if (txs)
                utils.Offline(coin.name, false);
            if (!txs || !txs.length) throw "";
                
            console.log('FillLast save for '+coin.name+" count="+txs.length);
            
            await exports.SaveTransactions(coin, headers, txs);
                
            console.log('SAVED for '+coin.name+" count="+txs.length+" strJSON="+strJSON);
        }
        catch(e) {
            console.log('FillLast catch error for '+coin.name);
            utils.Offline(coin.name, true);
        }
        
        console.log('WAIT 60 sec for '+coin.name);    
        setTimeout(FillLast, 60000, coin, headers);
    }
}

exports.SaveTransactions = function(coin, headers, txs)
{
    const coinName = coin.name;
    
    return new Promise(async (ok, cancel) => {
        let bFirstSkip = true;
        for (let i=0; i<txs.length; i++)
        {
            const uid = utils.Hash(coinName+(txs[i].time||-1)+txs[i].comment+(txs[i].address||"")+(txs[i].category||"")+(txs[i].amount||"")+(txs[i].vout||"")+(txs[i].txid||""));
                    
            const rows = await g_constants.dbTables["listtransactions"].Select2("*", "uid='"+escape(uid)+"'");
            if (rows.length)
            {
                /*if (i == 999 && coinName == "Dogecoin")
                {
                    var k = 0;
                }*/
                if ((rows[0].blocktime == -1 && txs[i].blocktime && txs[i].blocktime != -1) ||
                    ((rows[0].account == escape(" ") || !rows[0].account.length) && txs[i].account && txs[i].account.length))
                {
                    const account = txs[i].account && txs[i].account.length ? txs[i].account : rows[0].account;
                    const otheraccount = txs[i].otheraccount && txs[i].otheraccount.length ? txs[i].otheraccount : rows[0].otheraccount;
                    
                    await g_constants.dbTables["listtransactions"].Update(
                        "blockhash='"+txs[i].blockhash+"', blockindex="+txs[i].blockindex+", blocktime="+txs[i].blocktime+
                        ", account='"+account+"' "+ ", otheraccount='"+otheraccount+"'",
                        "uid='"+escape(uid)+"'"
                    );
                    continue;
                }
                if (bFirstSkip) console.log("skip insert for "+coinName);
                bFirstSkip = false;
                
                LogBalance(coinName, txs[i].account);
                SaveTransaction(coin, headers, rows[0]);
                continue;
            }
                        
            try {
                await g_constants.dbTables["listtransactions"].Insert(
                    coinName,
                    txs[i].account||" ",
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
            catch(err) {}
        }
        
        ok();
    });
}

async function SaveTransaction(coin, headers, row)
{
   // const saved = await g_constants.dbTables["gettransaction"].Select2("*", "txid='"+row.txid+"'");
  //  if (saved.length)
   //     return;
        
        
}

let isLogged = {};
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
        utils.log_db("account="+account+" "+coinName+" balance="+(balance*1-skip*1));
}