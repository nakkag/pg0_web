const express = require('express');
const app = express();

const codes = [
	{id: 1, name: 'aaa', code: "cnt = 0\ni = 1\nwhile (i <= 100) {\n\tcnt = cnt + i\n\ti = i + 1\n}\nexit cnt", password: 4027020077},
	{id: 2, name: 'bbb', code: 'a = 0', password: 4027020077},
	{id: 3, name: 'ccc', code: 'b = 100', password: 4027020077},
];

app.use(express.json());
app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', req.headers.origin);
	res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Credentials', true);
	res.header('Access-Control-Max-Age', '86400');
	next();
});

app.options('*', function (req, res) {
	res.sendStatus(200);
});

app.get('/', (req, res) => {
	res.sendStatus(200);
});

app.get('/api/codes', (req, res) => {
	const ret = [];
	codes.forEach((code) => {
		ret.push({id: code.id, name: code.name, author: code.author, updateTime: code.updateTime});
	});
	res.send(ret);
});

app.get('/api/codes/:keyword', (req, res) => {
	const ret = [];
	codes.forEach((code) => {
		if (code.name.includes(req.params.keyword) || (code.author && code.author.includes(req.params.keyword))) {
			ret.push({id: code.id, name: code.name, author: code.author, updateTime: code.updateTime});
		}
	});
	res.send(ret);
});

app.get('/api/codes/item/:id', (req, res) => {
	const code = codes.find(c => c.id === parseInt(req.params.id));
	if (!code) {
		return res.status(404).send('Not found.');
	}
	const ret = Object.assign({}, code);
	delete ret.password;
	res.send(ret);
});

app.post('/api/codes', (req, res) => {
	const time = new Date().getTime();
	const code = {
		id: codes.length + 1,
		name: req.body.name,
		author: req.body.author,
		password: req.body.password,
		code: req.body.code,
		createTime: time,
		updateTime: time,
	};
	codes.push(code);
	res.send({id: code.id});
});

app.put('/api/codes/:id', (req, res) => {
	const code = codes.find(c => c.id === parseInt(req.params.id));
	if (!code) {
		return res.status(404).send('Not found.');
	}
	if (code.password !== req.body.password) {
		return res.status(401).send('Unauthorized.');
	}
	code.name = req.body.name;
	code.author = req.body.author;
	code.code = req.body.code;
	code.updateTime = new Date().getTime();
	res.sendStatus(200);
});

app.delete('/api/codes/:id', (req, res) => {
	const code = codes.find(c => c.id === parseInt(req.params.id));
	if (!code) {
		return res.status(404).send('Not found.');
	}
	if (code.password !== req.body.password) {
		return res.status(401).send('Unauthorized.');
	}
	const index = codes.indexOf(code);
	codes.splice(index, 1);
	res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));
