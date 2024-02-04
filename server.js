const settings = require('./server_settings.js');

const fs = require('fs');
const https = require('https');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const crypto = require('crypto');

const fetch = async function (url, init) {
	const {default: fetch} = await import('node-fetch');
	return await fetch(url, init);
};

const express = require('express');
const app = express();
const server = https.createServer({
	key:  fs.readFileSync(settings.key),
	cert: fs.readFileSync(settings.cert)
}, app);

app.use(express.json());
app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', req.headers.origin);
	res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Credentials', true);
	res.header('Access-Control-Max-Age', '86400');
	next();
});
app.use('/', express.static('public'));

app.options('*', function (req, res) {
	res.sendStatus(200);
});

app.get('/import', async (req, res) => {
	const url = req.query.url.replace(/\r\n/, '');
	const r = await fetch(url);
	if (!r.ok) {
		return res.status(r.status).send(r.statusText);
	}
	await r.body.pipe(res);
});

app.get('/api/script', async (req, res) => {
	const skip = parseInt(req.query.skip || 0);
	let count = parseInt(req.query.count || settings.listCount);
	if (count < 0) {
		count = settings.listCount;
	}
	if (count > settings.maxCount) {
		count = settings.maxCount;
	}
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const cursor = db.collection('script').find({}).sort({updateTime: -1}).limit(count).skip(skip);
		const ret = [];
		for await (const doc of cursor) {
			ret.push({cid: doc.cid, name: doc.name, author: doc.author, updateTime: doc.updateTime});
		}
		res.json(ret);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.get('/api/script/:keyword', async (req, res) => {
	const skip = parseInt(req.query.skip || 0);
	let count = parseInt(req.query.count || settings.listCount);
	if (count < 0) {
		count = settings.listCount;
	}
	if (count > settings.maxCount) {
		count = settings.maxCount;
	}
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const list = req.params.keyword.split(' ');
		const regs = [];
		list.forEach(function(d) {
			regs.push({keyword: new RegExp(d, 'i')});
		});
		const cursor = await db.collection('script').find({$and: regs}).sort({updateTime: -1}).limit(count).skip(skip);
		const ret = [];
		for await (const doc of cursor) {
			ret.push({cid: doc.cid, name: doc.name, author: doc.author, updateTime: doc.updateTime});
		}
		res.json(ret);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.get('/api/script/item/:cid', async (req, res) => {
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('script').findOne({cid: req.params.cid});
		if (!doc) {
			return res.status(404).send('Not found.');
		}
		delete doc._id;
		delete doc.password;
		res.json(doc);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.post('/api/script', async (req, res) => {
	const newCid = crypto.randomUUID();
	const time = new Date().getTime();

	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const docs = await db.collection('script').insertOne({
			cid: newCid,
			name: req.body.name,
			type: req.body.type,
			author: req.body.author,
			password: req.body.password,
			code: req.body.code,
			speed: req.body.speed,
			keyword: req.body.name + ' ' + req.body.author,
			createTime: time,
			updateTime: time,
		});
		res.send({cid: newCid});
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.put('/api/script/:cid', async (req, res) => {
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('script').findOne({cid: req.params.cid});
		if (!doc) {
			return res.status(404).send('Not found.');
		}
		if (doc.password !== req.body.password) {
			return res.status(401).send('Unauthorized.');
		}
		await addHistory(req.params.cid);
		await db.collection('script').updateOne({cid: req.params.cid}, {$set: {
			name: req.body.name,
			type: req.body.type,
			author: req.body.author,
			code: req.body.code,
			speed: req.body.speed,
			keyword: req.body.name + ' ' + req.body.author,
			updateTime: new Date().getTime(),
		}});
		res.sendStatus(200);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.delete('/api/script/:cid', async (req, res) => {
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('script').findOne({cid: req.params.cid});
		if (!doc) {
			return res.status(404).send('Not found.');
		}
		if (doc.password !== req.body.password) {
			return res.status(401).send('Unauthorized.');
		}
		await addHistory(req.params.cid);
		await db.collection('script').deleteOne({cid: req.params.cid});
		res.sendStatus(200);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

async function addHistory(cid) {
	if (await diffHistory(cid)) {
		return;
	}
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('script').findOne({cid: cid});
		if (doc) {
			delete doc._id;
			doc.hisotryTime = new Date().getTime();
			await db.collection('script_history').insertOne(doc);
		}
	} catch (error) {
		console.error(error);
	} finally {
		client.close();
	}
}

async function diffHistory(cid) {
	let ret = false;
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc1 = await db.collection('script').findOne({cid: cid});
		if (doc1) {
			const cursor = db.collection('script_history').find({cid: cid}).sort({hisotryTime: -1}).limit(1);
			if (cursor) {
				const doc2 = await cursor.next();
				if (doc2) {
					if (doc1.name === doc2.name &&
						doc1.type === doc2.type &&
						doc1.author === doc2.author &&
						doc1.password === doc2.password &&
						doc1.code === doc2.code &&
						doc1.speed === doc2.speed) {
						ret = true;
					}
				}
			}
		}
	} catch (error) {
		console.error(error);
	} finally {
		client.close();
	}
	return ret;
}

server.listen(settings.httpsPort, () => console.log(`https Listening on port ${settings.httpsPort}...`));
app.listen(settings.httpPort, () => console.log(`http Listening on port ${settings.httpPort}...`));