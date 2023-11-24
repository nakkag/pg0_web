"use strict";

function variableView(variable) {
	const that = this;

	let verX = 200;
	const _rw = window.getComputedStyle(document.body).getPropertyValue('--resize-with');
	let rw = parseInt(_rw.replace(/[^0-9]/g, ''));
	const ua = user_agent.get();
	if (ua.isiOS || ua.isAndroid) {
		rw = 20;
	}

	this.init = function() {
		document.querySelector('#' + variable.id + ' #var_name').innerHTML = `<div class="var_header">${runMsg.VARIABLE_NAME}</div>`;
		document.querySelector('#' + variable.id + ' #var_value').innerHTML = `<div class="var_header">${runMsg.VARIABLE_VALUE}</div>`;
	};

	this.clear = function() {
		that.init();
	}

	this.set = function(ei) {
		that.clear();
		setVariable(ei);
	};

	function setVariable(ei) {
		if (!ei) {
			return;
		}
		setVariable(ei.parent);
		for (let key in ei.vi) {
			const v = ei.vi[key];
			let buf;
			if (v.type === TYPE_ARRAY) {
				buf = '{' + pg0_string.arrayToString(v.array) + '}'
			} else if (v.type === TYPE_STRING) {
				buf = '"' + ScriptExec.getValueString(v) + '"'
			} else {
				buf = ScriptExec.getValueString(v);
			}
			const name = document.createElement('div');
			name.textContent = key;
			document.querySelector('#' + variable.id + ' #var_name').appendChild(name);
			const val = document.createElement('div');
			val.textContent = buf;
			document.querySelector('#' + variable.id + ' #var_value').appendChild(val);
		}
	}

	let touchstart = 'mousedown';
	let touchmove = 'mousemove';
	let touchend = ['mouseup', 'mouseleave'];
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
		touchmove = 'touchmove';
		touchend = ['touchend'];
	}
	let resizeFunc;

	document.getElementById('var_resizer').addEventListener(touchstart, function(e) {
		if (e.cancelable) {
			e.preventDefault();
		}
		let x = e.x ? e.x : e.touches[0].clientX;
		resizeFunc = function(e) {
			const ex = e.x ? e.x : e.touches[0].clientX;
			verX -= x - ex;
			if (verX < 50) {
				verX = 50;
			} else {
				x = ex;
			}
			variable.style.gridTemplateColumns = `${verX}px ${rw}px max-content`;
		};
		document.addEventListener(touchmove, resizeFunc, false);
	}, false);

	touchend.forEach(function(e) {
		document.addEventListener(e, function() {
			if (resizeFunc) {
				document.removeEventListener(touchmove, resizeFunc, false);
			}
		}, false);
	});
}
