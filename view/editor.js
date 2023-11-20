const editorView = (function () {
	const me = {};

	const keywords = ['var', 'exit', 'if', 'else', 'while'];
	const keywords_extension = ['for', 'do', 'break', 'continue', 'switch', 'case', 'default', 'return', 'function'];
	const keywords_preprocessor = ['#import', '#option'];

	const regKeywords = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
	const regKeywordsEx = new RegExp(`\\b(${keywords_extension.join('|')})\\b`, 'gi');
	const regKeywordsPrep = new RegExp(`(${keywords_preprocessor.join('|')})`, 'gi');

	me.storageKey = 'pg0_text';
	me.undoCount = 50;

	me.currentContent = {text: '', caret: 0};

	me.loadState = function() {
		const editor = document.getElementById('editor');
		const str = localStorage.getItem(me.storageKey);
		if (str) {
			const state = JSON.parse(str);
			editor.textContent = decodeURIComponent(RawDeflate.inflate(atob(state.text)));
			me.setAllLine();
			me.setLineNumber();
			me.currentContent = state;
			me.setCurrentContent();
		}
	};
	me.saveState = function() {
		localStorage.setItem(me.storageKey, JSON.stringify(me.currentContent));
	};

	me.getText = function() {
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
				if (node.parentElement === editor && buf) {
					buf += "\n";
				}
				buf += node.nodeValue;
				firstDiv = false;
			} else if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = false;
					continue;
				}
				buf += "\n";
			}
		}
		return buf;
	};

	me.tagEscape = function(str) {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	};
	me.setKeyword = function(str) {
		str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="string-literal">&quot;$1&quot;</span>');
		str = str.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="string-literal">&#39;$1&#39;</span>');
		str = str.replace(regKeywords, (match) => `<span class="keyword">${match}</span>`);
		str = str.replace(regKeywordsEx, (match) => `<span class="keyword">${match}</span>`);
		str = str.replace(regKeywordsPrep, (match) => `<span class="keyword">${match}</span>`);
		str = str.replace(/(\/\/.*)$/gm, '<span class="comment">$1</span>');
		return str;
	};

	me.unsetHighlight = function() {
		document.querySelectorAll('.highlight').forEach(function(span) {
			span.outerHTML = span.innerHTML;
		});
	};
	me.setHighlight = function(lineNumber, color) {
		me.unsetHighlight();
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
				if (firstDiv && lineNumber > 0) {
					firstDiv = false;
					continue;
				}
				line++;
				if (line >= lineNumber) {
					node.innerHTML = `<span class="highlight" style="background-color: ${color};">${me.setKeyword(me.tagEscape(node.textContent))}</span>`;
					break;
				}
			}
		}
		const elements = document.getElementsByClassName('highlight');
		if (elements && elements.length > 0) {
			elements[0].scrollIntoView({behavior: 'instant', block: 'nearest'});
			document.getElementById('editor_container').scrollLeft = 0;
		}
	};

	me.getLineCount = function() {
		const editor = document.getElementById('editor');
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, null, false);
		let node;
		let firstDiv = true;
		let cnt = 1;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = false;
					continue;
				}
				cnt++;
			}
		}
		return cnt;
	};
	me.setLineNumber = function() {
		const lineNumber = document.getElementById('line_number');
		const cnt = me.getLineCount();
		if (cnt > lineNumber.childElementCount) {
			for (let i = lineNumber.childElementCount; i < cnt; i++) {
				const div = document.createElement('div');
				div.textContent = i + 1;
				lineNumber.appendChild(div);
			}
		} else {
			for (let i = lineNumber.childElementCount; i > cnt; i--) {
				lineNumber.lastChild.remove();
			}
		}
	};
	me.setAllLine = function() {
		const editor = document.getElementById('editor');
		let str = me.getText();
		const lines = str.split("\n");
		let newContent = '';
		lines.forEach(function(line, index) {
			if (!line) {
				newContent += `<div><br /></div>`;
			} else {
				newContent += `<div>${me.setKeyword(me.tagEscape(line))}</div>`;
			}
		});
		editor.innerHTML = newContent;
	};
	me.updateLine = function() {
		const editor = document.getElementById('editor');
		const selection = window.getSelection();
		let node = selection.focusNode;
		while (node && node.tagName !== 'DIV') {
			node = node.parentElement;
		}
		if (node && node.tagName === 'DIV') {
			const line = node.textContent;
			let html;
			if (!line) {
				html = '<br />';
			} else {
				html = me.setKeyword(me.tagEscape(line));
			}
			if (node.innerHTML !== html) {
				node.innerHTML = html;
			}
		}
	};

	me.isMultiLine = function() {
		const editor = document.getElementById('editor');
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
		let node;
		while ((node = walker.nextNode())) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (node.parentElement === editor) {
					return true;
				}
				const l = node.nodeValue.split('\n');
				if (l.length > 1) {
					return true;
				}
			}
		}
		return false;
	};

	me.getElementOffset = function(element) {
		const editor = document.getElementById('editor');
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
		let caretOffset = 0;
		let firstDiv = true;
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node === element) {
				caretOffset++;
				break;
			} else if (node.nodeType === Node.TEXT_NODE) {
				if (node.parentElement === editor && caretOffset > 0) {
					caretOffset++;
				}
				caretOffset += node.nodeValue.length;
				firstDiv = false;
			} else if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = false;
					continue;
				}
				caretOffset++;
			}
		}
		return caretOffset;
	};
	me.getLineNode = function(lineNumber) {
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
				if (firstDiv && lineNumber > 0) {
					firstDiv = false;
					continue;
				}
				line++;
				if (line >= lineNumber) {
					return node;
				}
			}
		}
		return null;
	};

	me.showCaret = function() {
		const selection = window.getSelection();
		let node = selection.focusNode;
		while (node && !node.scrollIntoView) {
			node = node.parentElement;
		}
		if (node && node.scrollIntoView) {
			node.scrollIntoView({behavior: 'instant', block: 'nearest'});
		}
	};
	me.getCaretCharacterOffsetWithin = function(element) {
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
				if (node.tagName === 'DIV' && (caretOffset > 0 || !firstDiv)) {
					caretOffset++;
				}
				break;
			} else if (node.nodeType === Node.TEXT_NODE) {
				if (node.parentElement === editor && caretOffset > 0) {
					caretOffset++;
				}
				caretOffset += node.nodeValue.length;
				firstDiv = false;
			} else if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = false;
					continue;
				}
				caretOffset++;
			}
		}
		return caretOffset;
	};
	me.setCaretPosition = function(element, position) {
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
				firstDiv = false;
			} else if (node.tagName === 'DIV') {
				if (firstDiv && position > 0) {
					firstDiv = false;
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
			me.showCaret();
		}
	};

	let prevRanges = [];
	me.initCaretPosition = function() {
		prevRanges = [];
	};
	me.saveCaretPosition = function() {
		const editor = document.getElementById('editor');
		const selection = window.getSelection();
		prevRanges = [];
		for (let i = 0; i < selection.rangeCount; i++) {
			prevRanges.push(selection.getRangeAt(i).cloneRange());
		}
		me.currentContent.caret = me.getCaretCharacterOffsetWithin(editor);
	};
	me.restoreCaretPosition = function() {
		if (prevRanges.length > 0) {
			const selection = window.getSelection();
			selection.removeAllRanges();
			for (let i = 0; i < prevRanges.length; i++) {
				selection.addRange(prevRanges[i]);
			}
		}
	};

	me.updateContent = function(force) {
		const editor = document.getElementById('editor');
		const caretPosition = me.getCaretCharacterOffsetWithin(editor);
		if (force || !editor.childNodes[0] || editor.childNodes[0].nodeName !== 'DIV' || me.isMultiLine()) {
			me.setAllLine();
		} else {
			me.updateLine();
		}
		me.setLineNumber();
		me.setCaretPosition(editor, caretPosition);
	};

	me.deleteSelect = function() {
		const selection = window.getSelection();
		selection.deleteFromDocument();
	};
	me.insertTextAtCursor = function(text) {
		document.execCommand('insertText', false, text);
	};
	me.deleteTextAtCursor = function() {
		document.execCommand('forwardDelete');
	};

	let undoStack = [];
	let redoStack = [];
	me.undo = function() {
		if (undoStack.length > 0) {
			redoStack.push(me.currentContent);
			me.currentContent = undoStack.pop();
			me.setUndoText(me.currentContent);
		}
	};
	me.redo = function() {
		if (redoStack.length > 0) {
			undoStack.push(me.currentContent);
			me.currentContent = redoStack.pop();
			me.setUndoText(me.currentContent);
		}
	};
	me.setCurrentContent = function() {
		const encodeText = btoa(RawDeflate.deflate(encodeURIComponent(me.getText())));
		if (me.currentContent.text === encodeText) {
			return;
		}
		undoStack.push(me.currentContent);
		redoStack = [];
		if (undoStack.length > me.undoCount) {
			undoStack.shift();
		}
		me.currentContent = {text: encodeText, caret: 0};
		me.saveState();
	};
	me.setUndoText = function(state) {
		const editor = document.getElementById('editor');
		editor.textContent = decodeURIComponent(RawDeflate.inflate(atob(state.text)));
		me.setAllLine();
		me.setLineNumber();
		me.setCaretPosition(editor, state.caret);
		me.saveState();
	};

	return me;
})();

document.addEventListener('DOMContentLoaded', function() {
	const editorContainer = document.getElementById('editor_container');
	const lineNumber = document.getElementById('line_number');
	const editor = document.getElementById('editor');

	let composition = false;

	editor.addEventListener('input', function(e) {
		if (composition) {
			return;
		}
		if (e.inputType === 'historyUndo') {
			e.preventDefault();
			editorView.undo();
		} else if (e.inputType === 'historyRedo') {
			e.preventDefault();
			editorView.redo();
		} else {
			editorView.setCurrentContent();
		}
		editorView.updateContent();
	}, false);

	editor.addEventListener('compositionstart', function(e) {
		composition = true;
		editorView.saveCaretPosition();
	}, false);

	editor.addEventListener('compositionend', function(e) {
		composition = false;
		editorView.setCurrentContent();
		editorView.updateContent();
	}, false);

	editor.addEventListener('paste', function(e) {
		e.preventDefault();
		let str = (e.clipboardData || window.clipboardData).getData('text').replace(/\r/g, '');
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		let caretPosition = 0;
		if (selection.focusNode === editor) {
			str = str.replace(/\n$/, '');
			if (selection.anchorNode && selection.anchorNode.childNodes) {
				caretPosition = editorView.getElementOffset(selection.anchorNode.childNodes[selection.anchorOffset]);
			}
		} else {
			caretPosition = editorView.getCaretCharacterOffsetWithin(editor);
		}
		selection.deleteFromDocument();
		selection.getRangeAt(0).insertNode(document.createTextNode(str));
		selection.collapseToEnd();
		editorView.setCaretPosition(editor, caretPosition + str.length);
		editorView.setCurrentContent();
		editorView.updateContent();
		editorView.showCaret();
	}, false);

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			editorView.insertTextAtCursor("\t");
		} else if (e.key === 'Enter') {
			e.preventDefault();
			editorView.deleteSelect();
			const pos = editorView.getCaretCharacterOffsetWithin(editor);
			const lines = editorView.getText().substr(0, pos).split("\n");
			const line = lines[lines.length - 1];
			const m = line.match(/^[ \t]+/);
			let indent = '';
			if (m && m.length > 0) {
				indent = m[0];
			}
			if (/{[ \t]*$/.test(line)) {
				indent += "\t";
			}
			editorView.insertTextAtCursor("\n" + indent);
		} else if (e.key === '}') {
			e.preventDefault();
			editorView.deleteSelect();
			const pos = editorView.getCaretCharacterOffsetWithin(editor);
			const lines = editorView.getText().substr(0, pos).split("\n");
			const line = lines[lines.length - 1];
			if (/\t$/.test(line)) {
				editorView.setCaretPosition(editor, pos - 1);
				editorView.deleteTextAtCursor();
			}
			editorView.insertTextAtCursor('}');
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
			e.preventDefault();
			editorView.undo();
			return;
		} else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
			e.preventDefault();
			editorView.redo();
			return;
		}
	}, false);

	editor.addEventListener('keyup', function(e) {
		if (composition) {
			return;
		}
		setTimeout(editorView.saveCaretPosition, 0);
	}, false);

	let touchstart = 'mousedown';
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
	}
	editor.addEventListener(touchstart, function(e) {
		editorView.initCaretPosition();
		if (touchstart === 'mousedown') {
			document.addEventListener('mouseup', touchend);
		} else {
			document.addEventListener('touchend', touchend);
		}
	}, false);
	const touchend = function(e) {
		if (touchstart === 'mousedown') {
			document.removeEventListener('mouseup', touchend);
		} else {
			document.removeEventListener('touchend', touchend);
		}
		setTimeout(editorView.saveCaretPosition, 0);
	};

	let sc = {x: 0, y: 0};
	editor.addEventListener('focus', function(e) {
		editorView.restoreCaretPosition();
		editorContainer.scrollTo(sc.x, sc.y);
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
		lineNumber.scrollTop = editorContainer.scrollTop;
	}, false);

	let startNode = null;
	let startY = 0;
	lineNumber.addEventListener(touchstart, function(e) {
		e.preventDefault();
		startNode = null;
		startY = (touchstart === 'mousedown') ? e.y : e.touches[0].clientY;
		selectLine(startY, function() {
			if (touchstart === 'mousedown') {
				document.addEventListener('mousemove', mousemove);
				document.addEventListener('mouseup', mouseup);
			} else {
				document.addEventListener('touchmove', mousemove);
				document.addEventListener('touchend', mouseup);
			}
		});
	}, false);
	const mousemove = function(e) {
		e.preventDefault();
		selectLine(((touchstart === 'mousedown') ? e.y : e.touches[0].clientY), null);
	};
	const mouseup = function(e) {
		if (touchstart === 'mousedown') {
			document.removeEventListener('mousemove', mousemove);
			document.removeEventListener('mouseup', mouseup);
		} else {
			document.removeEventListener('touchmove', mousemove);
			document.removeEventListener('touchend', mouseup);
		}
	};
	const selectLine = function(y, callback) {
		const index = Math.floor((lineNumber.scrollTop + y - editorContainer.offsetTop) / lineNumber.firstChild.offsetHeight);
		let elm = editorView.getLineNode(index);
		if (elm) {
			if (!startNode) {
				startNode = elm;
			}
			const selection = window.getSelection();
			const range = document.createRange();
			let caretNode;
			if (startY <= y) {
				range.setStartBefore(startNode);
				range.setEndAfter(elm);
				caretNode = startNode;
			} else {
				range.setStartBefore(elm);
				range.setEndAfter(startNode);
				caretNode = elm;
			}
			selection.removeAllRanges();
			selection.addRange(range);
			editorView.saveCaretPosition();
			editorView.currentContent.caret = editorView.getElementOffset(caretNode);
			elm.scrollIntoView({behavior: 'instant', block: 'nearest'});
			if (callback) {
				callback();
			}
		}
	};

	const observer = new ResizeObserver(function(entries) {
		lineNumber.style.height = (editorContainer.clientHeight - 2) + 'px';
	})
	observer.observe(editorContainer);

	editorView.setLineNumber();

}, false);
