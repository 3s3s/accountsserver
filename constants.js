'use strict';

const DOMAIN = 'localhost';

exports.DEBUG_LOG = false;

exports.share = {
    my_port: 40745
};

const DATABASE_PATH = '/root/opentrade/accountsserver/database/sqlite_accounts.db';
exports.dbTables = [
   {
      'name' : 'KeyValue',
      'cols' : [
          ['key', 'TEXT UNIQUE PRIMARY KEY'],
          ['value', 'TEXT']
        ]
   },
   {
      'name' : 'addresses',
      'cols' : [
          ['coin', 'TEXT'],
          ['account', 'TEXT'],
          ['address', 'TEXT'],
          ['time', 'INT'],
          ['uid', 'TEXT UNIQUE PRIMARY KEY'],
          ['info', 'TEXT']
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

let PRIVATE = false;
try { PRIVATE = require("./private_constants/private.js");}catch(e){}

exports.DOMAIN = DOMAIN;
exports.PORT_DB = 40545;
exports.dbName = PRIVATE ? PRIVATE.DATABASE_PATH : DATABASE_PATH;
exports.SSL_KEY = './ssl_certificates/privkey.pem';
exports.SSL_CERT = './ssl_certificates/fullchain.pem';

exports.SSL_options = {
    key: require("fs").readFileSync(exports.SSL_KEY),
    cert: require("fs").readFileSync(exports.SSL_CERT)
};

exports.IsAllowedAddress = function(addr)
{
//    if (addr.indexOf("127.0.0.1") < 0 && addr.indexOf(PRIVATE ? PRIVATE.LocalIP : "127.0.0.1") < 0)
//        return false;

    return true;
}

exports.WEB_SOCKETS = null;
