const keywords = ['var', 'exit', 'if', 'else', 'while'];
const keywords_extension = ['for', 'do', 'break', 'continue', 'switch', 'case', 'default', 'return', 'function'];
const keywords_preprocessor = ['#import', '#option'];

const regKeywords = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
const regKeywordsEx = new RegExp(`\\b(${keywords_extension.join('|')})\\b`, 'gi');
const regKeywordsPrep = new RegExp(`(${keywords_preprocessor.join('|')})`, 'gi');

function getEditorText() {
	const editor = document.getElementById('editor');
	const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
	let buf = '';
	let node;
	let firstDiv = true;
	while ((node = walker.nextNode())) {
		if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
			continue;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			buf += node.nodeValue
		} else if (node.tagName === 'DIV') {
			if (firstDiv) {
				firstDiv = false;
				continue;
			}
			buf += "\n";
		}
	}
	return buf;
}

function tagEscape(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setKeyword(str) {
	str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="string-literal">&quot;$1&quot;</span>');
	str = str.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="string-literal">&#39;$1&#39;</span>');
	str = str.replace(regKeywords, (match) => `<span class="keyword">${match}</span>`);
	str = str.replace(regKeywordsEx, (match) => `<span class="keyword">${match}</span>`);
	str = str.replace(regKeywordsPrep, (match) => `<span class="keyword">${match}</span>`);
	str = str.replace(/(\/\/.*)$/gm, '<span class="comment">$1</span>');
	return str;
}

function unsetHighlight() {
	document.querySelectorAll('.highlight').forEach(function(span) {
		span.outerHTML = span.innerHTML;
	});
}

function setHighlight(lineNumber, color) {
	unsetHighlight();
	const editor = document.getElementById('editor');
	const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, null, false);
	let node;
	let firstDiv = true;
	let line = 0;
	while ((node = walker.nextNode())) {
		if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
			continue;
		}
		if (node.tagName === 'DIV') {
			if (firstDiv) {
				firstDiv = false;
				continue;
			}
			line++;
			if (line >= lineNumber) {
				node.innerHTML = `<div><span class="highlight" style="background-color: ${color};">${setKeyword(tagEscape(node.textContent))}</span></div>`;
				break;
			}
		}
	}
	const elements = document.getElementsByClassName('highlight');
	if (elements && elements.length > 0) {
		elements[0].scrollIntoView({behavior: 'instant', block: 'nearest'});
		document.getElementById('editor_container').scrollLeft = 0;
	}
}

document.addEventListener('DOMContentLoaded', function() {
	const editorContainer = document.getElementById('editor_container');
	const editor = document.getElementById('editor');

	function setAllLine() {
		let str = getEditorText();
		const lines = str.split("\n");
		let newContent = '';
		lines.forEach(function(line, index) {
			if (!line) {
				newContent += `<div><br /></div>`;
			} else {
				newContent += `<div>${setKeyword(tagEscape(line))}</div>`;
			}
		});
		editor.innerHTML = newContent;
	}

	function updateLine() {
		const editor = document.getElementById('editor');
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, null, false);
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node.tagName === 'DIV') {
				const line = node.textContent;
				let html;
				if (!line) {
					html = '<br />';
				} else {
					html = setKeyword(tagEscape(line));
				}
				if (node.innerHTML !== html) {
					node.innerHTML = html;
				}
			}
		}
	}

	function isMultiLine() {
		const editor = document.getElementById('editor');
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
		let node;
		while ((node = walker.nextNode())) {
			if (node.nodeType === Node.TEXT_NODE) {
				const l = node.nodeValue.split('\n');
				if (l.length > 1) {
					return true;
				}
			}
		}
		return false;
	}

	function getCaretCharacterOffsetWithin(element) {
		const selection = window.getSelection();
		const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
		if (!currentRange) {
			return 0;
		}
		const container = currentRange.startContainer;
		const offset = currentRange.startOffset;

		const range = document.createRange();
		range.setStart(container, offset);
		range.setEnd(container, offset);
		range.collapse(true);
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
		let caretOffset = 0;
		let firstDiv = true;
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node === container) {
				caretOffset += offset;
				if (node.tagName === 'DIV' && caretOffset > 0) {
					caretOffset++;
				}
				break;
			} else if (node.nodeType === Node.TEXT_NODE) {
				caretOffset += node.nodeValue.length;
			} else if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = false;
					continue;
				}
				caretOffset++;
			}
		}
		return caretOffset;
	}

	function setCaretPosition(element, position) {
		const range = document.createRange();
		const selection = window.getSelection();
		range.setStart(element, 0);
		range.collapse(true);
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
		let charCount = 0;
		let found = false;
		let firstDiv = true;
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node.nodeType === Node.TEXT_NODE) {
				const nextCharIndex = charCount + node.nodeValue.length;
				if (nextCharIndex >= position) {
					range.setStart(node, position - charCount);
					found = true;
					break;
				}
				charCount = nextCharIndex;
			} else if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = !firstDiv;
					continue;
				}
				charCount += 1;
				if (charCount >= position) {
					range.setStart(node, 0);
					found = true;
					break;
				}
			}
		}
		if (found) {
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}
	
	let prevRanges = [];
	function saveCaretPosition() {
		const selection = window.getSelection();
		prevRanges = [];
		for (let i = 0; i < selection.rangeCount; i++) {
			prevRanges.push(selection.getRangeAt(i).cloneRange());
		}
		currentContent.caret = getCaretCharacterOffsetWithin(editor);
	}

	function restoreCaretPosition() {
		if (prevRanges.length > 0) {
			const selection = window.getSelection();
			selection.removeAllRanges();
			for (let i = 0; i < prevRanges.length; i++) {
				selection.addRange(prevRanges[i]);
			}
		}
	}

	function updateContent() {
		const caretPosition = getCaretCharacterOffsetWithin(editor);
		if (editor.childNodes[0].nodeName !== 'DIV' || isMultiLine()) {
			setAllLine();
		} else {
			updateLine();
		}
		setCaretPosition(editor, caretPosition);
	}

	function insertTextAtCursor(text) {
		document.execCommand('insertText', false, text);
	}

	function deleteTextAtCursor() {
		document.execCommand('forwardDelete');
	}

	let undoStack = [];
	let redoStack = [];
	let currentContent = {text: '', caret: 0};

	function undo() {
		if (undoStack.length > 0) {
			redoStack.push(currentContent);
			currentContent = undoStack.pop();
			setUndoText(currentContent);
		}
	}

	function redo() {
		if (redoStack.length > 0) {
			undoStack.push(currentContent);
			currentContent = redoStack.pop();
			setUndoText(currentContent);
		}
	}

	function setCurrentContent() {
		const encodeText = RawDeflate.deflate(encodeURIComponent(getEditorText()));
		if (currentContent.text === encodeText) {
			return;
		}
		undoStack.push(currentContent);
		redoStack = [];
		if (undoStack.length > 50) {
			undoStack.shift();
		}
		currentContent = {text: encodeText, caret: 0};
	}

	function setUndoText(state) {
		editor.textContent = decodeURIComponent(RawDeflate.inflate(state.text));
		setAllLine();
		setCaretPosition(editor, state.caret);
	}

	let composition = false;

	editor.addEventListener('input', function(e) {
		if (composition) {
			return;
		}
		if (e.inputType === 'historyUndo') {
			e.preventDefault();
			undo();
		} else if (e.inputType === 'historyRedo') {
			e.preventDefault();
			redo();
		} else {
			setCurrentContent();
		}
		updateContent();
	}, false);

	editor.addEventListener('compositionstart', function(e) {
		composition = true;
	}, false);

	editor.addEventListener('compositionend', function(e) {
		composition = false;
		setCurrentContent();
		updateContent();
	}, false);

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			insertTextAtCursor("\t");
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const pos = getCaretCharacterOffsetWithin(editor);
			const lines = getEditorText().substr(0, pos).split("\n");
			const line = lines[lines.length - 1];
			const m = line.match(/^[ \t]+/);
			let indent = '';
			if (m && m.length > 0) {
				indent = m[0];
			}
			if (/{[ \t]*$/.test(line)) {
				indent += "\t";
			}
			insertTextAtCursor("\n" + indent);
		} else if (e.key === '}') {
			e.preventDefault();
			const pos = getCaretCharacterOffsetWithin(editor);
			const lines = getEditorText().substr(0, pos).split("\n");
			const line = lines[lines.length - 1];
			if (/\t$/.test(line)) {
				setCaretPosition(editor, pos - 1);
				deleteTextAtCursor();
			}
			insertTextAtCursor('}');
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
			e.preventDefault();
			undo();
			return;
		} else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
			e.preventDefault();
			redo();
			return;
		}
	}, false);

	editor.addEventListener('keyup', function(e) {
		setTimeout(saveCaretPosition, 0);
	}, false);

	let touchstart = 'mousedown';
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
	}
	editor.addEventListener(touchstart, function(e) {
		editor.focus();
		if (touchstart === 'mousedown') {
			document.addEventListener('mouseup', touchend);
		} else {
			document.addEventListener('touchend', touchend);
		}
	}, false);
	const touchend = function(e) {
		document.removeEventListener('mouseup', touchend);
		setTimeout(saveCaretPosition, 0);
	};

	let sc = {x: 0, y: 0};
	editor.addEventListener('focus', function(e) {
		restoreCaretPosition();
		editorContainer.scrollTo(sc.x, sc.y);
		setTimeout(function() {
			restoreCaretPosition();
			editorContainer.scrollTo(sc.x, sc.y);
		}, 0);
	}, false);

	editor.addEventListener('blur', function(e) {
		sc.x = editorContainer.scrollLeft;
		sc.y = editorContainer.scrollTop;
	}, false);

	editorContainer.addEventListener('focus', function(e) {
		editor.focus();
	}, false);
	
	editorContainer.addEventListener('scroll', function(e) {
		sc.x = editorContainer.scrollLeft;
		sc.y = editorContainer.scrollTop;
	}, false);

}, false);
