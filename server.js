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
	const r = await fetch(req.query.url);
	if (!r.ok) {
		return res.status(r.status).send(r.statusText);
	}
	await r.body.pipe(res);
});

app.get('/api/codes', async (req, res) => {
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
		const cursor = db.collection('codes').find({}).sort({updateTime: -1}).limit(count).skip(skip);
		const ret = [];
		for await (const doc of cursor) {
			ret.push({id: doc.id, name: doc.name, author: doc.author, updateTime: doc.updateTime});
		}
		res.json(ret);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.get('/api/codes/:keyword', async (req, res) => {
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
		const cursor = await db.collection('codes').find({$text: {$search: req.params.keyword}}).sort({updateTime: -1}).limit(count).skip(skip);
		const ret = [];
		for await (const doc of cursor) {
			ret.push({id: doc.id, name: doc.name, author: doc.author, updateTime: doc.updateTime});
		}
		res.json(ret);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.get('/api/codes/item/:id', async (req, res) => {
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('codes').findOne({id: req.params.id});
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

app.post('/api/codes', async (req, res) => {
	const newId = crypto.randomUUID();
	const time = new Date().getTime();

	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const docs = await db.collection('codes').insertOne({
			id: newId,
			name: req.body.name,
			author: req.body.author,
			password: req.body.password,
			code: req.body.code,
			speed: req.body.speed,
			createTime: time,
			updateTime: time,
		});
		res.send({id: newId});
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

app.put('/api/codes/:id', async (req, res) => {
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('codes').findOne({id: req.params.id});
		if (!doc) {
			return res.status(404).send('Not found.');
		}
		if (doc.password !== req.body.password) {
			return res.status(401).send('Unauthorized.');
		}
		await db.collection('codes').updateOne({id: req.params.id}, {$set: {
			name: req.body.name,
			author: req.body.author,
			code: req.body.code,
			speed: req.body.speed,
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

app.delete('/api/codes/:id', async (req, res) => {
	let client;
	try {
		client = await mongodb.MongoClient.connect(settings.dbOption);
		const db = client.db('pg0');
		const doc = await db.collection('codes').findOne({id: req.params.id});
		if (!doc) {
			return res.status(404).send('Not found.');
		}
		if (doc.password !== req.body.password) {
			return res.status(401).send('Unauthorized.');
		}
		await db.collection('codes').deleteOne({id: req.params.id});
		res.sendStatus(200);
	} catch (error) {
		console.error(error);
		return res.status(500).send('Internal Server Error.');
	} finally {
		client.close();
	}
});

server.listen(settings.httpsPort, () => console.log(`https Listening on port ${settings.httpsPort}...`));
app.listen(settings.httpPort, () => console.log(`http Listening on port ${settings.httpPort}...`));
