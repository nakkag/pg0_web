"use strict";

const text_diff = (function () {
	const me = {};

	const EQUAL = 0;
	const DELETE = 1;
	const INSERT = 2;

	// Past this many differences the rest of the text is taken as replaced as a whole,
	// which keeps the time and memory of comparing large texts bounded.
	const EDIT_LIMIT = 2000;
	// Removed and added lines alike in at least this share of their characters (spaces aside) count as one changed line.
	const CHANGE_SIMILARITY = 0.5;
	// Blocks of removed and added lines up to this many pairs are matched up line by line;
	// larger ones pair the lines in order.
	const PAIR_LIMIT = 2500;
	// Lines longer than this many tokens are not compared word by word.
	const TOKEN_LIMIT = 1000;

	function pushOp(ops, op, count) {
		if (count <= 0) {
			return;
		}
		if (ops.length > 0 && ops[ops.length - 1][0] === op) {
			ops[ops.length - 1][1] += count;
		} else {
			ops.push([op, count]);
		}
	}

	// Myers' O(ND) algorithm on a[0..n) and b[0..m). Returns the edit as ops in order,
	// or null when the texts differ in more than the limit.
	function myers(a, b, limit) {
		const n = a.length;
		const m = b.length;
		const max = Math.min(n + m, limit);
		const off = max + 1;
		const v = new Int32Array(2 * max + 3);
		const trace = [];
		let found = -1;
		for (let d = 0; d <= max && found < 0; d++) {
			trace.push(v.slice(off - d, off + d + 1));
			for (let k = -d; k <= d; k += 2) {
				let x;
				if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) {
					x = v[off + k + 1];
				} else {
					x = v[off + k - 1] + 1;
				}
				let y = x - k;
				while (x < n && y < m && a[x] === b[y]) {
					x++;
					y++;
				}
				v[off + k] = x;
				if (x >= n && y >= m) {
					found = d;
					break;
				}
			}
		}
		if (found < 0) {
			return null;
		}
		// Walk back from the end along the moves that reached it.
		const rev = [];
		let x = n;
		let y = m;
		for (let d = found; d > 0; d--) {
			const vd = trace[d];
			const k = x - y;
			const down = (k === -d || (k !== d && vd[k - 1 + d] < vd[k + 1 + d]));
			const prevK = down ? k + 1 : k - 1;
			const prevX = vd[prevK + d];
			const startX = down ? prevX : prevX + 1;
			pushOp(rev, EQUAL, x - startX);
			pushOp(rev, down ? INSERT : DELETE, 1);
			x = prevX;
			y = prevX - prevK;
		}
		pushOp(rev, EQUAL, x);
		return rev.reverse();
	}

	// The edit that turns the array a into b, as [op, count] runs in order.
	function diff(a, b, limit) {
		let start = 0;
		while (start < a.length && start < b.length && a[start] === b[start]) {
			start++;
		}
		let endA = a.length;
		let endB = b.length;
		while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
			endA--;
			endB--;
		}
		const ops = [];
		pushOp(ops, EQUAL, start);
		const middle = myers(a.slice(start, endA), b.slice(start, endB), limit);
		if (middle) {
			middle.forEach(([op, count]) => pushOp(ops, op, count));
		} else {
			pushOp(ops, DELETE, endA - start);
			pushOp(ops, INSERT, endB - start);
		}
		pushOp(ops, EQUAL, a.length - endA);
		return ops;
	}

	function splitLines(text) {
		return text.split(/\r\n|\r|\n/);
	}

	// Words, runs of spaces, and single other characters.
	function tokenize(line) {
		return line.match(/[A-Za-z0-9_]+|\s+|[^A-Za-z0-9_\s]/g) || [];
	}

	// How alike two lines are, from 0 to 1, with the parts of each that differ.
	function compareLine(oldTokens, newTokens) {
		if (oldTokens.length > TOKEN_LIMIT || newTokens.length > TOKEN_LIMIT) {
			return {score: 0};
		}
		const ops = diff(oldTokens, newTokens, EDIT_LIMIT);
		const oldParts = [];
		const newParts = [];
		let same = 0;
		let total = 0;
		let i = 0;
		let j = 0;
		const pushPart = function(parts, text, changed) {
			if (parts.length > 0 && parts[parts.length - 1].changed === changed) {
				parts[parts.length - 1].text += text;
			} else {
				parts.push({text: text, changed: changed});
			}
		};
		ops.forEach(([op, count]) => {
			for (let c = 0; c < count; c++) {
				if (op === EQUAL) {
					const t = oldTokens[i++];
					j++;
					const len = t.trim().length;
					same += len * 2;
					total += len * 2;
					pushPart(oldParts, t, false);
					pushPart(newParts, t, false);
				} else if (op === DELETE) {
					const t = oldTokens[i++];
					total += t.trim().length;
					pushPart(oldParts, t, true);
				} else {
					const t = newTokens[j++];
					total += t.trim().length;
					pushPart(newParts, t, true);
				}
			}
		});
		return {score: (total === 0) ? 1 : same / total, oldParts: oldParts, newParts: newParts};
	}

	// Matches removed lines with added lines that are edits of them, keeping both in order.
	// Returns the matches as [old index, new index, comparison].
	function pairLines(oldLines, newLines) {
		const k = oldLines.length;
		const m = newLines.length;
		if (k === 0 || m === 0) {
			return [];
		}
		const oldTokens = oldLines.map(tokenize);
		const newTokens = newLines.map(tokenize);
		const pairs = [];
		if (k * m > PAIR_LIMIT) {
			for (let i = 0; i < Math.min(k, m); i++) {
				const cmp = compareLine(oldTokens[i], newTokens[i]);
				if (cmp.score >= CHANGE_SIMILARITY) {
					pairs.push([i, i, cmp]);
				}
			}
			return pairs;
		}
		// The order-keeping matching with the highest total likeness.
		const cmps = [];
		const score = new Float64Array((k + 1) * (m + 1));
		const from = new Uint8Array((k + 1) * (m + 1));
		for (let i = 1; i <= k; i++) {
			cmps[i - 1] = [];
			for (let j = 1; j <= m; j++) {
				const cell = i * (m + 1) + j;
				let best = score[cell - (m + 1)];
				let dir = 1;
				if (score[cell - 1] > best) {
					best = score[cell - 1];
					dir = 2;
				}
				const cmp = compareLine(oldTokens[i - 1], newTokens[j - 1]);
				cmps[i - 1][j - 1] = cmp;
				if (cmp.score >= CHANGE_SIMILARITY && score[cell - (m + 1) - 1] + cmp.score > best) {
					best = score[cell - (m + 1) - 1] + cmp.score;
					dir = 3;
				}
				score[cell] = best;
				from[cell] = dir;
			}
		}
		let i = k;
		let j = m;
		while (i > 0 && j > 0) {
			const dir = from[i * (m + 1) + j];
			if (dir === 3) {
				pairs.push([i - 1, j - 1, cmps[i - 1][j - 1]]);
				i--;
				j--;
			} else if (dir === 1) {
				i--;
			} else {
				j--;
			}
		}
		return pairs.reverse();
	}

	// Compares two texts line by line, in the order a unified diff shows them.
	// Each row is {type, oldNum, newNum, text, parts}: type is 'equal', 'delete', 'insert',
	// 'change-old' or 'change-new' (the old and new forms of an edited line), the line numbers
	// are 1-based (0 where the line is not on that side), and parts, on changed lines, splits
	// the text into {text, changed}.
	// A null oldText stands for no text at all, so every line of newText is added.
	me.compare = function(oldText, newText) {
		const a = (oldText === null) ? [] : splitLines(oldText);
		const b = splitLines(newText);
		const rows = [];
		let i = 0;
		let j = 0;
		const ops = diff(a, b, EDIT_LIMIT);
		for (let n = 0; n < ops.length; n++) {
			if (ops[n][0] === EQUAL) {
				for (let c = 0; c < ops[n][1]; c++) {
					rows.push({type: 'equal', oldNum: i + 1, newNum: j + 1, text: a[i]});
					i++;
					j++;
				}
				continue;
			}
			// A block of removed and added lines between unchanged ones.
			let dels = 0;
			let adds = 0;
			for (; n < ops.length && ops[n][0] !== EQUAL; n++) {
				if (ops[n][0] === DELETE) {
					dels += ops[n][1];
				} else {
					adds += ops[n][1];
				}
			}
			n--;
			const oldLines = a.slice(i, i + dels);
			const newLines = b.slice(j, j + adds);
			const oldPair = new Array(dels);
			const newPair = new Array(adds);
			pairLines(oldLines, newLines).forEach(([oi, ni, cmp]) => {
				oldPair[oi] = cmp.oldParts;
				newPair[ni] = cmp.newParts;
			});
			oldLines.forEach((text, c) => {
				rows.push(oldPair[c] ?
					{type: 'change-old', oldNum: i + c + 1, newNum: 0, text: text, parts: oldPair[c]} :
					{type: 'delete', oldNum: i + c + 1, newNum: 0, text: text});
			});
			newLines.forEach((text, c) => {
				rows.push(newPair[c] ?
					{type: 'change-new', oldNum: 0, newNum: j + c + 1, text: text, parts: newPair[c]} :
					{type: 'insert', oldNum: 0, newNum: j + c + 1, text: text});
			});
			i += dels;
			j += adds;
		}
		return rows;
	};

	return me;
})();
