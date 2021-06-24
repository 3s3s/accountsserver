'use strict';
const utils = require("../utils");
const g_constants = require("../constants");
const handler = require("../reqHandler");

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
    {
        console.log("listtransactions return coin is offline "+coin.name)
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));
    }
    
    try
    {
        const data = JSON.parse(post_data);
        const account = data.params && data.params.length ? " AND (account='"+escape(data.params[0])+"' OR account='"+escape(data.params[0])+"_' OR ((account='%20' OR account='') AND label='"+escape(data.params[0])+"'))" : "";
        //const account = data.params && data.params.length ? " AND (account='"+escape(data.params[0])+"')"/* OR ((account='%20' OR account='') AND label='"+escape(data.params[0])+"'))"*/ : "";
        const limit = data.params && data.params.length && data.params[1] ? escape(data.params[1]) : 10000;
        
        const addrs = await g_constants.dbTables["addresses"].Select2("*", "(coin='"+escape(coin.name)+"' OR coin='"+escape(coin.name)+"_old')  AND account='"+escape(data.params[0])+"'");
        
        if (account.indexOf("1dfce560433d662cc779ad4edc9e5472") != -1)
            utils.log2("listtransactions: "+"coin='"+escape(coin.name)+"' "+account, "ORDER BY 1*time DESC LIMIT "+limit);

        const rowsOrigin = await g_constants.dbTables["listtransactions"].Select2("*", "coin='"+escape(coin.name)+"' "+account, "ORDER BY 1*time DESC LIMIT "+limit);

        let rowsRet = [];
        for (let i=0; i<rowsOrigin.length; i++)
        {
            const bIsOwnAddress = GotAddress(addrs, rowsOrigin[i].address);

            let bNeedAdd = false;
            
            if (bIsOwnAddress && rowsOrigin[i].category == 'receive')
                bNeedAdd = true;

            if (!bIsOwnAddress && rowsOrigin[i].category == 'send')
            {
                bNeedAdd = true;    
                if (i-1 >= 0 && rowsOrigin[i-1].category == 'receive' &&
                    rowsOrigin[i].txid == rowsOrigin[i-1].txid && rowsOrigin[i].amount*1+rowsOrigin[i-1].amount*1 < 0.00001)
                {
                    bNeedAdd = false;    
                }
                if (i+1 < rowsOrigin.length && rowsOrigin[i+1].category == 'receive' &&
                    rowsOrigin[i].txid == rowsOrigin[i+1].txid && rowsOrigin[i].amount*1+rowsOrigin[i+1].amount*1 < 0.00001)
                {
                    bNeedAdd = false;    
                }
            }
            if (!bIsOwnAddress && rowsOrigin[i].category == 'receive')
            {
                //const account = await utils.GetAccount(rowsOrigin[i].address);
                //await g_constants.dbTables["listtransactions"].Update("account='"+escape(" ")+"'", "uid='"+escape(rows[k].uid)+"'");
            }
            
            if (bNeedAdd)
                rowsRet.push(rowsOrigin[i]);
            
            /*if (rowsOrigin[i].category != 'receive')
            {
                rowsRet.push(rowsOrigin[i]);
                continue;
            }*/
            
        }
        
        utils.log2("listtransactions OK "+coin.name+"; account="+escape(data.params[0])+"; ret = "+rowsRet.length) 
        if (account.indexOf("1dfce560433d662cc779ad4edc9e5472") != -1)
             utils.log2(rowsRet);
        return res.end(JSON.stringify({result: rowsRet, error: null}));
    }
    catch(e)
    {
        utils.log2(coin.name + "  listtransactions error: "+e.message);
        return res.end(JSON.stringify({error: 'fail', message: "  listtransactions error: "+e.message}));
        /*utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
            console.log(result.data);
            res.end(result.data || "");
        });*/
    }
}

function GotAddress(addrs, address)
{
    for (let j=0; j<addrs.length; j++)
    {
        if (addrs[j].address == address)
            return true;
    }
    return false;
}

exports.queryDaemon = function(coin, headers, key, count = 1000)
{
    return new Promise(async ok => {
        try {
            const strJSON = '{"jsonrpc": "1.0", "id":"curltest", "method": "listtransactions", "params": ["'+key+'",  '+count+', 0] }';
            const result = await utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, strJSON);
            
            //if (coin.name == 'Weacoin2')
            //    utils.log2("listtransactions result="+JSON.stringify(result));
            
            if (result.success == false)
            {
                utils.log2("listtransactions "+coin+" result.success == false "+JSON.stringify(result));
                return ok(null);
            }
            
            if (!result.data)
                result.data = {result: []};
            
            return ok(result.data && result.data.result ? result.data.result : JSON.parse(result.data).result);
        }
        catch(e) {
            utils.log2("listtransactions "+coin.name+" cath error "+e.message);
            return ok(null);
        }
    });
}
