// Sample settings. Copy this file to server_settings.local.js and edit it;
// the server reads server_settings.local.js when it exists.

exports.dbOption = 'mongodb://user:pass@127.0.0.1:27017/pg0';

exports.key = 'privkey.pem';
exports.cert = 'cert.pem';

exports.httpsPort = 443;
exports.httpPort = 80;
// Origins (scheme://host[:port]) allowed to call the API from another site.
exports.allowOrigins = [];

exports.listCount = 30;
exports.maxCount = 100;

exports.nameLength = 100;
exports.authorLength = 100;

// Online play of lib/net.pg0: copies of one stored script (same cid) meet in
// rooms on this server and pass values. Nothing is stored.
exports.net = {
	enabled: true,
	maxPlayers: 8,           // the largest room a program may ask for
	maxMessageBytes: 16384,  // one message as sent
	messagesPerSecond: 60,   // per player; more are dropped
	connectionsPerIp: 16,
	maxConnections: 2000,
	maxRooms: 5000,
	idleSeconds: 1800,       // a player that sends nothing for this long is disconnected
	trustProxy: 'loopback',  // client address from X-Forwarded-For of a proxy on this machine ('loopback'), of any proxy (true) or never (false)
	allowOrigins: [],        // other origins whose pages may join, for the relay only (e.g. 'https://pg0.jp:9443' for the admin pages)
	log: true,               // a line for each connection, room entry and exit, and refusal
	statsSeconds: 300,       // a summary line this often (0: none)
};

// Genre tags a script may carry (at most 3); ids are stored in the DB, labels live in the client.
exports.tags = ['game', 'graphics', 'math', 'algorithm', 'text', 'study', 'tool', 'other'];
