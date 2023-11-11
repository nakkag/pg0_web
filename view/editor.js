document.addEventListener('DOMContentLoaded', function() {
	const editor = document.getElementById('editor');
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
	let dragStartChar = 0;

	function updateEditor() {
		const lines = textarea.value.split('\n');
		editor.innerHTML = '';
		lines.forEach(line => {
			editor.appendChild(createLineElement(line));
		});
		updateSelection();
		updateCaret();
	}

	function getCaretPixelPosition(textarea, caretPosition) {
		const lines = textarea.value.substring(0, caretPosition).split('\n');
		const currentLineText = lines[lines.length - 1];
		const context = document.createElement('canvas').getContext('2d');
		context.font = getComputedStyle(textarea).font;

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
		const lines = textarea.value.substring(0, caretPosition).split('\n');
		currentLine = lines.length;
		currentColumn = lines[lines.length - 1].length;
		const pixelPosition = getCaretPixelPosition(textarea, caretPosition);
		const lineDivs = editor.getElementsByClassName('line');
		if (currentLine <= lineDivs.length) {
			const lineDiv = lineDivs[currentLine - 1];
			caret.style.height = `${lineDiv.offsetHeight}px`;
			caret.style.top = `${lineDiv.offsetTop}px`;
			caret.style.left = `${lineDiv.offsetLeft + pixelPosition}px`;
			if (!caret.parentElement) editor.appendChild(caret);
			textarea.style.top = caret.style.top;
			textarea.style.left = 0;
			textarea.style.height = caret.style.height;
			textarea.style.width = '100%';
		}
	}

	function createLineElement(text) {
		const line = document.createElement('div');
		line.className = 'line';
		line.innerHTML = text.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), 
			(match) => `<span class="keyword">${match}</span>`);
		return line;
	}

	let oldCaretPosition = 0;
	function setCaretPosition() {
		if (textarea.selectionStart === textarea.selectionEnd) {
			caretPosition = textarea.selectionStart;
			oldCaretPosition = caretPosition;
		} else if (oldCaretPosition === textarea.selectionStart) {
			caretPosition = textarea.selectionEnd;
		} else {
			caretPosition = textarea.selectionStart;
		}
	}

	function getTextMetrics(text, textarea) {
		const context = document.createElement('canvas').getContext('2d');
		context.font = getComputedStyle(textarea).font;
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

	function getCharIndexAtClick(lineText, clickX, textarea) {
		const charWidths = getTextMetrics(lineText, textarea);
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
		const selectionStart = textarea.selectionStart;
		const selectionEnd = textarea.selectionEnd;
		const textContent = textarea.value;
		const lineElements = editor.getElementsByClassName('line');
		for (const lineElement of lineElements) {
			const highlights = lineElement.querySelectorAll('.highlight');
			highlights.forEach(highlight => {
				let text = document.createTextNode(highlight.textContent);
				lineElement.replaceChild(text, highlight);
			});
		}
		const lines = textContent.split('\n');
		let globalIndex = 0;
		lines.forEach((lineText, lineIndex) => {
			let lineElement = lineElements[lineIndex];
			if (!lineElement) {
				editor.appendChild(createLineElement(lineText));
			}
			const localSelectionStart = Math.max(selectionStart - globalIndex, 0);
			const localSelectionEnd = Math.min(selectionEnd, globalIndex + lineText.length) - globalIndex;
			if (selectionStart < globalIndex + lineText.length && selectionEnd > globalIndex) {
				while (lineElement.firstChild) {
					lineElement.removeChild(lineElement.firstChild);
				}
				lineElement.appendChild(document.createTextNode(lineText.substring(0, localSelectionStart)));
				const highlightSpan = document.createElement('span');
				highlightSpan.className = 'highlight';
				highlightSpan.textContent = lineText.substring(localSelectionStart, localSelectionEnd);
				lineElement.appendChild(highlightSpan);
				lineElement.appendChild(document.createTextNode(lineText.substring(localSelectionEnd)));
			}
			globalIndex += lineText.length + 1;
		});
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
		const charIndex = getCharIndexAtClick(line.textContent, clickX, textarea);
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
	function checkClick(e) {
		if (oldEvent && (oldEvent.clientX !== e.clientX || oldEvent.clientY !== e.clientY)) {
			clickCount = 0;
		}
		oldEvent = e;
		const clickTime = Date.now();
		if (clickTime - lastClickTime < 400) {
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
		dragStartLine = lineIndex;
		dragStartChar = charIndex;
		caretPosition = getTextAreaIndexFromLineAndChar(lines, lineIndex, charIndex);
		textarea.setSelectionRange(caretPosition, caretPosition);
		updateSelection();
		updateCaret();
		window.getSelection().removeAllRanges();
	}

	function updateTextSelection(e) {
		const lines = editor.getElementsByClassName('line');
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		const startPos = getTextAreaIndexFromLineAndChar(lines, dragStartLine, dragStartChar);
		const endPos = getTextAreaIndexFromLineAndChar(lines, lineIndex, charIndex);
		caretPosition = endPos;
		if (startPos < endPos) {
			textarea.setSelectionRange(startPos, endPos);
		} else {
			textarea.setSelectionRange(endPos, startPos);
		}
		updateSelection();
		updateCaret();
	}

	editor.addEventListener('mousedown', function(e) {
		if (e.button === 0) {
			isDragging = true;
			startTextSelection(e);
			checkClick(e);
			document.addEventListener('mousemove', mousemove)
			document.addEventListener('mouseup', mouseup)
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

	editor.addEventListener('touchstart', function(e) {
		isDragging = true;
		const touch = e.touches[0];
		startTextSelection(touch);
		checkClick(touch);
		document.addEventListener('touchmove', touchmove)
		document.addEventListener('touchend', touchend)
	}, false);
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
		setCaretPosition();
		updateEditor();
	}, false);

	textarea.addEventListener('keydown', function(e) {
		const isNavigationKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
		if (isNavigationKey) {
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
			setCaretPosition();
			updateEditor();
		}
	}, false);

	document.getElementById('editor_container').addEventListener('focus', function(e) {
		textarea.focus();
	}, false);

	updateEditor();
}, false);

