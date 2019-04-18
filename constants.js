'use strict';

const DOMAIN = 'localhost';

exports.DEBUG_LOG = true;

exports.share = {
    my_portSSL: 40743,
    my_port: 40745
};

const DATABASE_PATH = '/home/accounts/opentrade/accountsServer/database/sqlite_accounts.db';
exports.dbTables = [
   {
      'name' : 'KeyValue',
      'cols' : [
          ['key', 'TEXT UNIQUE PRIMARY KEY'],
          ['value', 'TEXT']
        ]
   },
   {
       'name': 'Transactions',
       'cols': [
           ['hash', 'TEXT UNIQUE PRIMARY KEY'],
           ['data', 'TEXT'],
           ['account', 'TEXT'],
           ['address', 'TEXT'],
           ['category', 'TEXT'],
           ['amount', 'TEXT'],
           ['label', 'TEXT'],
           ['vout', 'INT'],
           ['confirmations', 'INT'],
           ['blockhash', 'INT'],
           ['timereceived', 'INT']
        ]
   },
   {
       'name': 'listtransactions',
       'cols': [
           ['coin', 'TEXT'],
           ['account', 'TEXT'],
           ['address', 'TEXT'],
           ['category', 'TEXT'],
           ['amount', 'TEXT'],
           ['label', 'TEXT'],
           ['vout', 'INT'],
           ['fee', 'TEXT'],
           ['confirmations', 'INT'],
           ['trusted', 'TEXT'],
           ['blockhash', 'TEXT'],
           ['blockindex', 'INT'],
           ['blocktime', 'INT'],
           ['txid', 'TEXT'],
           ['time', 'INT'],
           ['timereceived', 'INT'],
           ['comment', 'TEXT'],
           ['otheraccount', 'TEXT'],
           ['bip125_replaceable', 'TEXT'],
           ['abandoned', 'TEXT'],
           ['uid', 'TEXT UNIQUE PRIMARY KEY']
        ]
   }
]


exports.DOMAIN = DOMAIN;
exports.PORT_DB = 40545;
exports.dbName = DATABASE_PATH;
exports.SSL_KEY = '../ssl_certificates/privkey.pem';
exports.SSL_CERT = '../ssl_certificates/fullchain.pem';

exports.SSL_options = {
    key: require("fs").readFileSync(exports.SSL_KEY),
    cert: require("fs").readFileSync(exports.SSL_CERT)
};

exports.IsAllowedAddress = function(addr)
{
//    if (PRIVATE.IsUnlimitedAddress && PRIVATE.IsUnlimitedAddress(addr))
//        return true;
    if (addr.indexOf("195.64.208.208") < 0 && addr.indexOf("165.22.131.199") < 0)
        return false;

        
    return true;
}

exports.WEB_SOCKETS = null;
