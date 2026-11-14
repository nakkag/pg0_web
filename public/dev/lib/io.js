"use strict";

ScriptExec.lib['println'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	cv.put(pg0_string.escapeHTML(str) + '<br>');
	return 0;
};

// wait(ms): pauses the program for ms milliseconds (stopped early by the stop button).
ScriptExec.lib['wait'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let time = 0;
	switch (param[0].v.type) {
	case TYPE_ARRAY:
		time = parseInt(ScriptExec.stringToNumber(pg0_string.arrayToString(param[0].v.array)));
		break;
	case TYPE_STRING:
		time = parseInt(ScriptExec.stringToNumber(param[0].v.str));
		break;
	default:
		time = parseInt(param[0].v.num);
		break;
	}
	if (isNaN(time) || time <= 0) {
		return 0;
	}
	const st = new Date().getTime();
	let en = st;
	while (en - st <= time && run) {
		await new Promise(resolve => setTimeout(resolve, 1));
		en = new Date().getTime();
	}
	return 0;
};

function _getIoId() {
	if (ev.currentContent.cid) {
		return 'cid_' + ev.currentContent.cid;
	} else if (ev.currentContent.name) {
		return 'name_' + ev.currentContent.name;
	}
	return 'common';
}

ScriptExec.lib['savevalue'] = function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	localStorage.setItem('pg0_' + _getIoId() +  '_' + key, JSON.stringify(param[1].v));
	return 0;
};

ScriptExec.lib['loadvalue'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	const str = localStorage.getItem('pg0_' + _getIoId() +  '_' + key);
	if (str) {
		ret.v = JSON.parse(str);
	}
	return 0;
};

ScriptExec.lib['removevalue'] = function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	let key = '';
	if (param[0].v.type === TYPE_ARRAY) {
		key = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		key = ScriptExec.getValueString(param[0].v);
	}
	localStorage.removeItem('pg0_' + _getIoId() +  '_' + key);
	return 0;
};

// Always returns a string ("" when the clipboard cannot be read)
ScriptExec.lib['get_clipboard'] = async function(ei, param, ret) {
	ret.v.str = '';
	ret.v.type = TYPE_STRING;
	delete ret.v.num;
	if (navigator.clipboard && navigator.clipboard.readText) {
		try {
			ret.v.str = await navigator.clipboard.readText();
		} catch (e) {
			console.error(e);
		}
	}
	return 0;
};

// Whether the user is pressing now, as lib/screen.js follows it: a touch or a
// mouse button on the screen, or a key.
function _ioPressing() {
	const touch = ScriptExec.lib['$touch'];
	const key = ScriptExec.lib['$key'];
	return !!((touch && touch.touch) || (key && key.length > 0));
}

// Writes the clipboard while the page handles an action of the user. Safari
// (and so every browser on iOS) lets a page write the clipboard only then,
// and a program calls set_clipboard from its own loop: after the handler of
// the tap it reacted to has returned. So the write is done again from the
// handler of the next such event, which is the end of the press the program
// reacted to. Resolves to whether the text was written; gives up after a
// second, or when the run is stopped.
function _ioWriteOnGesture(str) {
	return new Promise(function(resolve) {
		const events = ['touchend', 'pointerup', 'mouseup', 'click', 'keydown', 'keyup'];
		let done = false;
		const finish = function(ok) {
			if (done) {
				return;
			}
			done = true;
			events.forEach(function(type) {
				document.removeEventListener(type, onGesture, true);
			});
			clearTimeout(timer);
			clearInterval(watch);
			resolve(ok);
		};
		// (an event that does not allow the write is refused too: the next one is tried)
		const onGesture = function() {
			navigator.clipboard.writeText(str).then(function() {
				finish(true);
			}, function() {});
		};
		// (capture: the screen cancels its events, which does not keep them from here)
		events.forEach(function(type) {
			document.addEventListener(type, onGesture, true);
		});
		const timer = setTimeout(function() {
			finish(false);
		}, 1000);
		const watch = setInterval(function() {
			if (!run) {
				finish(false);
			}
		}, 100);
	});
}

ScriptExec.lib['set_clipboard'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	ret.v.num = 0;
	ret.v.type = TYPE_INTEGER;

	let str = '';
	if (param[0].v.type === TYPE_ARRAY) {
		str = ScriptExec.arrayToString(param[0].v.array);
	} else {
		str = ScriptExec.getValueString(param[0].v);
	}
	// 1 only when the text was written
	if (navigator.clipboard && navigator.clipboard.writeText) {
		try {
			await navigator.clipboard.writeText(str);
			ret.v.num = 1;
		} catch (e) {
			// Refused outside an action of the user (Safari, iOS): while the
			// press the program reacted to is still down, write when it ends.
			if (_ioPressing() && await _ioWriteOnGesture(str)) {
				ret.v.num = 1;
			} else {
				console.error(e);
			}
		}
	}
	return 0;
};
