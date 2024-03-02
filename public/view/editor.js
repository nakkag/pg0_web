"use strict";

function editorView(editor, lineNumber) {
	const that = this;
	const editorContainer = editor.parentNode;

	const keywords = ['var', 'exit', 'if', 'else', 'while'];
	const keywords_extension = ['for', 'do', 'break', 'continue', 'switch', 'case', 'default', 'return', 'function'];
	const keywords_preprocessor = ['#import', '#option'];
	const regKeywords = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
	const regKeywordsEx = new RegExp(`\\b(${keywords_extension.join('|')})\\b`, 'gi');
	const regKeywordsPrep = new RegExp(`(${keywords_preprocessor.join('|')})`, 'gi');

	if (lineNumber && typeof ResizeObserver === 'function') {
		// Adjust line number height
		const observer = new ResizeObserver(function() {
			lineNumber.style.height = (editorContainer.clientHeight - that.paddingTop) + 'px';
			lineNumber.scrollTop = editorContainer.scrollTop;
		})
		observer.observe(editorContainer);
	}

	this.storageKey = 'pg0_text_v2';
	this.undoCount = 300;
	this.extension = true;
	this.currentContent = initContent();
	that.paddingTop = parseInt(getComputedStyle(editorContainer).paddingTop);
	that.paddingLeft = parseInt(getComputedStyle(editorContainer).paddingLeft);

	this.loadState = function() {
		const str = localStorage.getItem(that.storageKey);
		if (str) {
			const state = JSON.parse(str);
			editor.textContent = state.text;
			setAllLine();
			updateLineNumber();
			that.currentContent = state;
			that.restoreSelect();
			that.showCaret();
			return true;
		}
		return false;
	};
	this.saveState = function() {
		localStorage.setItem(that.storageKey, JSON.stringify(that.currentContent));
	};

	this.setText = function(str, name) {
		editor.textContent = str.replace(/\r/g, '');
		setAllLine();
		updateLineNumber();
		that.currentContent = initContent();
		that.currentContent.text = that.getText();
		that.currentContent.name = name;
		that.restoreSelect();
		that.showCaret();
		that.saveState();
	};
	this.getText = function() {
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

	this.unsetHighlight = function() {
		document.querySelectorAll('.highlight').forEach(function(span) {
			span.outerHTML = span.innerHTML;
		});
	};
	this.setHighlight = function(pos, color) {
		that.unsetHighlight();
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, null, false);
		let node;
		let firstDiv = true;
		let line = 0;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node.tagName === 'DIV') {
				if (firstDiv && pos > 0) {
					firstDiv = false;
					continue;
				}
				line++;
				if (line >= pos) {
					node.innerHTML = `<span class="highlight" style="background-color: ${color};">${setKeyword(tagEscape(node.textContent))}</span>`;
					break;
				}
			}
		}
		const element = document.querySelector('.highlight');
		if (element) {
			element.scrollIntoView({behavior: 'instant', block: 'nearest'});
			editorContainer.scrollLeft = 0;
		}
	};

	this.getCaretLineIndex = function() {
		const lines = that.getText().substring(0, that.currentContent.caret[0]).split("\n");
		return lines.length - 1;
	};
	this.getLineNode = function(pos) {
		const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, null, false);
		let node;
		let firstDiv = true;
		let line = 0;
		while ((node = walker.nextNode())) {
			if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
				continue;
			}
			if (node.tagName === 'DIV') {
				if (firstDiv && pos > 0) {
					firstDiv = false;
					continue;
				}
				line++;
				if (line >= pos) {
					return node;
				}
			}
		}
		return null;
	};
	this.showCaret = function() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		let node = selection.focusNode;
		while (node && node.tagName !== 'DIV') {
			node = node.parentNode;
		}
		if (node && node !== editor) {
			const pos = getCaretPosition();
			const lines = that.getText().substring(0, pos).split("\n");
			const line = lines[lines.length - 1];
			// Horizontal display
			const width = getTextWidth(line) + that.paddingLeft;
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
			// Vertical display
			const height = lines.length * node.offsetHeight + that.paddingTop;
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
	this.moveCaret = function(move) {
		const caretPosition = getCaretPosition();
		if (caretPosition + move < 0) {
			return;
		}
		setCaretPosition(caretPosition + move);
		that.saveSelect();
	};

	this.saveSelect = function(saveInput) {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const range = selection.getRangeAt(0);
		that.currentContent.caret = [
			rangeToOffset(range.startContainer, range.startOffset),
			rangeToOffset(range.endContainer, range.endOffset)
		];
		if (saveInput) {
			that.currentContent.input = [
				that.currentContent.caret[0],
				that.currentContent.caret[1]
			];
		}
		that.saveState();
	};
	this.restoreSelect = function() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const newRange = document.createRange();
		const start = offsetToRange(that.currentContent.caret[0]);
		if (start) {
			newRange.setStart(start.node, start.offset);
		}
		const end = offsetToRange(that.currentContent.caret[1]);
		if (end) {
			newRange.setEnd(end.node, end.offset);
		}
		selection.removeAllRanges();
		selection.addRange(newRange);
	};
	this.deleteSelect = function() {
		if (editor.getAttribute('contenteditable') === 'false') {
			return;
		}
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
			// Joining of nodes
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

	this.insertText = function(text) {
		if (editor.getAttribute('contenteditable') === 'false') {
			return;
		}
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		if (selection.focusNode === editor) {
			// Pasting text into the root node removes extra line breaks
			text = text.replace(/\n$/, '');
		}
		// Inserting text
		const node = document.createTextNode(text);
		selection.getRangeAt(0).insertNode(node);
		const newRange = document.createRange();
		newRange.setStart(node, text.length);
		newRange.collapse(true);
		selection.removeAllRanges();
		selection.addRange(newRange);

		updateContent();
		that.showCaret();
	};

	this.inputTab = function(shiftKey) {
		if (editor.getAttribute('contenteditable') === 'false') {
			return;
		}
		if (that.currentContent.caret[0] === that.currentContent.caret[1]) {
			that.deleteSelect();
			that.insertText("\t");
			return;
		}
		const str = that.getText().substring(that.currentContent.caret[0], that.currentContent.caret[1]);
		if (str.indexOf("\n") === -1) {
			that.deleteSelect();
			that.insertText("\t");
			return;
		}
		// Change of indent
		let lines = that.getText().substring(0, that.currentContent.caret[0]).split("\n");
		const startLine = lines.length - 1;
		lines = that.getText().substring(0, that.currentContent.caret[1]).split("\n");
		let endLine = lines.length - 1;
		if (!lines[endLine]) {
			endLine--;
		}
		let startNode, endNode;
		for (let i = startLine; i <= endLine; i++) {
			const node = that.getLineNode(i);
			if (i === startLine) {
				startNode = node;
			}
			if (i === endLine) {
				endNode = node;
			}
			let newStr;
			if (shiftKey) {
				// Reduce indent
				newStr = node.textContent.replace(/^\t/, '');
			} else {
				// Increase indent
				newStr = '\t' + node.textContent;
			}
			if (!newStr) {
				node.innerHTML = '<br />';
			} else {
				node.innerHTML = setKeyword(tagEscape(newStr));
			}
		}
		// Restore selection
		const selection = window.getSelection();
		if (!selection.rangeCount || !startNode || !endNode) {
			return;
		}
		const range = document.createRange();
		range.setStart(startNode, 0);
		if (endNode.nextSibling) {
			range.setEnd(endNode.nextSibling, 0);
		} else {
			range.setEndAfter(endNode);
		}
		selection.removeAllRanges();
		selection.addRange(range);
		updateContent();
		that.showCaret();
	};

	this.undo = function() {
		if (editor.getAttribute('contenteditable') === 'false') {
			return;
		}
		if (that.currentContent.undo.length > 0) {
			that.currentContent.redo.push(setUndoText(that.currentContent.undo.pop()));
			that.saveState();
		}
	};
	this.redo = function() {
		if (editor.getAttribute('contenteditable') === 'false') {
			return;
		}
		if (that.currentContent.redo.length > 0) {
			that.currentContent.undo.push(setUndoText(that.currentContent.redo.pop()));
			that.saveState();
		}
	};

	editor.addEventListener('input', function(e) {
		if (e.isComposing) {
			return;
		}
		if (e.inputType === 'historyUndo') {
			e.preventDefault();
			that.undo();
			return;
		} else if (e.inputType === 'historyRedo') {
			e.preventDefault();
			that.redo();
			return;
		} else if (e.inputType === 'insertText' && e.data === '}') {
			const pos = getCaretPosition();
			const lines = that.getText().substring(0, pos).split("\n");
			const line = lines[lines.length - 1];
			if (/\t}$/.test(line)) {
				// Reduce indent
				const selection = window.getSelection();
				if (!selection.rangeCount) {
					return;
				}
				let node = selection.focusNode;
				while (node && node.tagName !== 'DIV') {
					node = node.parentNode;
				}
				const str = line.replace(/\t}$/, '}') + node.textContent.substring(line.length);
				node.innerHTML = setKeyword(tagEscape(str));
				setCaretPosition(pos - 1);
			}
		}
		updateContent();
	}, false);

	editor.addEventListener('compositionstart', function(e) {
		that.saveSelect();
	}, false);

	editor.addEventListener('compositionend', function(e) {
		updateContent();
	}, false);

	editor.addEventListener('paste', function(e) {
		e.preventDefault();
		if (editor.getAttribute('contenteditable') === 'false') {
			return;
		}
		that.deleteSelect();
		let str = (e.clipboardData || window.clipboardData).getData('text').replace(/\r/g, '');
		that.insertText(str);
	}, false);

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			that.inputTab(e.shiftKey);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			that.deleteSelect();
			// Inheritance of indent
			const pos = getCaretPosition();
			const lines = that.getText().substring(0, pos).split("\n");
			const line = lines[lines.length - 1];
			const m = line.match(/^[ \t]+/);
			let indent = '';
			if (m && m.length > 0) {
				indent = m[0];
			}
			if (/{[ \t]*$/.test(line)) {
				indent += "\t";
			}
			that.insertText("\n" + indent);
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
			e.preventDefault();
			that.undo();
			return;
		} else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
			e.preventDefault();
			that.redo();
			return;
		}
	}, false);

	editor.addEventListener('keyup', function(e) {
		if (e.isComposing) {
			return;
		}
		setTimeout(that.saveSelect, 0);
	}, false);

	let touchstart = 'mousedown';
	if ('ontouchstart' in window) {
		touchstart = 'touchstart';
	}
	editor.addEventListener(touchstart, function(e) {
		const touchend = function(e) {
			if (touchstart === 'mousedown') {
				document.removeEventListener('mouseup', touchend);
				setTimeout(that.saveSelect, 0);
			} else {
				document.removeEventListener('touchend', touchend);
				setTimeout(that.saveSelect, 100);
			}
		};
		if (touchstart === 'mousedown') {
			document.addEventListener('mouseup', touchend);
		} else {
			document.addEventListener('touchend', touchend);
		}
	}, false);

	editor.addEventListener('click', function(e) {
		if (that.currentContent.caret[0] === that.currentContent.caret[1]) {
			that.showCaret();
		}
	}, false);

	let sc = {x: 0, y: 0};
	editor.addEventListener('focus', function(e) {
		that.restoreSelect();
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
		if (lineNumber) {
			lineNumber.scrollTop = editorContainer.scrollTop;
		}
	}, false);

	if (lineNumber) {
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
			const node = that.getLineNode(index);
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
				that.saveSelect();
				node.scrollIntoView({behavior: 'instant', block: 'nearest'});
				if (callback) {
					callback();
				}
			}
		};
	}

	function initContent() {
		return {text: '', name: '', modify: false, caret: [0, 0], input: [0, 0], undo: [], redo: []};
	}

	function tagEscape(str) {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
	function setKeyword(str) {
		str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="string-literal">&quot;$1&quot;</span>');
		str = str.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="string-literal">&#39;$1&#39;</span>');
		str = str.replace(regKeywords, function(match) {return `<span class="keyword">${match}</span>`;});
		if (that.extension) {
			str = str.replace(regKeywordsEx, function(match) {return `<span class="keyword">${match}</span>`;});
		}
		str = str.replace(regKeywordsPrep, function(match) {return `<span class="keyword">${match}</span>`;});
		str = str.replace(/(\/\/.*)$/gm, '<span class="comment">$1</span>');
		return str;
	}

	function getTextWidth(line) {
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
	}

	function getLineCount() {
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
	}
	function updateLineNumber() {
		if (!lineNumber) {
			return;
		}
		const cnt = getLineCount();
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
	}
	updateLineNumber();

	function setAllLine() {
		const lines = that.getText().split("\n");
		let newContent = '';
		lines.forEach(function(line, index) {
			if (!line) {
				newContent += '<div><br /></div>';
			} else {
				newContent += `<div>${setKeyword(tagEscape(line))}</div>`;
			}
		});
		editor.innerHTML = newContent;
	}
	function updateLine() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		let node = selection.focusNode;
		while (node && node.tagName !== 'DIV') {
			node = node.parentNode;
		}
		if (node === editor) {
			setAllLine();
			return;
		}
		if (node && node.tagName === 'DIV') {
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
	function isMultiLine() {
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
	}

	function rangeToOffset(container, offset) {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		if (container === editor) {
			if (container.childNodes.length === 0) {
				return 0;
			} else if (container.childNodes.length <= offset) {
				container = null;
				offset = 0;
			} else {
				// Offset is the node position
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
	}
	function offsetToRange(position) {
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
	}
	function getCaretPosition() {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const range = selection.getRangeAt(0);
		return rangeToOffset(range.startContainer, range.startOffset);
	}
	function setCaretPosition(position) {
		const selection = window.getSelection();
		if (!selection.rangeCount) {
			return;
		}
		const select = offsetToRange(position);
		if (!select) {
			return;
		}
		const range = document.createRange();
		range.setStart(select.node, select.offset);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		that.showCaret();
	}

	function updateContent() {
		const newText = that.getText();
		if (that.currentContent.text !== newText) {
			// Set undo
			const newDiff = diff(that.currentContent.text, newText);
			newDiff.c = [that.currentContent.caret[0], that.currentContent.caret[1]];
			that.currentContent.undo.push(newDiff);
			that.currentContent.redo = [];
			if (that.currentContent.undo.length > that.undoCount) {
				that.currentContent.undo.shift();
			}
			that.currentContent.text = newText;
		}
		// Update text
		that.currentContent.modify = true;
		that.saveSelect(true);
		if (!editor.childNodes[0] || editor.childNodes[0].nodeName !== 'DIV' || isMultiLine()) {
			setAllLine();
		} else {
			updateLine();
		}
		updateLineNumber();
		that.restoreSelect();
	}

	function diff(oldText, newText) {
		let start = 0;
		let oend = oldText.length;
		let nend = newText.length;
		for (; start < oend && start < nend && oldText[start] === newText[start]; start++);
		for (; oend > start && nend > start && oldText[oend - 1] === newText[nend - 1]; oend--, nend--);
		return {s: [start, nend], t: ((start === oend) ? '' : oldText.slice(start, oend))};
	}
	function applyPatch(text, diff) {
		return text.slice(0, diff.s[0]) + diff.t + text.slice(diff.s[1]);
	}
	function setUndoText(oldDiff) {
		// Restore from diff
		const oldText = that.getText();
		const newText = applyPatch(oldText, oldDiff);
		const newDiff = diff(oldText, newText);
		newDiff.c = [that.currentContent.input[0], that.currentContent.input[1]];
		// Updating text
		editor.textContent = newText;
		setAllLine();
		updateLineNumber();
		// Create currentContent
		that.currentContent.text = newText;
		that.currentContent.caret = [oldDiff.c[0], oldDiff.c[1]];
		that.currentContent.input = [oldDiff.c[0], oldDiff.c[1]];
		that.restoreSelect();
		that.showCaret();
		return newDiff;
	}
}
