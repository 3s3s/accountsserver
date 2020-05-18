'use strict';
const utils = require("../utils");

exports.Run = function(coin, headers, post_data, res)
{
    utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log("coin ("+coin.name+") RPC walletpassphrase post_data: "+post_data+"; returned: "+result.data);
        if (result && !result.error)
            return res.end(JSON.stringify({result: "success", data: true}));
        res.end(result.data || "");
    });
}

