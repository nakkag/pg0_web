"use strict";

// The compact form of a parse tree in a compiled program (app_server.js
// writes it, the app page reads it). Each token is an array
//   [type, line, value, link, block]
// with the fields the token does not have cut off from the end: line is the
// difference from the line of the token before it (the tokens counted in
// order, the blocks included) or null when the token has none; value is the
// name (a string) or the number; link is the index a jump goes to; block is
// the list of the tokens of a block. This is about a third of the size of
// the tokens as objects, and gzip brings it close to the source.
(function(root) {
	function packList(tokens, state) {
		return tokens.map(function(t) {
			let line = null;
			if (typeof t.line === 'number' && t.line >= 0) {
				line = t.line - state.line;
				state.line = t.line;
			}
			const row = [
				t.type,
				line,
				(t.buf !== undefined) ? t.buf : ((t.num !== undefined) ? t.num : null),
				(t.link !== undefined) ? t.link : null,
				t.target ? packList(t.target, state) : null
			];
			while (row.length > 2 && row[row.length - 1] === null) {
				row.pop();
			}
			return row;
		});
	}

	function unpackList(list, state) {
		return list.map(function(r) {
			const t = {type: r[0], line: -1};
			if (typeof r[1] === 'number') {
				t.line = state.line + r[1];
				state.line = t.line;
			}
			if (r.length > 2 && r[2] !== null) {
				if (typeof r[2] === 'string') {
					t.buf = r[2];
				} else {
					t.num = r[2];
				}
			}
			if (r.length > 3 && r[3] !== null) {
				t.link = r[3];
			}
			if (r.length > 4 && r[4]) {
				t.target = unpackList(r[4], state);
			}
			return t;
		});
	}

	const pg0_pack = {
		// {name, extension, strict, token} -> [name, extension, strict, packed tokens]
		packScript: function(s) {
			return [s.name || '', s.extension ? 1 : 0, s.strict ? 1 : 0, packList(s.token, {line: 0})];
		},
		unpackScript: function(a) {
			return {name: a[0] || '', extension: !!a[1], strict: !!a[2], token: unpackList(a[3], {line: 0})};
		}
	};
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = pg0_pack;
	} else {
		root.pg0_pack = pg0_pack;
	}
})(this);
