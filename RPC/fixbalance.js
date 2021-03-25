'use strict';
const utils = require("../utils");
const g_constants = require("../constants");
const getbalance = require("./getbalance")

exports.Run = async function(coin, headers, post_data, res)
{
    if (utils.IsOffline(coin.name))
        return res.end(JSON.stringify({error: 'fail', message: 'coin offline'}));

    console.log(coin.name + "  fixbalance 0")
    try
    {
        const data = JSON.parse(post_data);

        const account = data.params && data.params.length ? data.params[0] : "*";

        let balanceAll = await getbalance.GetAccountBalance(coin, "*", 0);
        let balance = await getbalance.GetAccountBalance(coin, account, 0);

        console.log(coin.name + "  fixbalance 2: account="+account+"; balance="+balance)
        if (balance > balanceAll/3)
            return res.end(JSON.stringify({result: "no need fix balance "+balance, error: null}));

        await g_constants.dbTables["listtransactions"].Insert(
            coin.name,
            account,
            " ",
            "move",
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
        await g_constants.dbTables["listtransactions"].Insert(
            coin.name,
            account,
            " ",
            "move",
            balanceAll/3,
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
        
        balance = await getbalance.GetAccountBalance(coin, account, 0);
        //g_Cache[strCache] = {time: Date.now(), data: JSON.stringify({result: balance, error: null})};
        return res.end(JSON.stringify({result: "new balance = "+balance, error: null}));
    }
    catch(e)
    {
        return res.end(JSON.stringify({result: e.message, error: false}));
    }

}

