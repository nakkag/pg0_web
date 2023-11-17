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

function getEditorLineCount() {
	const editor = document.getElementById('editor');
	const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
	let cnt = 0;
	let node;
	let firstDiv = true;
	while ((node = walker.nextNode())) {
		if (node.childNodes && node.childNodes.length > 0 && node.childNodes[0].tagName === 'DIV') {
			continue;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			const l = node.nodeValue.split('\n');
			if (l.length > 1) {
				cnt += l.length - 1;
			}
		} else if (node.tagName === 'DIV') {
			if (firstDiv) {
				firstDiv = false;
				continue;
			}
			cnt++;
		}
	}
	return cnt;
}

function escape(str) {
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
	const editor = document.getElementById('editor');
	unsetHighlight();
	const lines = editor.childNodes;
	const line = lines[lineNumber].textContent;
	lines[lineNumber].innerHTML = `<div><span class="highlight" style="background-color: ${color};">${setKeyword(escape(line))}</span></div>`;

	const elements = document.getElementsByClassName('highlight');
	if (elements && elements.length > 0) {
		const element = elements[0];
		const targetDOMRect = element.getBoundingClientRect();
		const ec = document.getElementById('editor_container');
		if (element.offsetTop < ec.scrollTop || element.offsetTop + element.offsetHeight > ec.scrollTop + ec.clientHeight) {
			element.scrollIntoView({behavior: 'instant', block: 'nearest'});
		}
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
				newContent += `<div>${setKeyword(escape(line))}</div>`;
			}
		});
		editor.innerHTML = newContent;
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
	
	function updateContent() {
		const caretPosition = getCaretCharacterOffsetWithin(editor);
		setAllLine();
		setCaretPosition(editor, caretPosition);
	}

	let oldLine = 0;
	editor.addEventListener('input', function(e) {
		const cnt = getEditorLineCount();
		if (oldLine !== cnt) {
			oldLine = cnt;
			updateContent();
		}
	}, false);

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			document.execCommand('insertText', false, "\t");
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			updateContent();
		}
	}, false);

	editor.addEventListener('paste', function(e) {
		setTimeout(function() {
			updateContent();
			oldLine = getEditorLineCount();
		}, 0);
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
		
		const selection = window.getSelection();
		if (selection.type === 'Caret') {
			updateContent();
			oldLine = getEditorLineCount();
		}
	};

	let prevCaret = -1;
	let prevRanges = [];
	let sc = {x: 0, y: 0};
	editor.addEventListener('focus', function(e) {
		if (prevCaret >= 0) {
			setCaretPosition(editor, prevCaret);
			prevCaret = -1;
		}
		if (prevRanges.length > 0) {
			const selection = window.getSelection();
			selection.removeAllRanges();
			for (let i = 0; i < prevRanges.length; i++) {
				selection.addRange(prevRanges[i]);
			}
			prevRanges = [];
		}
		editorContainer.scrollTo(sc.x, sc.y);
	}, false);

	editor.addEventListener('blur', function(e) {
		const selection = window.getSelection();
		prevRanges = [];
		for (let i = 0; i < selection.rangeCount; i++) {
			prevRanges.push(selection.getRangeAt(i).cloneRange());
		}
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
