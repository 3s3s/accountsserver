'use strict';
const g_constants = require("../constants");
const utils = require("../utils");
const getbalance = require("./getbalance");

let g_Lock = {};
exports.Run = async function(coin, headers, post_data, res)
{
    utils.log2("move start")
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: {message: 'coin is offline'}}));
    
    let balanceFinalFrom = "";   
    let balanceFinalTo = "";   
    try
    {
        const data = JSON.parse(post_data);
        
        utils.log2("move data.params="+JSON.stringify(data.params))
        
        if (!data.params || data.params.length < 3 || 1*data.params[2] < 0)
            return res.end(JSON.stringify({error: {message: 'bad params'} }));

    //if (coin.name != "Marycoin" && coin.name != "Dogecoin")// ||  (data.params[0] != "3b0a5347a1ad24e1a75fe7ce2c7906f4" && data.params[1] != "3b0a5347a1ad24e1a75fe7ce2c7906f4"))
    //    return res.end(JSON.stringify({error: {message: 'coin is offline'}}));
        
        const lock = utils.Hash(JSON.stringify(data.params));
        if (g_Lock[lock])
            return res.end(JSON.stringify({error: {message: 'moving locked'} }))
            
        utils.log2("move step 1")
        g_Lock[lock] = true;
        
        const balance0 = await getbalance.GetAccountBalance(coin, data.params[0]);
        const balance1 = await getbalance.GetAccountBalance(coin, data.params[1]);

        if (1*balance0 - 1*data.params[2] < 0 && Math.abs(1*balance0 - 1*data.params[2]) > 0.00001)
        {
            data.params[2] = balance0;
            //console.log("move return false with message: "+'(1) bad account ('+data.params[0]+') balance: '+1*balance0+"; data.params[2]="+data.params[2]*1)
            //return res.end(JSON.stringify({error: {message: '(1) bad account ('+data.params[0]+') balance: '+1*balance0+"; data.params[2]="+data.params[2]*1} }));
        }
        if (1*balance1 + 1*data.params[2] < 0 && Math.abs(1*balance1 + 1*data.params[2]) > 0.00001)
        {
            if (g_Lock[lock]) delete g_Lock[lock];
            utils.log2("move return false with message: "+'(2) bad account ('+data.params[1]+') balance: '+1*balance1+"; data.params[2]="+data.params[2]*1)
            return res.end(JSON.stringify({error: {message: '(2) bad account ('+data.params[1]+') balance: '+1*balance1+"; data.params[2]="+data.params[2]*1} }));
        }
            
        utils.log2("move step 2; balance0="+balance0+"; balance1="+balance1);
       // const balanceTo = await getbalance.GetAccountBalance(coin.name, data.params[1]);
       // if (balanceTo*1 > 0.01)
        //    return res.end(JSON.stringify({error: 'fail', message: 'bad account balance: '+1*balanceTo}));
        
        const coinTime = (Date.now() / 1000).toFixed(0);
        const comment = data.params.length == 5 ? data.params[4] : " ";
        
        const uid1 = utils.Hash(coin.name+data.params[0]+data.params[1]+coinTime+comment+"move"+data.params[2]);
        const uid2 = utils.Hash(coin.name+data.params[1]+data.params[0]+coinTime+comment+"move"+data.params[2]);
        
        console.log("moving for coin="+coin.name+" amoun="+data.params[2])
        await g_constants.dbTables["listtransactions"].Insert(
            coin.name,
            data.params[0],
            " ",
            "move",
            -1 * data.params[2],
            " ",
            "-1",
            "0",
            "0",
            " ",
            " ",
            "-1",
            "-1",
            " ",
            coinTime,
            "-1",
            comment,
            data.params[1],
            "",
            " ",
            uid1
        );
        
        utils.log2("move step 3")
        await g_constants.dbTables["listtransactions"].Insert(
            coin.name,
            data.params[1],
            " ",
            "move",
            data.params[2],
            " ",
            "-1",
            "0",
            "0",
            " ",
            " ",
            "-1",
            "-1",
            " ",
            coinTime,
            "-1",
            comment,
            data.params[0],
            "",
            " ",
            uid2
        );
        
        balanceFinalFrom = await getbalance.GetAccountBalance(coin, data.params[0]);
        balanceFinalTo = await getbalance.GetAccountBalance(coin, data.params[1]);
        
        if (g_Lock[lock]) delete g_Lock[lock];
        
        utils.log2("move step 4")
    }
    catch(e)
    {
        utils.log2("move catch error = "+e.message)
        return res.end(JSON.stringify({error: {message: 'move cath error: '+e.message} }))
        /*utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, async result => {
            console.log(result.data);
            
            if (result.success == false)
                return res.end(JSON.stringify({error: {message: result.message || 'move failed'} }));
            
            await utils.SaveLastTransactions(coin, headers, 5);
            
            res.end(result.data || "");
        });*/
    }
    return res.end(JSON.stringify({result: true, error: null, message: {balanceFinalFrom: balanceFinalFrom, balanceFinalTo: balanceFinalTo}}));
}

