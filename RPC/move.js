'use strict';
const g_constants = require("../constants");
const utils = require("../utils");
const getbalance = require("./getbalance");

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: {message: 'coin is offline'}}));
        
    try
    {
        const data = JSON.parse(post_data);
        
        if (!data.params || data.params.length < 3 || 1*data.params[2] < 0)
            return res.end(JSON.stringify({error: {message: 'bad params'} }));

    //if (coin.name != "Marycoin" && coin.name != "Dogecoin")// ||  (data.params[0] != "3b0a5347a1ad24e1a75fe7ce2c7906f4" && data.params[1] != "3b0a5347a1ad24e1a75fe7ce2c7906f4"))
    //    return res.end(JSON.stringify({error: {message: 'coin is offline'}}));
        
        const balance0 = await getbalance.GetAccountBalance(coin.name, data.params[0]);
        const balance1 = await getbalance.GetAccountBalance(coin.name, data.params[1]);

        if (1*balance0 - 1*data.params[2] < 0)
            return res.end(JSON.stringify({error: {message: 'bad account balance: '+1*balance0} }));
        if (1*balance1 + 1*data.params[2] < 0)
            return res.end(JSON.stringify({error: {message: 'bad account balance: '+1*balance1} }));
            
       // const balanceTo = await getbalance.GetAccountBalance(coin.name, data.params[1]);
       // if (balanceTo*1 > 0.01)
        //    return res.end(JSON.stringify({error: 'fail', message: 'bad account balance: '+1*balanceTo}));
        
        const coinTime = (Date.now() / 1000).toFixed(0);
        const comment = data.params.length == 5 ? data.params[4] : " ";
        
        const uid1 = utils.Hash(coin.name+data.params[0]+data.params[1]+coinTime+comment+"move"+data.params[2]);
        const uid2 = utils.Hash(coin.name+data.params[1]+data.params[0]+coinTime+comment+"move"+data.params[2]);
        
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
    }
    catch(e)
    {
        utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, async result => {
            console.log(result.data);
            
            if (result.success == false)
                return res.end(JSON.stringify({error: {message: result.message || 'move failed'} }));
            
            await utils.SaveLastTransactions(coin, headers, 5);
            
            res.end(result.data || "");
        });
    }
    return res.end(JSON.stringify({result: true, error: null}));
}

