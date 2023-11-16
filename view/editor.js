function getEditorText() {
	const lines = editor.childNodes;
	let buf = '';
	for (let i = 0; i < lines.length; i++) {
		if (buf) {
			buf += "\n";
		}
		buf += lines[i].textContent;
	}
	return buf;
}

function unsetHighlight() {
	const editor = document.getElementById('editor');
	const lines = editor.childNodes;
	for (let i = 0; i < lines.length; i++) {
		if (editor.childNodes[i].style && editor.childNodes[i].textContent) {
			editor.childNodes[i].style.backgroundColor = 'transparent';
		}
	}
}

function setHighlight(line, color) {
	const editor = document.getElementById('editor');
	unsetHighlight();
	if (editor.childNodes[line].style && editor.childNodes[i].textContent) {
		editor.childNodes[line].style.backgroundColor = color;
	}
	const element = editor.childNodes[line];
	const targetDOMRect = element.getBoundingClientRect();
	if (element.offsetTop < editor.scrollTop || element.offsetTop + element.offsetHeight > editor.scrollTop + editor.clientHeight) {
		element.scrollIntoView({behavior: 'instant'});
	}
}

document.addEventListener('DOMContentLoaded', function() {
	const editor = document.getElementById('editor');
	const hidden = document.getElementById('hidden_container');
	const keywords = ['var', 'if', 'switch', 'case', 'default', 'for', 'while', 'do', 'break', 'continue', 'function', 'return', 'exit', 'option', 'import'];

	function setLine(linePos, text) {
		const line = document.createElement('div');
		line.innerHTML = text.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi'), 
			(match) => `<span class="keyword">${match}</span>`);
		editor.childNodes[linePos].replaceWith(line);
	}

	function getFocusLine() {
		const lines = editor.childNodes;
		const selection = window.getSelection();
		for (let i = 0; i < lines.length; i++) {
			if (lines[i] === selection.focusNode.parentNode) {
				return i;
			}
		}
		return lines.length - 1;
	}

	let editLine = 0;
	function setEditLine() {
		const linePos = getFocusLine();
		if (linePos !== editLine && linePos >= 0) {
			if (editLine >= editor.childNodes.length) {
				editLine = linePos;
				return;
			}
			const str = editor.childNodes[editLine].textContent;
			if (str) {
				let bcolor = '';
				if (editor.childNodes[editLine].style) {
					bcolor = editor.childNodes[editLine].style.backgroundColor;
				}
				setLine(editLine, str);
				if (bcolor) {
					editor.childNodes[editLine].style.backgroundColor = bcolor;
				}
			}
			editLine = linePos;
		}
	}

	function setAllLine() {
		for (let i = 0; i < editor.childNodes.length; i++) {
			const line = editor.childNodes[i];
			if (line.textContent) {
				if (line.textContent.indexOf("\n") >= 0) {
					const lines = line.textContent.split('\n');
					setLine(i, lines[0]);
					for (let j = lines.length - 1; j > 0; j--) {
						const nl = document.createElement('div');
						if (lines[j]) {
							nl.textContent = lines[j];
						} else {
							nl.innerHTML = '<br />';
						}
						editor.childNodes[i].after(nl);
					}
				} else {
					setLine(i, line.textContent);
				}
			}
		}
	}

	function getTextMetrics(text) {
		const context = document.createElement('canvas').getContext('2d');
		context.font = getComputedStyle(editor).font;
		let currentPosition = 0;
		const tabSize = 4;
		return text.split('').map(char => {
			if (char === '\t') {
				const spacesToNextTabStop = tabSize - (currentPosition % tabSize);
				currentPosition += spacesToNextTabStop;
				return context.measureText(' '.repeat(spacesToNextTabStop)).width;
			} else {
				currentPosition++;
				return context.measureText(char).width;
			}
		});
	}

	function getCharIndexAtClick(lineText, clickX) {
		const charWidths = getTextMetrics(lineText);
		let totalWidth = 0;
		let charIndex;

		for (charIndex = 0; charIndex < lineText.length; charIndex++) {
			const halfCharWidth = charWidths[charIndex] / 2;
			totalWidth += charWidths[charIndex];
			if ((totalWidth - halfCharWidth) >= clickX) {
				break;
			}
		}
		return charIndex;
	}

	function getLineCharIndexFromClick(e) {
		const lineDivs = editor.childNodes;
		const editorRect = editor.getBoundingClientRect();
		let clickX = e.clientX - editorRect.left;
		if (clickX < 0) {
			clickX = 0;
		}
		let clickY = e.clientY - editorRect.top;
		if (clickY < 0) {
			clickY = 0;
		}
		const lineIndex = Math.min(Math.floor(clickY / lineDivs[0].offsetHeight), lineDivs.length - 1);
		const line = lineDivs[lineIndex];
		const charIndex = getCharIndexAtClick(line.textContent, clickX);
		return { lineIndex, charIndex };
	}

	function selectWordAtClick(e) {
		const lines = editor.childNodes;
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		const lineText = lines[lineIndex].textContent;
		let wordStart = charIndex;
		let wordEnd = charIndex;
		while (wordStart > 0 && /[^\s\(\)\[\]{}+\-\*\/%\!~<>=\&\|\^\"\',\\:;#]/.test(lineText[wordStart - 1])) {
			wordStart--;
		}
		while (wordEnd < lineText.length && /[^\s\(\)\[\]{}+\-\*\/%\!~<>=\&\|\^\"\',\\:;#]/.test(lineText[wordEnd])) {
			wordEnd++;
		}
		if (wordStart === wordEnd && lineText) {
			wordStart = charIndex;
			wordEnd = charIndex + 1;
		}
		if (wordStart >= lineText.length) {
			wordStart = lineText.length - 1;
		}
		if (wordEnd >= lineText.length) {
			wordEnd = lineText.length - 1;
		}
		const selection = window.getSelection();
		const range = new Range();
		range.setStart(lines[lineIndex].childNodes[0], wordStart);
		range.setEnd(lines[lineIndex].childNodes[0], wordEnd);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	function selectLineAtClick(e) {
		const lines = editor.childNodes;
		const { lineIndex } = getLineCharIndexFromClick(e);
		const selection = window.getSelection();
		const range = new Range();
		range.setStart(lines[lineIndex].childNodes[0], 0);
		range.setEnd(lines[lineIndex].childNodes[0], lines[lineIndex].textContent.length);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	let lastClickTime = 0;
	let clickCount = 0;
	let oldEvent;
	function checkClick(e, area) {
		if (oldEvent &&
			(oldEvent.clientX < e.clientX - area || oldEvent.clientX > e.clientX + area ||
			oldEvent.clientY < e.clientY - area || oldEvent.clientY > e.clientY + area)) {
			clickCount = 0;
		}
		oldEvent = e;
		const clickTime = Date.now();
		if (lastClickTime && clickTime - lastClickTime < 400) {
			clickCount++;
		} else {
			clickCount = 1;
		}
		lastClickTime = clickTime;
		if (clickCount === 2) {
			selectWordAtClick(e);
		} else if (clickCount === 3) {
			selectLineAtClick(e);
			clickCount = 0;
		}
	}

	let touchstart = 'mousedown';
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
	}
	editor.addEventListener(touchstart, function(e) {
		editor.focus();
		if (touchstart === 'mousedown') {
			if (e.button === 0) {
				checkClick(e, 5);
				document.addEventListener('mouseup', touchend);
			}
		} else {
			const touch = e.touches[0];
			checkClick(touch, 10);
			document.addEventListener('touchend', touchend);
		}
	}, false);
	const touchend = function(e) {
		document.removeEventListener('touchend', touchend)
		setEditLine();
	};

	let lineCount = 0;
	editor.addEventListener('input', function() {
		unsetHighlight();
		if (lineCount !== editor.childNodes.length) {
			lineCount = editor.childNodes.length;
			setAllLine();
		}
	}, false);

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const selection = window.getSelection();
			const linePos = getFocusLine();
			const charPos = selection.focusOffset;
			let str = editor.childNodes[linePos].textContent;
			str = str.substr(0, charPos) + '\t' + str.substr(charPos);
			setLine(linePos, str);

			const range = new Range();
			range.setStart(editor.childNodes[linePos].firstChild, charPos + 1);
			range.setEnd(editor.childNodes[linePos].firstChild, charPos + 1);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}, false);

	editor.addEventListener('keyup', function(e) {
		setEditLine();
	}, false);
}, false);
