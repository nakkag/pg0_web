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
		const metrics = context.measureText(currentLineText);
		return metrics.width;
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
	}, false);

	function getTextMetrics(text, textarea) {
		const context = document.createElement('canvas').getContext('2d');
		context.font = getComputedStyle(textarea).font;
		return text.split('').map(char => context.measureText(char).width);
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

	editor.addEventListener('mousedown', function(e) {
		const lines = editor.getElementsByClassName('line');
		isDragging = true;
		const { lineIndex, charIndex } = getLineCharIndexFromClick(e);
		dragStartLine = lineIndex;
		dragStartChar = charIndex;
		caretPosition = getTextAreaIndexFromLineAndChar(lines, lineIndex, charIndex);
		textarea.setSelectionRange(caretPosition, caretPosition);
		updateCaret();
		window.getSelection().removeAllRanges();
		
		document.addEventListener('mousemove', mousemove)
		document.addEventListener('mouseup', mouseup)
	}, false);

	const mousemove = function(e) {
		if (isDragging) {
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
	};

	const mouseup = function(e) {
		if (isDragging) {
			isDragging = false;
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

			document.removeEventListener('mousemove', mousemove)
			document.removeEventListener('mouseup', mouseup)
		}
	};

	document.getElementById('editor_container').addEventListener('focus', function(e) {
		textarea.focus();
	}, false);

	updateEditor();
}, false);

