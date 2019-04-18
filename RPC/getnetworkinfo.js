'use strict';
const utils = require("../utils");

exports.Run = function(coin, headers, post_data, res)
{
    utils.postString(coin.hostname, {'nPort' : coin.port, 'name' : "http"}, "/", headers, post_data, result => {
        console.log(result.data);
        
        res.end(result.data || "");
    });
}

