exports.dbOption = 'mongodb://user:pass@127.0.0.1:27017/pg0';

exports.key = 'privkey.pem';
exports.cert = 'cert.pem';

exports.httpsPort = 443;
exports.httpPort = 80;

exports.listCount = 30;
exports.maxCount = 100;

exports.nameLength = 100;
exports.authorLength = 100;

// Local settings (server_settings.local.js) override the values above.
// The file is not tracked by git, so it survives replacing the sources.
const fs = require('fs');
const path = require('path');
const localFile = path.join(__dirname, 'server_settings.local.js');
if (fs.existsSync(localFile)) {
	Object.assign(exports, require(localFile));
}
