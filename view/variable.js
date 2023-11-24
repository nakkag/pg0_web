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
	};

	this.set = function(ei) {
		that.clear();
		setVariable(ei);
		setEvents();
	};

	let touchstart = 'mousedown';
	let touchmove = 'mousemove';
	let touchend = ['mouseup', 'mouseleave'];
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
		touchmove = 'touchmove';
		touchend = ['touchend'];
	}
	let resizeFunc = null;

	document.querySelector('#' + variable.id + ' #var_resizer').addEventListener(touchstart, function(e) {
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
				resizeFunc = null;
			}
		}, false);
	});

	function unselect() {
		document.querySelectorAll('.var_select').forEach(function(target) {
			target.classList.remove('var_select');
		});
	}
	function setEvent(target, index) {
		target.addEventListener('click', function(e) {
			if (e.target.classList.contains('open_icon')) {
				return;
			}
			const nameNode = document.querySelector('#' + variable.id + ' #var_name').childNodes[index + 1];
			const valNode = document.querySelector('#' + variable.id + ' #var_value').childNodes[index + 1];
			if (nameNode.classList.contains('var_select')) {
				unselect();
				return;
			}
			unselect();
			nameNode.classList.add('var_select');
			valNode.classList.add('var_select');
		});
		target.addEventListener('dblclick', function(e) {
			const nameNode = document.querySelector('#' + variable.id + ' #var_name').childNodes[index + 1];
			const valNode = document.querySelector('#' + variable.id + ' #var_value').childNodes[index + 1];
			unselect();
			nameNode.classList.add('var_select');
			valNode.classList.add('var_select');
			const str = nameNode.textContent + ' = ' + valNode.textContent;
			if (navigator.clipboard) {
				return navigator.clipboard.writeText(str);
			}
		});
	}
	function setOpenEvent(target, index) {
		target.addEventListener('click', function(e) {
			e.preventDefault();
			openVarTree(index);
		});
	}
	function setEvents() {
		document.querySelectorAll('.item_name').forEach(setEvent);
		document.querySelectorAll('.item_val').forEach(setEvent);
		document.querySelectorAll('.open_icon').forEach(setOpenEvent);
	}

	function openVarTree(index) {
		const node = document.querySelector('#' + variable.id + ' #var_name').childNodes[index + 1];
		if (!node.classList.contains('array')) {
			return;
		}
		const open = node.classList.contains('open');
		if (open) {
			node.classList.remove('open');
		} else {
			node.classList.add('open');
		}
		const indent = parseInt(node.getAttribute('indent'));
		const count = document.querySelector('#' + variable.id + ' #var_name').childNodes.length;
		showVarTree(index + 2, count, !open, indent + 1);
		if (window.getSelection) {
			window.getSelection().removeAllRanges();
		}
	}
	function showVarTree(index, count, open, indent) {
		let j = index;
		for (; j < count; j++) {
			const nameNode = document.querySelector('#' + variable.id + ' #var_name').childNodes[j];
			const valNode = document.querySelector('#' + variable.id + ' #var_value').childNodes[j];
			const nextIndent = parseInt(nameNode.getAttribute('indent'));
			if (nextIndent < indent) {
				return j - 1;
			}
			if (!open) {
				nameNode.style.display = 'none';
				valNode.style.display = 'none';
			} else {
				nameNode.style.display = 'block';
				valNode.style.display = 'block';
			}
			if (nameNode.classList.contains('array')) {
				const op = (!open) ? false : nameNode.classList.contains('open');
				j = showVarTree(j + 1, count, op, indent + 1);
			}
		}
		return j;
	}

	function setVariable(ei) {
		if (!ei) {
			return;
		}
		setVariable(ei.parent);
		for (let key in ei.vi) {
			setValueInfo(key, ei.vi[key], 0);
		}
	}
	
	function setValueInfo(key, v, indent) {
		let buf;
		if (v.type === TYPE_ARRAY) {
			buf = '{' + pg0_string.arrayToString(v.array) + '}';
		} else if (v.type === TYPE_STRING) {
			buf = '"' + ScriptExec.getValueString(v) + '"';
		} else {
			buf = ScriptExec.getValueString(v);
		}
		const name = document.createElement('div');
		name.classList.add('item_name');
		name.setAttribute('indent', indent);
		name.style.textIndent = (indent * 20) + 'px';

		const pspan = document.createElement('span');
		name.appendChild(pspan);
		let span = document.createElement('span');
		span.classList.add('open_icon');
		pspan.appendChild(span);
		span = document.createElement('span');
		span.textContent = key;
		pspan.appendChild(span);
		document.querySelector('#' + variable.id + ' #var_name').appendChild(name);

		const val = document.createElement('div');
		val.classList.add('item_val');
		val.textContent = buf;
		val.setAttribute('indent', indent);
		document.querySelector('#' + variable.id + ' #var_value').appendChild(val);

		if (indent !== 0) {
			name.style.display = 'none';
			val.style.display = 'none';
		}
		if (v.type === TYPE_ARRAY) {
			name.classList.add('array');
			v.array.forEach(function(a, i) {
				setValueInfo(a.name || i, a.v, indent + 1);
			});
		}
	}
}
