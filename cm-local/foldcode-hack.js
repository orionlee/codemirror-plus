console.debug('Hacking CodeMirror.braceRangeFinder to support both forward and backward.');

console.assert(typeof CodeMirror.braceRangeFinder == 'function', 'function CodeMirror.braceRangeFinder should have been defined.');
if (typeof CodeMirror.braceRangeFwdFinder == 'undefined') {
  CodeMirror.braceRangeFwdFinder = CodeMirror.braceRangeFinder;  
} else {
  console.warn('CodeMirror.braceRangeFwdFinder has been defined, indicating hack has been installed. Try overriding.');
}


CodeMirror.braceRangeBackFinder = function(cm, start) {
  var line = start.line, lineText = cm.getLine(line);
  var at = lineText.length, startChar, tokenType;
  for (;;) {
    var found = lineText.lastIndexOf("}", at);
    if (found < start.ch) break;
    tokenType = cm.getTokenAt(CodeMirror.Pos(line, found + 1)).type;
    if (!/^(comment|string)/.test(tokenType)) { startChar = found; break; }
    at = found - 1;
  }
  if (startChar == null || (lineText.lastIndexOf("{") >= 0 && lineText.lastIndexOf("{") < startChar)) return;
  // End condition: ending } at startChar with type tokenType.  There is no same-line matching { either.
  var count = 1, lastLine = cm.lineCount(), end, endCh;
  outer: for (var i = line - 1; i >= 0; --i) {
    var text = cm.getLine(i), pos = text.length;
    for (;;) {   
      var nextOpen = text.lastIndexOf("{", pos), nextClose = text.lastIndexOf("}", pos);
      pos = Math.max(nextOpen, nextClose);
      if (pos < 0) break;
      if (cm.getTokenAt(CodeMirror.Pos(i, pos + 1)).type == tokenType) {
        if (pos == nextClose) ++count;
        else if (!--count) { end = i; endCh = pos; break outer; }
      }
      --pos;
    }
  }
  if (end == null || end == line - 1) return;
  return {from: CodeMirror.Pos(end, endCh + 1),
          to: CodeMirror.Pos(line, startChar)};
};

CodeMirror.braceRangeFinder = function(cm, start) {
  var res = CodeMirror.braceRangeFwdFinder(cm, start);
  if (!res) {
    res = CodeMirror.braceRangeBackFinder(cm, start);
  } // if (!res) {
  return res;
};
