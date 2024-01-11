const express = require('express');
const app = express();

app.use(express.json());

const codes = [
	{id: 1, name: 'aaa', code: "cnt = 0\ni = 1\nwhile (i <= 100) {\n\tcnt = cnt + i\n\ti = i + 1\n}\nexit cnt", password: 'xxx'},
	{id: 2, name: 'bbb', code: 'a = 0', password: 'yyy'},
	{id: 3, name: 'ccc', code: 'b = 100', password: 'zzz'},
];

app.get('/', (req, res) => {
});

app.get('/api/codes', (req, res) => {
	const ret = [];
	codes.forEach((code) => {
		ret.push({id: code.id, name: code.name});
	});
	res.send(ret);
});

app.get('/api/codes/search/:keyword', (req, res) => {
	const ret = [];
	codes.forEach((code) => {
		if (code.name.includes(req.params.keyword)) {
			ret.push({id: code.id, name: code.name});
		}
	});
	res.send(ret);
});

app.get('/api/codes/:id', (req, res) => {
	const code = codes.find(c => c.id === parseInt(req.params.id));
	if (!code) {
		return res.status(404).send('Not found.');
	}
	res.send(code);
});

app.post('/api/codes', (req, res) => {
	const code = {
		id: codes.length + 1,
		name: req.body.name,
		code: req.body.code,
		password: req.body.password,
	};
	codes.push(code);
});

app.put('/api/codes/:id', (req, res) => {
	const code = codes.find(c => c.id === parseInt(req.params.id));
	if (!code) {
		return res.status(404).send('Not found.');
	}
	code.name = req.body.name;
	code.code = req.body.code;
	code.password = req.body.password;
});

app.delete('/api/codes/:id', (req, res) => {
	const code = codes.find(c => c.id === parseInt(req.params.id));
	if (!code) {
		return res.status(404).send('Not found.');
	}
	const index = codes.indexOf(code);
	codes.splice(index, 1);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));
