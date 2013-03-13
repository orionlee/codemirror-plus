console.debug('BEGIN codemirror hack loading');
/* Test cases

<div id="test1">
  <span>foo</span>
</div> <!-- e: fold ; a: fold -->

<div id="test2">
  <div>foo
     </div>
</div> <!-- e: fold ; a: fold ; ao: fail -->

<div id="test3">
  <div id="some empty one" />
</div> <!-- e: fold: a: tbd: ao: fail -->

// running tests
xxxTagRangeFinder( _codeEditState.editor, CodeMirror.Pos(4, 0) );
CodeMirror.tagRangeFinder( _codeEditState.editor, CodeMirror.Pos(4, 0) );

CodeMirror.commands.codeFold4Html( _codeEditState.editor )
xxxCodeFold4HtmlInner( _codeEditState.editor, CodeMirror.Pos(4, 0) );

 */
if (CodeMirror.tagRangeFinder) {
  // normal case; going to patch it, but first save the original one for just in case
  CodeMirror.xxxOrigTagRangeFinder = CodeMirror.tagRangeFinder;
} else {
  console.warn('Patching likely to fail. Original CodeMirror.tagRangeFinder not found ');
}
CodeMirror.tagRangeFinder = function(cm, start) {
  console.debug('tagRangeFinder(): Running patched version');
  var nameStartChar = "A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
  var nameChar = nameStartChar + "\-\:\.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
  var xmlNAMERegExp = new RegExp("^[" + nameStartChar + "][" + nameChar + "]*");

  var lineText = cm.getLine(start.line);
  var found = false;
  var tag = null;
  var pos = start.ch;
  while (!found) {
    pos = lineText.indexOf("<", pos);
    if (-1 == pos) // no tag on line
      return;
    if (pos + 1 < lineText.length && lineText[pos + 1] == "/") { // closing tag
      pos++;
      continue;
    }
    // ok we seem to have a start tag
    if (!lineText.substr(pos + 1).match(xmlNAMERegExp)) { // not a tag name...
      pos++;
      continue;
    }
    var gtPos = lineText.indexOf(">", pos + 1);
    if (-1 == gtPos) { // end of start tag not in line
      var l = start.line + 1;
      var foundGt = false;
      var lastLine = cm.lineCount();
      while (l < lastLine && !foundGt) {
        var lt = cm.getLine(l);
        gtPos = lt.indexOf(">");
        if (-1 != gtPos) { // found a >
          foundGt = true;
          var slash = lt.lastIndexOf("/", gtPos);
          if (-1 != slash && slash < gtPos) {
            var str = lineText.substr(slash, gtPos - slash + 1);
            if (!str.match( /\/\s*\>/ )) // yep, that's the end of empty tag
              return;
          }
        }
        l++;
      }
      found = true;
    }
    else {
      var slashPos = lineText.lastIndexOf("/", gtPos);
      if (-1 == slashPos) { // cannot be empty tag
        found = true;
        // don't continue
      }
      else { // empty tag?
        // check if really empty tag
        var str = lineText.substr(slashPos, gtPos - slashPos + 1);
        if (!str.match( /\/\s*\>/ )) { // finally not empty
          found = true;
          // don't continue
        }
      }
    }
    if (found) {
      var subLine = lineText.substr(pos + 1);
      tag = subLine.match(xmlNAMERegExp);
      if (tag) {
        // we have an element name, wooohooo !
        tag = tag[0];
        // do we have the close tag on same line ???
        if (-1 != lineText.indexOf("</" + tag + ">", pos)) // yep
        {
          found = false;
        }
        // we don't, so we have a candidate...
      }
      else
        found = false;
    }
    if (!found)
      pos++;
  }

  if (found) {
    ///var startTag = "(\\<\\/" + tag + "\\>)|(\\<" + tag + "\\>)|(\\<" + tag + "\\s)|(\\<" + tag + "$)";
    ///var startTagRegExp = new RegExp(startTag);
    /// TODO: handle empty tag case, e.g, <div id="foo" />
    var startTag =  '<\\/' + tag + '>|<' + tag + '>|<' + tag + '\\s*';
    var startTagRegExp = new RegExp(startTag, 'g');    
    var endTag = "</" + tag + ">";
    var depth = 1;
    var l = start.line + 1;
    var lastLine = cm.lineCount();
    while (l < lastLine) {
      lineText = cm.getLine(l);
      ///console.debug('line: %s', lineText);
      var match = lineText.match(startTagRegExp);
      if (match) {
        for (var i = 0; i < match.length; i++) {
          ///console.debug('  %i:\t%s', depth, match[i]);
          if (match[i] == endTag)
            depth--;
          else
            depth++;
          if (!depth) return {from: CodeMirror.Pos(start.line, gtPos + 1),
                              to: CodeMirror.Pos(l, match.index)};
        }
      }
      l++;
    }
    return;
  }
};

console.debug('END codemirror hack loading');
