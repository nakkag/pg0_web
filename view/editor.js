const keywords = ['var', 'exit', 'if', 'else', 'while'];
const keywords_extension = ['for', 'do', 'break', 'continue', 'switch', 'case', 'default', 'return', 'function', 'import', 'option'];

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

function setKeyword(str) {
    str = str.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="string-literal">"$1"</span>');
    str = str.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="string-literal">"$1"</span>');
	str = str.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi'), 
		(match) => `<span class="keyword">${match}</span>`);
	str = str.replace(new RegExp(`\\b(${keywords_extension.join('|')})\\b`, 'gi'), 
		(match) => `<span class="keyword">${match}</span>`);
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
	let str = getEditorText();
	const lines = str.split("\n");
	let newContent = '';
	lines.forEach(function(line, index) {
		if (!line) {
			newContent += `<div><br /></div>`;
		} else if (index === lineNumber) {
			newContent += `<div><span class="highlight" style="background-color: ${color};">${setKeyword(line)}</span></div>`;
		} else {
			newContent += `<div>${setKeyword(line)}</div>`;
		}
	});
	editor.innerHTML = newContent;

	const elements = document.getElementsByClassName('highlight');
	if (elements && elements.length > 0) {
		const element = elements[0];
		const targetDOMRect = element.getBoundingClientRect();
		if (element.offsetTop < editor.scrollTop || element.offsetTop + element.offsetHeight > editor.scrollTop + editor.clientHeight) {
			element.scrollIntoView({behavior: 'instant'});
		}
	}
}

document.addEventListener('DOMContentLoaded', function() {
	const editor = document.getElementById('editor');

	function setAllLine() {
		let str = getEditorText();
		const lines = str.split("\n");
		let newContent = '';
		lines.forEach(function(line, index) {
			if (!line) {
				newContent += `<div><br /></div>`;
			} else {
				newContent += `<div>${setKeyword(line)}</div>`;
			}
		});
		editor.innerHTML = newContent;
	}

	function getCaretCharacterOffsetWithin(element, container, offset) {
		const doc = element.ownerDocument || element.document;
		const win = doc.defaultView || doc.parentWindow;
		const range = doc.createRange();
		range.setStart(container, offset);
		range.setEnd(container, offset);
		range.collapse(true);

		const tempRange = range.cloneRange();
		tempRange.selectNodeContents(element);
		tempRange.setEnd(range.endContainer, range.endOffset);
		return tempRange.toString().length;
	}

	function setCaretPosition(element, position) {
		const range = document.createRange();
		const selection = window.getSelection();
		range.setStart(element, 0);
		range.collapse(true);

		const nodeStack = [element];
		let node;
		let foundStart = false;
		let stop = false;
		while (!stop && (node = nodeStack.pop())) {
			if (node.nodeType == Node.TEXT_NODE) {
				const nextCharIndex = position - node.length;
				if (nextCharIndex <= 0) {
					range.setStart(node, position);
					foundStart = true;
					break;
				}
				position = nextCharIndex;
			} else {
				let i = node.childNodes.length;
				while (i--) {
					nodeStack.push(node.childNodes[i]);
				}
			}
		}
		if (foundStart) {
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}

	editor.addEventListener('input', function(e) {
		const selection = window.getSelection();
		const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
		const startContainer = range.startContainer;
		const startOffset = range.startOffset;
		const caretPosition = getCaretCharacterOffsetWithin(editor, startContainer, startOffset);

		setAllLine();

		setCaretPosition(editor, caretPosition, 0);
	}, false);

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

	editor.addEventListener('keydown', function(e) {
		if (e.key === 'Tab') {
			e.preventDefault();
			document.execCommand('insertText', false, "\t");
		} else if (e.key === 'Enter') {
			event.preventDefault();
			const index = getFocusLine();

			document.execCommand('insertText', false, "\n");

			const selection = window.getSelection();
			const range = new Range();
			range.setStart(editor.childNodes[index + 1].childNodes[0], 0);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}, false);
}, false);
