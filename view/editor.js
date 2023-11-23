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
	me.paddingTop = 2;

	me.loadState = function() {
		const editor = document.getElementById('editor');
		const str = localStorage.getItem(me.storageKey);
		if (str) {
			const state = JSON.parse(str);
			editor.textContent = decodeURIComponent(RawDeflate.inflate(atob(state.text)));
			me.setAllLine();
			me.setLineNumber();
			me.currentContent = state;
			me.restoreSelect();
			me.showCaret();
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
				if (node.parentNode === editor && buf) {
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
		if (!selection.rangeCount) {
			return;
		}
		let node = selection.focusNode;
		while (node && node.tagName !== 'DIV') {
			node = node.parentNode;
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
				if (node.parentNode === editor) {
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
		let offset = 0;
		let firstDiv = true;
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node === element) {
				offset++;
				break;
			} else if (node.nodeType === Node.TEXT_NODE) {
				if (node.parentNode === editor && offset > 0) {
					offset++;
				}
				offset += node.nodeValue.length;
				firstDiv = false;
			} else if (node.tagName === 'DIV') {
				if (firstDiv) {
					firstDiv = false;
					continue;
				}
				offset++;
			}
		}
		return offset;
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
	me.rangeToOffset = function(container, offset) {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const editor = document.getElementById('editor');
		if (container === editor) {
			if (container.childNodes.length === 0) {
				return 0;
			} else if (container.childNodes.length <= offset) {
				container = null;
				offset = 0;
			} else {
				container = container.childNodes[offset];
				offset = 0;
			}
		}
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
		let caretOffset = 0;
		let firstDiv = true;
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node === container) {
				if (node.tagName === 'DIV') {
					if (caretOffset > 0 || !firstDiv) {
						caretOffset++;
					}
				} else {
					caretOffset += offset;
				}
				break;
			} else if (node.nodeType === Node.TEXT_NODE) {
				if (node.parentNode === editor && caretOffset > 0) {
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
	me.offsetToRange = function(position) {
		const editor = document.getElementById('editor');
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
		let charCount = 0;
		let firstDiv = true;
		let node;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node.nodeType === Node.TEXT_NODE) {
				const nextCharIndex = charCount + node.nodeValue.length;
				if (nextCharIndex >= position) {
					return {node: node, offset: position - charCount};
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
					return {node: node, offset: 0};
				}
			}
		}
		return null;
	};

	me.getTextWidth = function(line) {
		const editor = document.getElementById('editor');
		const cssDecl = getComputedStyle(editor);
		const context = document.createElement('canvas').getContext('2d');
		context.font = cssDecl.font;
		const tabSize = parseInt(cssDecl.tabSize);
		const text = line.split('');
		let width = 0;
		let pos = 0;
		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\t') {
				const spacesToNextTabStop = tabSize - (pos % tabSize);
				pos += spacesToNextTabStop;
				width += context.measureText(' '.repeat(spacesToNextTabStop)).width;
			} else {
				pos++;
				width += context.measureText(text[i]).width;
			}
		}
		return width;
	};

	me.showCaret = function() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		let node = selection.focusNode;
		while (node && node.tagName !== 'DIV') {
			node = node.parentNode;
		}
		if (node && node.id === 'editor') {
			return;
		}
		if (node) {
			const pos = editorView.getCaretPosition();
			const lines = editorView.getText().substr(0, pos).split("\n");
			const line = lines[lines.length - 1];
			const editorContainer = document.getElementById('editor_container');

			const width = me.getTextWidth(line);
			let x = editorContainer.scrollLeft;
			if (width < (x + 1)) {
				x = width - 1;
				if (x < 0) {
					x = 0;
				}
			}
			if (width > (x - 1) + editorContainer.clientWidth) {
				x = width - editorContainer.clientWidth + 1;
			}
			if (x !== editorContainer.scrollLeft) {
				editorContainer.scrollLeft = x;
			}

			const height = lines.length * node.offsetHeight + me.paddingTop;
			let y = editorContainer.scrollTop;
			if ((height - node.offsetHeight) < y) {
				y = height - node.offsetHeight;
			}
			if (height > y + editorContainer.clientHeight) {
				y = height - editorContainer.clientHeight;
			}
			if (y !== editorContainer.scrollTop) {
				editorContainer.scrollTop = y;
			}
		}
	};
	me.moveCaret = function(move) {
		const editor = document.getElementById('editor');
		const caretPosition = me.getCaretPosition();
		if (caretPosition + move < 0) {
			return;
		}
		me.setCaretPosition(caretPosition + move);
		me.saveSelect();
	};

	me.getCaretPosition = function() {
		const editor = document.getElementById('editor');
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		let container = selection.getRangeAt(0).startContainer;
		let offset = selection.getRangeAt(0).startOffset;
		return me.rangeToOffset(container, offset);
	};
	me.setCaretPosition = function(position) {
		const editor = document.getElementById('editor');
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const select = me.offsetToRange(position);
		if (!select) {
			return;
		}
		const range = document.createRange();
		range.setStart(select.node, select.offset);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		me.showCaret();
	};

	me.saveSelect = function() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const range = selection.getRangeAt(0);
		me.currentContent.start = me.rangeToOffset(range.startContainer, range.startOffset);
		me.currentContent.end = me.rangeToOffset(range.endContainer, range.endOffset);
		me.saveState();
	};
	me.restoreSelect = function() {
		if (me.currentContent.start !== undefined) {
			const selection = window.getSelection();
			if (!selection.rangeCount) {
				return;
			}
			const newRange = document.createRange();
			const start = me.offsetToRange(me.currentContent.start);
			if (start) {
				newRange.setStart(start.node, start.offset);
			}
			const end = me.offsetToRange(me.currentContent.end);
			if (end) {
				newRange.setEnd(end.node, end.offset);
			}
			selection.removeAllRanges();
			selection.addRange(newRange);
		}
	};

	me.updateContent = function(force) {
		const editor = document.getElementById('editor');
		me.saveSelect();
		if (force || !editor.childNodes[0] || editor.childNodes[0].nodeName !== 'DIV' || me.isMultiLine()) {
			me.setAllLine();
		} else {
			me.updateLine();
		}
		me.setLineNumber();
		me.restoreSelect();
	};

	me.deleteSelect = function() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const range = selection.getRangeAt(0);
		const startContainer = range.startContainer;
		const startOffset = range.startOffset;
		let startDiv = startContainer;
		while (startDiv && startDiv.tagName !== 'DIV') {
			startDiv = startDiv.parentNode;
		}
		const endContainer = range.endContainer;
		let endDiv = endContainer;
		while (endDiv && endDiv.tagName !== 'DIV') {
			endDiv = endDiv.parentNode;
		}
		range.deleteContents();
		if (startDiv !== endDiv && startDiv.nextSibling === endDiv) {
	    	while (endDiv.childNodes.length > 0) {
				startDiv.appendChild(endDiv.firstChild);
			}
			endDiv.parentNode.removeChild(endDiv);
		}
		const newRange = document.createRange();
		newRange.setStart(startContainer, startOffset);
		newRange.collapse(true);
		selection.removeAllRanges();
		selection.addRange(newRange);
	};
	me.insertTextAtCursor = function(text) {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		if (selection.focusNode === editor) {
			text = text.replace(/\n$/, '');
		}
		const node = document.createTextNode(text);
		selection.getRangeAt(0).insertNode(node);

		const newRange = document.createRange();
		newRange.setStart(node, text.length);
		newRange.collapse(true);
		selection.removeAllRanges();
		selection.addRange(newRange);

		me.setCurrentContent();
		me.updateContent();
		me.showCaret();
	};
	me.deleteTextAtCursor = function() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const range = selection.getRangeAt(0);
		let startContainer = range.startContainer;
		let startOffset = range.startOffset;
		const newRange = document.createRange();
		newRange.setStart(startContainer, startOffset);
		newRange.setEnd(startContainer, startOffset + 1);
		newRange.deleteContents();
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
		me.currentContent = {text: encodeText, caret: 0, select: {}};
		me.saveSelect();
	};
	me.setUndoText = function(state) {
		const editor = document.getElementById('editor');
		editor.textContent = decodeURIComponent(RawDeflate.inflate(atob(state.text)));
		me.setAllLine();
		me.setLineNumber();
		me.currentContent.start = state.start;
		me.currentContent.end = state.end;
		me.restoreSelect();
		me.saveState();
	};

	return me;
})();

document.addEventListener('DOMContentLoaded', function() {
	const editorContainer = document.getElementById('editor_container');
	const lineNumber = document.getElementById('line_number');
	const editor = document.getElementById('editor');

	editor.addEventListener('input', function(e) {
		if (e.isComposing) {
			return;
		}
		if (e.inputType === 'historyUndo') {
			e.preventDefault();
			editorView.undo();
		} else if (e.inputType === 'historyRedo') {
			e.preventDefault();
			editorView.redo();
		} else if (e.inputType === 'insertText' && e.data === '}') {
			const pos = editorView.getCaretPosition();
			const lines = editorView.getText().substr(0, pos).split("\n");
			const line = lines[lines.length - 1];
			if (/\t}$/.test(line)) {
				const selection = window.getSelection();
				if (!selection.rangeCount) {
					return;
				}
				let node = selection.focusNode;
				while (node && node.tagName !== 'DIV') {
					node = node.parentNode;
				}
				const str = line.replace(/\t}$/, '}') + node.textContent.substr(line.length);
				node.innerHTML = editorView.setKeyword(editorView.tagEscape(str));
				editorView.setCaretPosition(pos - 1);
				editorView.setCurrentContent();
			}
		} else {
			editorView.setCurrentContent();
		}
		editorView.updateContent();
	}, false);

	editor.addEventListener('compositionstart', function(e) {
		editorView.saveSelect();
	}, false);

	editor.addEventListener('compositionend', function(e) {
		editorView.setCurrentContent();
		editorView.updateContent();
	}, false);

	editor.addEventListener('paste', function(e) {
		e.preventDefault();
		editorView.deleteSelect();
		let str = (e.clipboardData || window.clipboardData).getData('text').replace(/\r/g, '');
		editorView.insertTextAtCursor(str);
	}, false);

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			editorView.deleteSelect();
			editorView.insertTextAtCursor("\t");
		} else if (e.key === 'Enter') {
			e.preventDefault();
			editorView.deleteSelect();
			const pos = editorView.getCaretPosition();
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
		if (e.isComposing) {
			return;
		}
		setTimeout(editorView.saveSelect, 0);
	}, false);

	let touchstart = 'mousedown';
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
	}
	editor.addEventListener(touchstart, function(e) {
		if (touchstart === 'mousedown') {
			document.addEventListener('mouseup', touchend);
		} else {
			document.addEventListener('touchend', touchend);
		}
	}, false);
	const touchend = function(e) {
		if (touchstart === 'mousedown') {
			document.removeEventListener('mouseup', touchend);
			setTimeout(editorView.saveSelect, 0);
		} else {
			document.removeEventListener('touchend', touchend);
			setTimeout(editorView.saveSelect, 100);
		}
	};

	let sc = {x: 0, y: 0};
	editor.addEventListener('focus', function(e) {
		editorView.restoreSelect();
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
		editor.focus();
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
		let node = editorView.getLineNode(index);
		if (node) {
			if (!startNode) {
				startNode = node;
			}
			const selection = window.getSelection();
			if (!selection.rangeCount) {
				return;
			}
			const range = document.createRange();
			if (startY <= y) {
				range.setStart(startNode, 0);
				if (node.nextSibling) {
					range.setEnd(node.nextSibling, 0);
				} else {
					range.setEndAfter(node);
				}
			} else {
				range.setStart(node, 0);
				if (startNode.nextSibling) {
					range.setEnd(startNode.nextSibling, 0);
				} else {
					range.setEndAfter(startNode);
				}
			}
			selection.removeAllRanges();
			selection.addRange(range);
			editorView.saveSelect();
			node.scrollIntoView({behavior: 'instant', block: 'nearest'});
			if (callback) {
				callback();
			}
		}
	};

	const observer = new ResizeObserver(function(entries) {
		lineNumber.style.height = (editorContainer.clientHeight - editorView.paddingTop) + 'px';
		lineNumber.scrollTop = editorContainer.scrollTop;
	})
	observer.observe(editorContainer);

	editorView.setLineNumber();

}, false);
