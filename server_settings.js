// Sample settings. Copy this file to server_settings.local.js and edit it;
// the server reads server_settings.local.js when it exists.

exports.dbOption = 'mongodb://user:pass@127.0.0.1:27017/pg0';

exports.key = 'privkey.pem';
exports.cert = 'cert.pem';

exports.httpsPort = 443;
exports.httpPort = 80;

exports.listCount = 30;
exports.maxCount = 100;

exports.nameLength = 100;
exports.authorLength = 100;
