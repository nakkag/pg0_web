"use strict";

ScriptExec.lib['startscreen'] = async function(ei, param, ret) {
	ScriptExec.lib['$oscillators'] = [];

	let _touchstart = 'mousedown';
	let _touchmove = 'mousemove';
	let _touchend = ['mouseup', 'mouseleave'];
	if ('ontouchstart' in window) {
		_touchstart = 'touchstart';
		_touchmove = 'touchmove';
		_touchend = ['touchend'];
	}

	// Touch events
	ScriptExec.lib['$touch'] = {x: 0, y: 0, touch: 0, button: 0, pos: []};
	const _mouseDown = function(e) {
		_mouseMove(e);
		ScriptExec.lib['$touch'].touch = 1;
		ScriptExec.lib['$touch'].button = e.button ? e.button : 0;

		const screen = document.getElementById('lib-screen');
		screen.removeEventListener(_touchmove, _mouseMove, false);
		document.addEventListener(_touchmove, _mouseMove, false);
		_touchend.forEach(function(event) {
			screen.removeEventListener(event, _mouseUp, false);
			document.addEventListener(event, _mouseUp, false);
		});
	};
	const _mouseMove = function(e) {
		e.preventDefault();
		const x = (e.x !== undefined) ? e.x : e.touches[0].clientX;
		const y = (e.y !== undefined) ? e.y : e.touches[0].clientY;
		const rect = document.getElementById('lib-screen').getBoundingClientRect();
		ScriptExec.lib['$touch'].x = (x - rect.left) / ScriptExec.lib['$scale'];
		ScriptExec.lib['$touch'].y = (y - rect.top) / ScriptExec.lib['$scale'];
		ScriptExec.lib['$touch'].pos = [];
		if (e.touches) {
			for (const t of e.touches) {
				ScriptExec.lib['$touch'].pos.push({
					x: (t.clientX - rect.left) / ScriptExec.lib['$scale'],
					y: (t.clientY - rect.top) / ScriptExec.lib['$scale']
				});
			}
		} else {
			ScriptExec.lib['$touch'].pos.push({
				x: (e.x - rect.left) / ScriptExec.lib['$scale'],
				y: (e.y - rect.top) / ScriptExec.lib['$scale']
			});
		}
	};
	const _mouseUp = function(e) {
		e.preventDefault();
		if (e.touches && e.touches.length > 0) {
			return;
		}
		ScriptExec.lib['$touch'].touch = 0;
		ScriptExec.lib['$touch'].button = 0;

		const screen = document.getElementById('lib-screen');
		document.removeEventListener(_touchmove, _mouseMove, false);
		screen.addEventListener(_touchmove, _mouseMove, false);
		_touchend.forEach(function(event) {
			document.removeEventListener(event, _mouseUp, false);
			screen.addEventListener(event, _mouseUp, false);
		});
	};

	// Key events
	ScriptExec.lib['$key'] = [];
	ScriptExec.lib['$keyTimer'] = null;
	const _keyDown = function(e) {
		e.preventDefault();
		if (!ScriptExec.lib['$key'].includes(e.key)) {
			ScriptExec.lib['$key'].push(e.key);
		}
		if (ScriptExec.lib['$keyTimer']) {
			clearTimeout(ScriptExec.lib['$keyTimer']);
		}
		ScriptExec.lib['$keyTimer'] = setTimeout(function() {
			ScriptExec.lib['$keyTimer'] = null;
			ScriptExec.lib['$key'] = [];
		}, 1000);
	};
	const _keyUp = function(e) {
		e.preventDefault();
		ScriptExec.lib['$key'] = ScriptExec.lib['$key'].filter(function(d) {
			return d !== e.key;
		});
	};

	let back = document.getElementById('lib-screen-back');
	if (!back) {
		back = document.createElement('div');
		back.setAttribute('id', 'lib-screen-back');
		back.setAttribute('oncontextmenu', 'return false;');
		back.style.zIndex = 500;
		back.style.backgroundColor = '#eee';
		back.style.position = 'fixed';
		back.style.left = '0';
		back.style.top = '0';
		back.style.width = '100%';
		back.style.height = '100%';
		const pt = {x: 0, y: 0, resize_nw: false, resize_se: false, resize_sw: false};
		back.addEventListener(_touchstart, function(e) {
			if (e.target === back) {
				e.preventDefault();
			}
			if (back.classList.contains('icon')) {
				const rect = back.getBoundingClientRect();
				pt.x = ((e.x !== undefined) ? e.x : e.touches[0].clientX) - rect.left;
				pt.y = ((e.y !== undefined) ? e.y : e.touches[0].clientY) - rect.top;
				pt.resize_nw = (pt.x <= 10 && pt.y <= 10);
				pt.resize_se = (pt.x >= rect.width - 10 && pt.y >= rect.height - 10);
				pt.resize_sw = (pt.x <= 10 && pt.y >= rect.height - 10);
				if (e.target === back || pt.resize_nw || pt.resize_se || pt.resize_sw) {
					document.addEventListener(_touchmove, backTouchMove, false);
					_touchend.forEach(function(event) {
						document.addEventListener(event, backTouchEnd, false);
					});
				}
			}
		}, false);
		const backTouchMove = function(e) {
			e.preventDefault();
			if (pt.resize_nw) {
				const rect = back.getBoundingClientRect();
				const left = ((e.x !== undefined) ? e.x : e.touches[0].clientX);
				const top = ((e.y !== undefined) ? e.y : e.touches[0].clientY);
				let width = (rect.left - ((e.x !== undefined) ? e.x : e.touches[0].clientX) + rect.width);
				if (width < 90) {
					width = 90;
				}
				let height = (rect.top - ((e.y !== undefined) ? e.y : e.touches[0].clientY) + rect.height);
				if (height < 90) {
					height = 90;
				}
				back.style.left = left + 'px';
				back.style.top = top + 'px';
				back.style.width = width + 'px';
				back.style.height = height + 'px';
				back.setAttribute('icon-left', left + 'px');
				back.setAttribute('icon-top', top + 'px');
				back.setAttribute('icon-width', width + 'px');
				back.setAttribute('icon-height', height + 'px');
			} else if (pt.resize_sw) {
				const rect = back.getBoundingClientRect();
				const left = ((e.x !== undefined) ? e.x : e.touches[0].clientX);
				let width = (rect.left - ((e.x !== undefined) ? e.x : e.touches[0].clientX) + rect.width);
				if (width < 90) {
					width = 90;
				}
				let height = (((e.y !== undefined) ? e.y : e.touches[0].clientY) - rect.top);
				if (height < 90) {
					height = 90;
				}
				back.style.left = left + 'px';
				back.style.width = width + 'px';
				back.style.height = height + 'px';
				back.setAttribute('icon-left', left + 'px');
				back.setAttribute('icon-width', width + 'px');
				back.setAttribute('icon-height', height + 'px');
			} else if (pt.resize_se) {
				const rect = back.getBoundingClientRect();
				let width = (((e.x !== undefined) ? e.x : e.touches[0].clientX) - rect.left);
				if (width < 90) {
					width = 90;
				}
				let height = (((e.y !== undefined) ? e.y : e.touches[0].clientY) - rect.top);
				if (height < 90) {
					height = 90;
				}
				back.style.width = width + 'px';
				back.style.height = height + 'px';
				back.setAttribute('icon-width', width + 'px');
				back.setAttribute('icon-height', height + 'px');
			} else {
				const left = (((e.x !== undefined) ? e.x : e.touches[0].clientX) - pt.x);
				const top = (((e.y !== undefined) ? e.y : e.touches[0].clientY) - pt.y);
				back.style.left = left + 'px';
				back.style.top = top + 'px';
				back.setAttribute('icon-left', left + 'px');
				back.setAttribute('icon-top', top + 'px');
			}
			_screenResize();
		};
		const backTouchEnd = function(e) {
			e.preventDefault();
			document.removeEventListener(_touchmove, backTouchMove, false);
			_touchend.forEach(function(event) {
				document.removeEventListener(event, backTouchEnd, false);
			});
		};
		document.body.append(back);
	}
	let screen = document.getElementById('lib-screen');
	if (!screen) {
		screen = document.createElement('canvas');
		screen.setAttribute('id', 'lib-screen');
		screen.setAttribute('oncontextmenu', 'return false;');
		screen.style.zIndex = 501;
		screen.style.backgroundColor = '#fff';
		screen.style.position = 'absolute';
		screen.style.width = '100%';
		screen.style.height = '100%';
		screen.style.setProperty('--top', 'env(safe-area-inset-top)');
		screen.style.setProperty('--bottom', 'env(safe-area-inset-bottom)');
		screen.addEventListener(_touchstart, _mouseDown, false);
		screen.addEventListener(_touchmove, _mouseMove, false);
		_touchend.forEach(function(event) {
			screen.addEventListener(event, _mouseUp, false);
		});
		back.append(screen);
		document.addEventListener('keydown', _keyDown, false);
		document.addEventListener('keyup', _keyUp, false);

		ScriptExec.lib['$offscreen'] = document.createElement('canvas');
	}
	let iconic = document.getElementById('lib-screen-iconic');
	if (!iconic) {
		iconic = document.createElement('div');
		iconic.setAttribute('id', 'lib-screen-iconic');
		iconic.innerHTML = '-';
		iconic.style.zIndex = 502;
		iconic.style.position = 'absolute';
		iconic.style.right = 'calc(env(safe-area-inset-right) + 55px)';
		iconic.style.top = 'env(safe-area-inset-top)';
		iconic.style.fontSize = '40px';
		iconic.style.color = '#808080';
		iconic.style.opacity = '75%';
		iconic.style.cursor = 'pointer';
		iconic.style.userSelect = 'none';
		back.append(iconic);
		let touchIconic = false;
		iconic.addEventListener(_touchstart, function(e) {
			touchIconic = true;
		}, false);
		iconic.addEventListener('mouseleave', function(e) {
			touchIconic = false;
		}, false);
		iconic.addEventListener(_touchend[0], function(e) {
			if (!touchIconic) {
				return;
			}
			touchIconic = false;
			e.preventDefault();
			if (iconic.textContent === '-') {
				const rect = document.getElementById('ctrl-container').getBoundingClientRect();
				iconic.innerHTML = '□';
				iconic.style.fontSize = '30px';
				iconic.style.top = 'calc(env(safe-area-inset-top) + 5px)';
				iconic.style.right = '55px';
				close.style.right = '5px';
				back.classList.add('icon');
				back.style.right = 'env(safe-area-inset-right)';
				if (rect.top > 100) {
					back.style.bottom = `${rect.height}px`;
				} else {
					back.style.bottom = 'env(safe-area-inset-bottom)';
				}
				if (back.getAttribute('icon-left') && back.getAttribute('icon-top')) {
					back.style.left = back.getAttribute('icon-left');
					back.style.top = back.getAttribute('icon-top');
				} else {
					back.style.left = 'unset';
					back.style.top = 'unset';
				}
				if (back.getAttribute('icon-width') && back.getAttribute('icon-height')) {
					back.style.width = back.getAttribute('icon-width');
					back.style.height = back.getAttribute('icon-height');
				} else {
					back.style.width = '200px';
					back.style.height = '240px';
				}
				back.style.outline = '1px solid #aaa';
			} else {
				iconic.innerHTML = '-';
				iconic.style.fontSize = '40px';
				iconic.style.top = 'env(safe-area-inset-top)';
				iconic.style.right = 'calc(env(safe-area-inset-right) + 55px)';
				close.style.right = 'calc(env(safe-area-inset-right) + 5px)';
				back.classList.remove('icon');
				back.style.left = '0';
				back.style.right = 'unset';
				back.style.top = '0';
				back.style.bottom = 'unset';
				back.style.width = '100%';
				back.style.height = '100%';
				back.style.outline = 'unset';
			}
			_screenResize();
		}, false);
	}
	let close = document.getElementById('lib-screen-close');
	if (!close) {
		close = document.createElement('div');
		close.setAttribute('id', 'lib-screen-close');
		close.innerHTML = '×';
		close.style.zIndex = 502;
		close.style.position = 'absolute';
		close.style.right = 'calc(env(safe-area-inset-right) + 5px)';
		close.style.top = 'env(safe-area-inset-top)';
		close.style.fontSize = '40px';
		close.style.color = '#808080';
		close.style.opacity = '75%';
		close.style.cursor = 'pointer';
		close.style.userSelect = 'none';
		back.append(close);
		let touchClose = false;
		close.addEventListener(_touchstart, function(e) {
			touchClose = true;
		}, false);
		close.addEventListener(_touchend[0], function(e) {
			if (touchClose) {
				e.preventDefault();
				stop();
				stopSound();
			}
			touchClose = false;
		}, false);
		close.addEventListener('mouseleave', function(e) {
			touchClose = false;
		}, false);
	}

	if (param.length >= 2) {
		const w = param[0].v.num;
		const h = param[1].v.num;
		screen.style.width = `${w}px`;
		screen.style.height = `${h}px`;
		screen.setAttribute('width', `${w}px`);
		screen.setAttribute('height', `${h}px`);
		ScriptExec.lib['$offscreen'].setAttribute('width', `${w}px`);
		ScriptExec.lib['$offscreen'].setAttribute('height', `${h}px`);
		if (param.length >= 3 && param[2].v.type === TYPE_ARRAY) {
			const color = _getArrayValue(param[2].v.array, 'color');
			if (color) {
				screen.style.backgroundColor = color.v.str;
				ScriptExec.lib['$offscreen'].style.backgroundColor = color.v.str;
			}
		}
	} else if (param.length !== 0 && param[0].v.type === TYPE_ARRAY) {
		const width = _getArrayValue(param[0].v.array, 'width');
		if (width) {
			const w = width.v.num;
			screen.style.width = `${w}px`;
			screen.setAttribute('width', `${w}px`);
			ScriptExec.lib['$offscreen'].setAttribute('width', `${w}px`);
		}
		const height = _getArrayValue(param[0].v.array, 'height');
		if (height) {
			const h = height.v.num;
			screen.style.height = `${h}px`;
			screen.setAttribute('height', `${h}px`);
			ScriptExec.lib['$offscreen'].setAttribute('height', `${h}px`);
		}
		const color = _getArrayValue(param[0].v.array, 'color');
		if (color) {
			screen.style.backgroundColor = color.v.str;
			ScriptExec.lib['$offscreen'].style.backgroundColor = color.v.str;
		}
	}
	window.addEventListener('resize', _screenResize, false);
	window.addEventListener('orientationchange', _screenResize, false);
	_screenResize();

	if (ScriptExec.lib['$i']) {
		clearInterval(ScriptExec.lib['$i']);
	}
	ScriptExec.lib['$i'] = setInterval(function() {
		if (!run) {
			clearInterval(ScriptExec.lib['$i']);
			ScriptExec.lib['$i'] = null;
			ScriptExec.lib['$offscreen'] = null;
			document.getElementById('lib-screen-back').remove();

			window.removeEventListener('resize', _screenResize, false);
			window.removeEventListener('orientationchange', _screenResize, false);
			document.removeEventListener('keydown', _keyDown, false);
			document.removeEventListener('keyup', _keyUp, false);
		}
	}, 100);
	return 0;
};

ScriptExec.lib['sleep'] = async function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let time = 0;
	switch (param[0].v.type) {
	case TYPE_ARRAY:
		const s = ScriptExec.arrayToString(param[0].v.array);
		time = parseInt(ScriptExec.stringToNumber(s));
		break;
	case TYPE_STRING:
		time = parseInt(ScriptExec.stringToNumber(param[0].v.str));
		break;
	default:
		time = parseInt(param[0].v.num);
		break;
	}
	const st = new Date().getTime();
	let en = st;
	while(en - st <= time && run) {
		await new Promise(resolve => setTimeout(resolve, 1));
		en = new Date().getTime();
	}
};

ScriptExec.lib['time'] = function(ei, param, ret) {
	ret.v.type = TYPE_FLOAT;
	ret.v.num = new Date().getTime();
	return 0;
};

ScriptExec.lib['timestring'] = function(ei, param, ret) {
	if (param.length === 0) {
		return -2;
	}
	let time = 0;
	switch (param[0].v.type) {
	case TYPE_ARRAY:
		const s = ScriptExec.arrayToString(param[0].v.array);
		time = parseInt(ScriptExec.stringToNumber(s));
		break;
	case TYPE_STRING:
		time = parseInt(ScriptExec.stringToNumber(param[0].v.str));
		break;
	default:
		time = parseInt(param[0].v.num);
		break;
	}
	const date = new Date(time);
	if (param.length === 1) {
		ret.v.type = TYPE_STRING;
		ret.v.str = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
		return 0;
	}
	let format = param[1].v.str;
	format = format.replace(/YYYY/g, date.getFullYear());
	format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
	format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
	format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
	format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
	format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
	format = format.replace(/M/g, date.getMonth() + 1);
	format = format.replace(/D/g, date.getDate());
	format = format.replace(/h/g, date.getHours());
	format = format.replace(/m/g, date.getMinutes());
	format = format.replace(/s/g, date.getSeconds());
	ret.v.type = TYPE_STRING;
	ret.v.str = format;
	return 0;
};

function getCanvas() {
	if (ScriptExec.lib['$offscreen_flag']) {
		return ScriptExec.lib['$offscreen'];
	}
	return document.getElementById('lib-screen');
}

ScriptExec.lib['startoffscreen'] = async function(ei, param, ret) {
	ScriptExec.lib['$offscreen_flag'] = 1;

	const offScreen = ScriptExec.lib['$offscreen'];
	const osCtx = offScreen.getContext('2d');
	osCtx.drawImage(document.getElementById('lib-screen'), 0, 0);
	return 0;
};

ScriptExec.lib['endoffscreen'] = async function(ei, param, ret) {
	ScriptExec.lib['$offscreen_flag'] = 0;

	const screen = document.getElementById('lib-screen');
	const ctx = screen.getContext('2d');
	ctx.drawImage(ScriptExec.lib['$offscreen'], 0, 0);
	return 0;
};

ScriptExec.lib['drawline'] = async function(ei, param, ret) {
	if (param.length < 4) {
		return -2;
	}
	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	ctx.beginPath();
	ctx.moveTo(param[0].v.num, param[1].v.num);
	ctx.lineTo(param[2].v.num, param[3].v.num);
	ctx.lineWidth = 1;
	ctx.strokeStyle = '#000';
	if (param.length >= 5 && param[4].v.type === TYPE_ARRAY) {
		let vi = _getArrayValue(param[4].v.array, 'width');
		if (vi) {
			ctx.lineWidth = vi.v.num;
		}
		vi = _getArrayValue(param[4].v.array, 'color');
		if (vi) {
			ctx.strokeStyle = vi.v.str;
		}
	}
	ctx.stroke();
};

ScriptExec.lib['drawrect'] = async function(ei, param, ret) {
	if (param.length < 4) {
		return -2;
	}
	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	ctx.beginPath();
	const x = param[0].v.num;
	const y = param[1].v.num;
	const w = param[2].v.num;
	const h = param[3].v.num;
	let color = '#000';
	let width = 1;
	let fill = 0;
	if (param.length >= 5 && param[4].v.type === TYPE_ARRAY) {
		let vi = _getArrayValue(param[4].v.array, 'color');
		if (vi) {
			color = vi.v.str;
		}
		vi = _getArrayValue(param[4].v.array, 'width');
		if (vi) {
			width = vi.v.num;
		}
		vi = _getArrayValue(param[4].v.array, 'fill');
		if (vi) {
			fill = vi.v.num;
		}
	}
	ctx.rect(x, y, w, h);
	ctx.closePath();
	if (fill) {
		ctx.fillStyle = color;
		ctx.fill();
	} else {
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
	}
};

ScriptExec.lib['drawcircle'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	ctx.beginPath();
	const x = param[0].v.num;
	const y = param[1].v.num;
	const radiusX = param[2].v.num;
	let radiusY = radiusX;
	let rotation = 0;
	let startAngle = 0;
	let endAngle = 2 * Math.PI;
	let color = '#000';
	let width = 1;
	let fill = 0;
	if (param.length >= 4 && param[3].v.type === TYPE_ARRAY) {
		let vi = _getArrayValue(param[3].v.array, 'radius_y');
		if (vi) {
			radiusY = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'rotation');
		if (vi) {
			rotation = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'start');
		if (vi) {
			startAngle = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'end');
		if (vi) {
			endAngle = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'color');
		if (vi) {
			color = vi.v.str;
		}
		vi = _getArrayValue(param[3].v.array, 'width');
		if (vi) {
			width = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'fill');
		if (vi) {
			fill = vi.v.num;
		}
	}
	ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle);
	ctx.closePath();
	if (fill) {
		ctx.fillStyle = color;
		ctx.fill();
	} else {
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
	}
};

ScriptExec.lib['drawfill'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	const startX = parseInt(param[0].v.num);
	const startY = parseInt(param[1].v.num);
	let hex = param[2].v.str;
	if (hex[0] === '#') {
		hex = hex.slice(1);
	}
	let rr, gg, bb;
	if (hex.length === 3) {
		rr = hex[0] + hex[0];
		gg = hex[1] + hex[1];
		bb = hex[2] + hex[2];
	} else {
		rr = hex[0] + hex[1];
		gg = hex[2] + hex[3];
		bb = hex[4] + hex[5];
	}
	const fillColor = {r: parseInt(rr, 16), g: parseInt(gg, 16), b: parseInt(bb, 16), a: 255};

	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	const width = parseInt(screen.getAttribute('width'));
	const height = parseInt(screen.getAttribute('height'));

	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;
	const startPos = (startY * width + startX) * 4;
	const startColor = {
		r: data[startPos],
		g: data[startPos + 1],
		b: data[startPos + 2],
		a: data[startPos + 3]
	};
	if (startColor.r === fillColor.r &&
		startColor.g === fillColor.g &&
		startColor.b === fillColor.b &&
		startColor.a === fillColor.a) {
		return;
	}

	function matchStartColor(pixelPos) {
		return data[pixelPos] === startColor.r &&
			data[pixelPos + 1] === startColor.g &&
			data[pixelPos + 2] === startColor.b &&
			data[pixelPos + 3] === startColor.a;
	}
	function colorPixel(pixelPos) {
		data[pixelPos] = fillColor.r;
		data[pixelPos + 1] = fillColor.g;
		data[pixelPos + 2] = fillColor.b;
		data[pixelPos + 3] = fillColor.a;
	}

	const pixelStack = [[startX, startY]];
	while(pixelStack.length) {
		const newPos = pixelStack.pop();
		const x = newPos[0];
		let y = newPos[1];
		let pixelPos = (y * width + x) * 4;
		while(y-- >= 0 && matchStartColor(pixelPos)) {
			pixelPos -= width * 4;
		}
		pixelPos += width * 4;
		++y;
		let reachLeft = false;
		let reachRight = false;
		while(y++ < width - 1 && matchStartColor(pixelPos)) {
			colorPixel(pixelPos);
			if(x > 0) {
				if(matchStartColor(pixelPos - 4)) {
					if(!reachLeft){
						pixelStack.push([x - 1, y]);
						reachLeft = true;
					}
				} else if(reachLeft) {
					reachLeft = false;
				}
			}
			if(x < width - 1) {
				if(matchStartColor(pixelPos + 4)) {
					if(!reachRight) {
						pixelStack.push([x + 1, y]);
						reachRight = true;
					}
				} else if(reachRight) {
					reachRight = false;
				}
			}
			pixelPos += width * 4;
		}
	}
	ctx.putImageData(imageData, 0, 0);
};

ScriptExec.lib['drawscroll'] = async function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	let dx = parseInt(param[0].v.num);
	let dy = parseInt(param[1].v.num);

	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	const width = parseInt(screen.getAttribute('width'));
	const height = parseInt(screen.getAttribute('height'));

	let imageData = ctx.getImageData(0, 0, width, height);
	ctx.clearRect(0, 0, width, height);

	dx = dx % width;
	dy = dy % height;
	ctx.putImageData(imageData, dx, dy);
	ctx.putImageData(imageData, dx - width, dy);
	ctx.putImageData(imageData, dx, dy - height);
	ctx.putImageData(imageData, dx - width, dy - height);
	if (dx !== 0) {
		ctx.putImageData(imageData, dx + (dx > 0 ? -width : width), dy);
	}
	if (dy !== 0) {
		ctx.putImageData(imageData, dx, dy + (dy > 0 ? -height : height));
	}
	if (dx !== 0 && dy !== 0) {
		ctx.putImageData(imageData, dx + (dx > 0 ? -width : width), dy + (dy > 0 ? -height : height));
	}
};

ScriptExec.lib['drawtext'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	let text = '';
	if (param[0].v.type === TYPE_ARRAY) {
		text = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		text = ScriptExec.getValueString(param[0].v);
	}
	const x = param[1].v.num;
	const y = param[2].v.num;
	let color = '#000';
	let width = 1;
	let fill = 1;
	let fontStyle = '';
	let fontSize = 30;
	let fontFace = 'sans-serif';
	if (param.length >= 4 && param[3].v.type === TYPE_ARRAY) {
		let vi = _getArrayValue(param[3].v.array, 'color');
		if (vi) {
			color = vi.v.str;
		}
		vi = _getArrayValue(param[3].v.array, 'width');
		if (vi) {
			width = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'fill');
		if (vi) {
			fill = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'fontstyle');
		if (vi) {
			fontStyle = vi.v.str;
		}
		vi = _getArrayValue(param[3].v.array, 'fontsize');
		if (vi) {
			fontSize = vi.v.num;
		}
		vi = _getArrayValue(param[3].v.array, 'fontface');
		if (vi) {
			fontFace = vi.v.str;
		}
	}
	ctx.font = `${fontStyle} ${fontSize}px ${fontFace}`;
	if (fill) {
		ctx.fillStyle = color;
		ctx.fillText(text, x, y + fontSize);
	} else {
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.strokeText(text, x, y + fontSize);
	}
};

ScriptExec.lib['measuretext'] = async function(ei, param, ret) {
	if (param.length < 1) {
		return -2;
	}
	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	let text = '';
	if (param[0].v.type === TYPE_ARRAY) {
		text = '{' + pg0_string.arrayToString(param[0].v.array) + '}'
	} else {
		text = ScriptExec.getValueString(param[0].v);
	}
	let fontStyle = '';
	let fontSize = 30;
	let fontFace = 'sans-serif';
	if (param.length >= 2 && param[1].v.type === TYPE_ARRAY) {
		let vi = _getArrayValue(param[1].v.array, 'fontstyle');
		if (vi) {
			fontStyle = vi.v.str;
		}
		vi = _getArrayValue(param[1].v.array, 'fontsize');
		if (vi) {
			fontSize = vi.v.num;
		}
		vi = _getArrayValue(param[1].v.array, 'fontface');
		if (vi) {
			fontFace = vi.v.str;
		}
	}
	ctx.font = `${fontStyle} ${fontSize}px ${fontFace}`;
	const mesure = ctx.measureText(text);

	const w = ScriptExec.initValueInfo();
	w.name = 'width';
	w.v.type = TYPE_INTEGER;
	w.v.num = mesure.width;
	const h = ScriptExec.initValueInfo();
	h.name = 'height';
	h.v.type = TYPE_INTEGER;
	h.v.num = mesure.actualBoundingBoxAscent + mesure.actualBoundingBoxDescent;
	ret.v.array = [w, h];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

ScriptExec.lib['rgbtopoint'] = async function(ei, param, ret) {
	if (param.length < 2) {
		return -2;
	}
	const x = param[0].v.num;
	const y = param[1].v.num;

	const screen = getCanvas();
	const ctx = screen.getContext('2d', {willReadFrequently: true});
	const imgData = ctx.getImageData(x, y, 1, 1);
	
	const r = ScriptExec.initValueInfo();
	r.name = 'r';
	r.v.type = TYPE_INTEGER;
	r.v.num = imgData.data[0];
	const g = ScriptExec.initValueInfo();
	g.name = 'g';
	g.v.type = TYPE_INTEGER;
	g.v.num = imgData.data[1];
	const b = ScriptExec.initValueInfo();
	b.name = 'b';
	b.v.type = TYPE_INTEGER;
	b.v.num = imgData.data[2];
	
	ret.v.array = [r, g, b];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

ScriptExec.lib['rgbtohex'] = async function(ei, param, ret) {
	if (param.length === 0 || param[0].v.type !== TYPE_ARRAY) {
		return -2;
	}
	const r = _getArrayValue(param[0].v.array, 'r');
	const g = _getArrayValue(param[0].v.array, 'g');
	const b = _getArrayValue(param[0].v.array, 'b');
	ret.v.type = TYPE_STRING;
	ret.v.str = '#' + [r.v.num, g.v.num, b.v.num].map(function(value) {
		return ('0' + value.toString(16)).slice(-2);
	}).join('');
	return 0;
};

ScriptExec.lib['hextorgb'] = async function(ei, param, ret) {
	if (param.length === 0 || param[0].v.type !== TYPE_STRING) {
		return -2;
	}
	let hex = param[0].v.str;
	if (hex[0] === '#') {
		hex = hex.slice(1);
	}
	let rr, gg, bb;
	if (hex.length === 3) {
		rr = hex[0] + hex[0];
		gg = hex[1] + hex[1];
		bb = hex[2] + hex[2];
	} else {
		rr = hex[0] + hex[1];
		gg = hex[2] + hex[3];
		bb = hex[4] + hex[5];
	}
	const r = ScriptExec.initValueInfo();
	r.name = 'r';
	r.v.type = TYPE_INTEGER;
	r.v.num = parseInt(rr, 16);
	const g = ScriptExec.initValueInfo();
	g.name = 'g';
	g.v.type = TYPE_INTEGER;
	g.v.num = parseInt(gg, 16);
	const b = ScriptExec.initValueInfo();
	b.name = 'b';
	b.v.type = TYPE_INTEGER;
	b.v.num = parseInt(bb, 16);

	ret.v.array = [r, g, b];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

// Touch events
ScriptExec.lib['intouch'] = async function(ei, param, ret) {
	const x = ScriptExec.initValueInfo();
	x.name = 'x';
	x.v.type = TYPE_INTEGER;
	x.v.num = ScriptExec.lib['$touch'].x;
	const y = ScriptExec.initValueInfo();
	y.name = 'y';
	y.v.type = TYPE_INTEGER;
	y.v.num = ScriptExec.lib['$touch'].y;
	const t = ScriptExec.initValueInfo();
	t.name = 'touch';
	t.v.type = TYPE_INTEGER;
	t.v.num = ScriptExec.lib['$touch'].touch;
	const b = ScriptExec.initValueInfo();
	b.name = 'button';
	b.v.type = TYPE_INTEGER;
	b.v.num = ScriptExec.lib['$touch'].button;

	const m = ScriptExec.initValueInfo();
	m.name = 'pos';
	m.v.type = TYPE_ARRAY;
	m.v.array = [];
	ScriptExec.lib['$touch'].pos.forEach(function(pos) {
		const xx = ScriptExec.initValueInfo();
		xx.name = 'x';
		xx.v.type = TYPE_INTEGER;
		xx.v.num = pos.x;
		const yy = ScriptExec.initValueInfo();
		yy.name = 'y';
		yy.v.type = TYPE_INTEGER;
		yy.v.num = pos.y;

		const mm = ScriptExec.initValueInfo();
		mm.v.type = TYPE_ARRAY;
		mm.v.array = [xx, yy];
		m.v.array.push(mm);
	});
	ret.v.array = [x, y, t, b, m];
	ret.v.type = TYPE_ARRAY;
	return 0;
};

// Key events
ScriptExec.lib['inkey'] = async function(ei, param, ret) {
	ret.v.array = [];
	ret.v.type = TYPE_ARRAY;
	ScriptExec.lib['$key'].forEach(function(key) {
		const vi = ScriptExec.initValueInfo();
		vi.v.type = TYPE_STRING;
		vi.v.str = key;
		ret.v.array.push(vi);
	});
	return 0;
};

function _getArrayValue(array, key) {
	const tmp_key = key.toLowerCase();
	return array.find(function(v) {
		return v.name !== '' && tmp_key === v.name.toLowerCase();
	});
}

function convHertz(str) {
	let hertz = 0;
	switch (str.toLowerCase()) {
	case 'c':
		hertz = 262
		break
	case 'd':
		hertz = 294
		break
	case 'e':
		hertz = 330
		break
	case 'f':
		hertz = 350
		break
	case 'g':
		hertz = 392
		break
	case 'a':
		hertz = 440
		break
	case 'b':
		hertz = 494
		break
	}
	return hertz;
}

ScriptExec.lib['playsound'] = async function(ei, param, ret) {
	if (param.length < 3) {
		return -2;
	}
	let hertz = param[0].v.num;
	if (param[0].v.type === TYPE_STRING) {
		hertz = convHertz(param[0].v.str);
	}
	const start = param[1].v.num;
	const end = param[2].v.num;
	let volume = 1.0;
	if (param.length >= 4) {
		volume = param[3].v.num;
	}
	const ctx = new (window.AudioContext || window.webkitAudioContext)();
	const gainNode = ctx.createGain();
	gainNode.gain.value = volume;
	const oscillator = ctx.createOscillator();
	oscillator.type = 'sine';
	oscillator.frequency.setValueAtTime(hertz, ctx.currentTime);
	oscillator.connect(gainNode).connect(ctx.destination);
	oscillator.start(ctx.currentTime + (start / 1000));
	oscillator.stop(ctx.currentTime + (start / 1000) + (end / 1000));
	
	if (!ScriptExec.lib['$oscillators']) {
		ScriptExec.lib['$oscillators'] = [];
	}
	ScriptExec.lib['$oscillators'].push(oscillator);
	setTimeout(function() {
		const index = ScriptExec.lib['$oscillators'].indexOf(oscillator);
		if (index > -1) {
			ScriptExec.lib['$oscillators'].splice(index, 1);
		}
	}, end);
	return 0;
};

function stopSound() {
	ScriptExec.lib['$oscillators'].forEach(function(oscillator) {
		oscillator.stop();
	});
	ScriptExec.lib['$oscillators'] = [];
}
ScriptExec.lib['stopsound'] = async function(ei, param, ret) {
	stopSound();
	return 0;
}

function _screenResize() {
	const screen = document.getElementById('lib-screen');
	if (!screen) {
		return;
	}
	const width = parseInt(getComputedStyle(screen).width);
	const height = parseInt(getComputedStyle(screen).height);

	const top = parseInt(window.getComputedStyle(screen).getPropertyValue('--top'));
	const bottom = parseInt(window.getComputedStyle(screen).getPropertyValue('--bottom'));
	const back = document.getElementById('lib-screen-back');
	const rect = back.getBoundingClientRect();

	screen.style.left = `calc(50% - ${width}px / 2)`;
	let windowHeight;
	if (back.classList.contains('icon')) {
		screen.style.top = `calc(50% - ${height}px / 2 + 20px)`;
		windowHeight = rect.height - 40;
	} else {
		screen.style.top = `calc(50% - ${height}px / 2 + env(safe-area-inset-top) - ${(top + bottom) / 2}px)`;
		windowHeight = rect.height - top - bottom;
	}
	if (width < rect.width && height < windowHeight) {
		screen.style.transform = 'unset';
		ScriptExec.lib['$scale'] = 1;
		return;
	}
	ScriptExec.lib['$scale'] = rect.width / width;
	if (height * ScriptExec.lib['$scale'] > windowHeight) {
		ScriptExec.lib['$scale'] = windowHeight / height;
	}
	screen.style.transform = `scale(${ScriptExec.lib['$scale']}, ${ScriptExec.lib['$scale']})`;
}
