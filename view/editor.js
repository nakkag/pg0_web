function getEditorText() {
	const lines = document.getElementById('editor').getElementsByClassName('line');
	let buf = '';
	for (let i = 0; i < lines.length; i++) {
		if (buf) {
			buf += "\n";
		}
		buf += lines[i].textContent;
	}
	return buf;
}

document.addEventListener('DOMContentLoaded', function() {
	const editor = document.getElementById('editor');
	const hidden = document.getElementById('hidden_container');
	const textarea = document.getElementById('hidden-textarea');
	const keywords = ['if', 'for', 'while'];
	const caret = document.createElement('div');
	caret.className = 'caret';
	caret.style.display = 'block';
	editor.appendChild(caret);
	let caretPosition = 0;
	let currentLine = 0;
	let currentColumn = 0;
	let isDragging = false;
	let dragStartLine = 0;
	let dragEndLine = 0;
	let dragStartChar = 0;
	let dragEndChar = 0;
	let inputFlag = false;
	let inputFront = '';
	let inputBack = '';

	function initInput() {
		inputFlag = false;
		textarea.value = '';
	}

	function setLine(line, text) {
		const lines = editor.getElementsByClassName('line');
		lines[line].innerHTML = text.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), 
			(match) => `<span class="keyword">${match}</span>`);
		if (!lines[line].innerHTML) {
			lines[line].innerHTML = '<span></span>'
		}
	}

	function updateEditor() {
		const text = textarea.value;
		let lines = editor.getElementsByClassName('line');
		if (lines.length <= currentLine) {
			for (let i = lines.length; i <= currentLine; i++) {
				editor.appendChild(createLineElement(''));
			}
			lines = editor.getElementsByClassName('line');
		}
		if (!inputFlag) {
			if (text) {
				inputFlag = true;
				inputFront = lines[currentLine].textContent.substr(0, currentColumn);
				inputBack = lines[currentLine].textContent.substr(currentColumn);
			} else {
				return;
			}
		}
		const newLine = inputFront + text + inputBack;
		setLine(currentLine, newLine);
		currentColumn = inputFront.length + text.length;
		updateCaret();
	}

	function getCaretPixelPosition() {
		const lines = editor.getElementsByClassName('line');
		const currentLineText = lines[currentLine].textContent.substr(0, currentColumn);
		const context = document.createElement('canvas').getContext('2d');
		context.font = getComputedStyle(editor).font;

		const text = currentLineText.split('');
		let pixelPosition = 0;
		let currentPosition = 0;
		const tabSize = 4;
		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\t') {
				const spacesToNextTabStop = tabSize - (currentPosition % tabSize);
				currentPosition += spacesToNextTabStop;
				pixelPosition += context.measureText(' '.repeat(spacesToNextTabStop)).width;
			} else {
				currentPosition++;
				pixelPosition += context.measureText(text[i]).width;
			}
		}
		return pixelPosition;
	}

	function updateCaret() {
		const pixelPosition = getCaretPixelPosition();
		const lineDivs = editor.getElementsByClassName('line');
		if (currentLine < lineDivs.length) {
			const lineDiv = lineDivs[currentLine];
			caret.style.height = `${lineDiv.offsetHeight}px`;
			caret.style.top = `${lineDiv.offsetTop}px`;
			caret.style.left = `${lineDiv.offsetLeft + pixelPosition}px`;
			if (!caret.parentElement) editor.appendChild(caret);
			hidden.style.top = caret.style.top;
			hidden.style.left = caret.style.left;
			textarea.style.top = caret.style.top;
			textarea.style.left = caret.style.left;
			textarea.style.height = caret.style.height;
		}
	}

	function createLineElement(text) {
		const line = document.createElement('div');
		line.className = 'line';
		line.innerHTML = text.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), 
			(match) => `<span class="keyword">${match}</span>`);
		if (!line.innerHTML) {
			line.innerHTML = '<span></span>'
		}
		return line;
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

	function updateSelection() {
		const lines = editor.getElementsByClassName('line');
		const selection = window.getSelection();
		const range = new Range();
		const startNode = lines[dragStartLine].childNodes[0];
		const endNode = lines[dragEndLine].childNodes[0];
		if (!startNode || !endNode) {
			return;
		}
		if (dragStartLine < dragEndLine || (dragStartLine === dragEndLine && dragStartChar < dragEndChar)) {
			range.setStart(startNode, dragStartChar);
			range.setEnd(endNode, dragEndChar);
		} else {
			range.setStart(endNode, dragEndChar);
			range.setEnd(startNode, dragStartChar);
		}
		selection.removeAllRanges();
		selection.addRange(range);
	}

	function getLineCharIndexFromClick(e) {
		const lineDivs = editor.getElementsByClassName('line');
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
		const lines = editor.getElementsByClassName('line');
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
		if (wordStart === wordEnd) {
			wordStart = charIndex;
			wordEnd = charIndex + 1;
		}
		dragStartLine = dragEndLine = currentLine = lineIndex;
		dragStartChar = wordStart;
		dragEndChar = currentColumn = wordEnd;
		updateSelection();
		updateCaret();
	}

	function selectLineAtClick(e) {
		const lines = editor.getElementsByClassName('line');
		const { lineIndex } = getLineCharIndexFromClick(e);
		dragStartLine = dragEndLine = currentLine = lineIndex;
		dragStartChar = 0;
		dragEndChar = currentColumn = lines[lineIndex].textContent.length;
		updateSelection();
		updateCaret();
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

	function startTextSelection(e) {
		const lines = editor.getElementsByClassName('line');
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		dragStartLine = dragEndLine = currentLine = lineIndex;
		dragStartChar = dragEndChar = currentColumn = charIndex;
		updateCaret();
		initInput();
		window.getSelection().removeAllRanges();
	}

	function updateTextSelection(e) {
		const lines = editor.getElementsByClassName('line');
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		dragEndLine = currentLine = lineIndex;
		dragEndChar = currentColumn = charIndex;
		updateSelection();
		updateCaret();
		initInput();
	}

	function deselection() {
		window.getSelection().removeAllRanges();
		dragStartLine = dragEndLine = currentLine;
		dragStartChar = dragEndChar = currentColumn;
		updateCaret();
	}

	function deleteSelection() {
		if (dragStartLine === dragEndLine && dragStartChar === dragEndChar) {
			return;
		}
		window.getSelection().removeAllRanges();
		const lines = editor.getElementsByClassName('line');
		let stl, enl, stc, enc;
		if (dragStartLine < dragEndLine || (dragStartLine === dragEndLine && dragStartChar < dragEndChar)) {
			stl = dragStartLine;
			enl = dragEndLine;
			stc = dragStartChar;
			enc = dragEndChar;
		} else {
			stl = dragEndLine;
			enl = dragStartLine;
			stc = dragEndChar;
			enc = dragStartChar;
		}
		if (stl === enl) {
			const str = lines[stl].textContent.substr(0, stc) + lines[stl].textContent.substr(enc)
			setLine(stl, str);
		} else {
			setLine(enl, lines[enl].textContent.substr(enc));
			for (let i = enl - 1; i < stl + 1; i--) {
				lines[enl].remove();
			}
			setLine(stl, lines[stl].textContent.substr(0, stc));
		}
		dragStartLine = dragEndLine = stl;
		dragStartChar = dragEndChar = stc;
		currentLine = stl;
		currentColumn = stc;
		updateCaret();
		textarea.focus();
	}

	let touchstart = 'mousedown';
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
	}
	editor.addEventListener(touchstart, function(e) {
		if (isDragging) {
			return;
		}
		if (touchstart === 'mousedown') {
			if (e.button === 0) {
				isDragging = true;
				startTextSelection(e);
				checkClick(e, 5);
				document.addEventListener('mousemove', mousemove);
				document.addEventListener('mouseup', mouseup);
			}
		} else {
			isDragging = true;
			const touch = e.touches[0];
			startTextSelection(touch);
			checkClick(touch, 10);
			document.addEventListener('touchmove', touchmove);
			document.addEventListener('touchend', touchend);
		}
	}, false);
	const mousemove = function(e) {
		if (isDragging) {
			updateTextSelection(e);
		}
	};
	const mouseup = function(e) {
		if (isDragging) {
			isDragging = false;
			document.removeEventListener('mousemove', mousemove);
			document.removeEventListener('mouseup', mouseup);
			textarea.focus();
		}
	};
	const touchmove = function(e) {
		if (isDragging) {
			updateTextSelection(e.touches[0]);
		}
	};
	const touchend = function(e) {
		if (isDragging) {
			isDragging = false;
			document.removeEventListener('touchmove', touchmove);
			document.removeEventListener('touchend', touchend);
			textarea.focus();
		}
	};

	textarea.addEventListener('input', function() {
		updateEditor();
	}, false);

	textarea.addEventListener('keydown', function(e) {
		const lines = editor.getElementsByClassName('line');
		if (e.key === 'Tab') {
			e.preventDefault();
			deleteSelection();
			textarea.value += '\t';
			updateEditor();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			initInput();
			const frontStr = lines[currentLine].textContent.substr(0, currentColumn);
			const backStr = lines[currentLine].textContent.substr(currentColumn);
			setLine(currentLine, frontStr);
			lines[currentLine].after(createLineElement(backStr));
			currentLine++;
			currentColumn = 0;
			updateCaret();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			if (dragStartLine !== dragEndLine || dragStartChar !== dragEndChar) {
				if (dragStartLine < dragEndLine || (dragStartLine === dragEndLine && dragStartChar < dragEndChar)) {
					currentLine = dragStartLine;
					currentColumn = dragStartChar;
				} else {
					currentLine = dragEndLine;
					currentColumn = dragEndChar;
				}
				dragStartLine = dragEndLine = currentLine;
				dragStartChar = dragEndChar = currentColumn;
				updateSelection();
				updateCaret();
				initInput();
				return;
			}
			initInput();
			currentColumn--;
			if (currentColumn < 0) {
				currentLine--;
				if (currentLine < 0) {
					currentLine = 0;
					currentColumn = 0;
				} else {
					currentColumn = lines[currentLine].textContent.length;
				}
			}
			updateCaret();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			if (dragStartLine !== dragEndLine || dragStartChar !== dragEndChar) {
				if (dragStartLine < dragEndLine || (dragStartLine === dragEndLine && dragStartChar < dragEndChar)) {
					currentLine = dragEndLine;
					currentColumn = dragEndChar;
				} else {
					currentLine = dragStartLine;
					currentColumn = dragStartChar;
				}
				dragStartLine = dragEndLine = currentLine;
				dragStartChar = dragEndChar = currentColumn;
				updateSelection();
				updateCaret();
				initInput();
				return;
			}
			initInput();
			currentColumn++;
			if (currentColumn > lines[currentLine].textContent.length) {
				currentLine++;
				if (currentLine > lines.length - 1) {
					currentLine = lines.length - 1;
					currentColumn = lines[currentLine].textContent.length;
				} else {
					currentColumn = 0;
				}
			}
			updateCaret();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			deselection();
			initInput();
			currentLine--;
			if (currentLine < 0) {
				currentLine = 0;
			}
			updateCaret();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			deselection();
			initInput();
			currentLine++;
			if (currentLine > lines.length - 1) {
				currentLine = lines.length - 1;
			}
			updateCaret();
		} else {
			deleteSelection();
		}
	}, false);

	document.getElementById('editor_container').addEventListener('focus', function(e) {
		textarea.focus();
	}, false);

	updateEditor();
}, false);

