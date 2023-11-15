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
		lines[currentLine].innerHTML = newLine.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), 
			(match) => `<span class="keyword">${match}</span>`);
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
		return line;
	}

	function setCaretPosition() {
		//caretPosition = textarea.selectionStart;
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

	function getTextAreaIndexFromLineAndChar(lines, lineIndex, charIndex) {
		let textAreaIndex = 0;
		for (let i = 0; i < lineIndex; i++) {
			textAreaIndex += lines[i].textContent.length + 1;
		}
		return textAreaIndex + charIndex;
	}

	function getLineCharIndexFromClick(e) {
		const lineDivs = editor.getElementsByClassName('line');
		const lines = editor.getElementsByClassName('line');

		const editorRect = editor.getBoundingClientRect();
		let clickX = e.clientX - editorRect.left;
		if (clickX < 0) {
			clickX = 0;
		}
		let clickY = e.clientY - editorRect.top;
		if (clickY < 0) {
			clickY = 0;
		}
		const lineIndex = Math.min(Math.floor(clickY / lineDivs[0].offsetHeight), lines.length - 1);
		const line = lines[lineIndex];
		const charIndex = getCharIndexAtClick(line.textContent, clickX);
		return { lineIndex, charIndex };
	}

	function selectWordAtClick(e) {
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		const lineText = textarea.value.split('\n')[lineIndex];
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
		const lines = editor.getElementsByClassName('line');
		const start = getTextAreaIndexFromLineAndChar(lines, lineIndex, wordStart);
		const end = getTextAreaIndexFromLineAndChar(lines, lineIndex, wordEnd);
		textarea.setSelectionRange(start, end);
		caretPosition = end;
		dragStartLine = lineIndex;
		dragStartChar = wordStart;
		updateSelection();
		updateCaret();
	}

	function selectLineAtClick(e) {
		const { lineIndex } = getLineCharIndexFromClick(e);
		const lines = textarea.value.split('\n');
		const start = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
		const end = start + lines[lineIndex].length;
		textarea.setSelectionRange(start, end);
		caretPosition = end;
		dragStartLine = lineIndex;
		dragStartChar = 0;
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
		dragStartLine = dragEndLine = lineIndex;
		dragStartChar = dragEndChar = charIndex;
		currentLine = lineIndex;
		currentColumn = charIndex;
		updateCaret();
		window.getSelection().removeAllRanges();
		initInput();
	}

	function updateTextSelection(e) {
		const lines = editor.getElementsByClassName('line');
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		dragEndLine = lineIndex;
		dragEndChar = charIndex;
		currentLine = lineIndex;
		currentColumn = charIndex;
		updateSelection();
		updateCaret();
		initInput();
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
				document.addEventListener('mousemove', mousemove)
				document.addEventListener('mouseup', mouseup)
			}
		} else {
			isDragging = true;
			const touch = e.touches[0];
			startTextSelection(touch);
			checkClick(touch, 10);
			document.addEventListener('touchmove', touchmove)
			document.addEventListener('touchend', touchend)
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
			document.removeEventListener('mousemove', mousemove)
			document.removeEventListener('mouseup', mouseup)
		}
	};
	const touchmove = function(e) {
		if (isDragging) {
			const touch = e.touches[0];
			updateTextSelection(touch);
		}
	};
	const touchend = function(e) {
		if (isDragging) {
			isDragging = false;
			const touch = e.touches[0];
			document.removeEventListener('touchmove', touchmove)
			document.removeEventListener('touchend', touchend)
		}
	};

	textarea.addEventListener('input', function() {
		updateEditor();
	}, false);

	textarea.addEventListener('keydown', function(e) {
		const isNavigationKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
		if (isNavigationKey) {
			e.preventDefault();
			setTimeout(function() {
				setCaretPosition();
				updateSelection();
				updateCaret();
			}, 0);
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
			textarea.selectionStart = textarea.selectionEnd = start + 1;
			updateEditor();
		}
	}, false);

	document.getElementById('editor_container').addEventListener('focus', function(e) {
		if (dragStartLine === dragEndLine && dragStartChar === dragEndChar) {
			textarea.focus();
		}
	}, false);

	updateEditor();
}, false);

