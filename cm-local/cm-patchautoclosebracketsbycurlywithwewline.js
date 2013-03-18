
(function() {
  CodeMirror.defineOption("patchAutoCloseBracketsByCurlyWithNewline", false, function(cm, val, old) {
    var wasOn = old && old != CodeMirror.Init;
    if (val) {
      var patched = patchAutoCloseBracketsByCurlyWithNewline(cm);
      if (!patched) {
        if (console && console.warn) 
          console.warn('CodeMirror patchAutoCloseBracketsByCurlyWithNewline: option autoCloseBrackets is not on. None has been patched.');        
      }
    } else if (!val && wasOn) {
      if (console && console.error) 
        console.error('CodeMirror patchAutoCloseBracketsByCurlyWithNewline: once patched, cannot be undone.');
    }
  });
  

  /**
   * Pos cases (end comment, with newline):
   *     function foo(bar) {
   *     function foo() {
   *     var foo = function(bar) {
   *     window.foo = function(bar) {
   *     foo = function(bar) {
   *     var foo = (function(bar) {
   *     (function(bar) {
   * Pos cases (end comma, no newline):
   *     bar = {}; 
   *     var bar = {}; 
   *     window.bar = {}; 
   * Neg cases (no end comment, wth newline):
   *     callFun(bar, function() {
   *     callFun(bar, function() {) <-- end bracket of callFun has been inserted
   *     var res = callFun(bar, function() {
   *     for (i = 0; i < foo; i++ ) {
   *     if (foo < bar) {
   *     if foo < bar {
   *     } else if (boo>bar) {
   *     while (foo<bar) {
   *     do { 
   * Neg cases (no end comment or comma, no newline):
   *     foo(arg1, {}...)
   * 
   * Cases where current line is a comment is handled out of scope
   * 
   * @param line the line of the text where the open curly is about to be inserted
   *  (but not yet inserted). While typically the open curly is to be inserted 
   *  at the end of the line, the insertion point could also be anywhere else.
   */  
  function genJsCloseCurlyPosAndComment(line) {
    var isCloseCurlyNewline = true; // default
    var comment;
    
    // form function foobar(maybeVar) {
    var reFuncNamed = /^\s*function\s+([^(\s]+)\s*\(([^)]*)\)/ ;
  
    // form  var bar = function(maybeVar) { .. expected closing line ;
    // or form  bar = function(maybeVar) { .. expected closing line ;
    // or form  window.bar = function(maybeVar) { .. expected closing line ;
    var reFuncAnonyWithVar = /^\s*(?:var\s+)?([^=,\s]+)\s*=\s*function\s*\(([^)]*)\)/ ;

    // form  var bar = (function(maybeVar) { ... expected closing line: }();
    var reFuncAnonyApplyWithVar = /^\s*(?:var\s+)?([^=\s]+)\s*=\s*\(function\s*\(([^)]*)\)/ ;
        
    // form  (function(maybeVar) { ... expected closing line: }();
    var reFuncAnonyApplyNoVar = /^\s*\(function\s*\(([^)]*)\)/ ;

    // form  foo(arg1, function(maybeVar) { ... expected closing line: }();
    // the pattern is more generic than other patterns for function,
    // so it should be tested last 
    var reFuncAnonyOthers = /function\s*\(([^)]*)\)\s*[)]?$/ ;

    var reObjCreation = /^\s*(?:var\s+)?([^=,\s]+)\s*=\s*$/; // about to type { at the end of line

    // intent to cover cases such as if (expr) {  ; for(expr) {, while(expr) {, do {
    // the expression is more generic so it should be tested at the end,
    // while the more specific ones are tested first
    var reLoopAndCondExpr = /^\s*([}]\s*)?(if|else|switch|while|do).*[^{]$/; // about to type { at the end of line
    
    var matched;
    if (matched = line.match(reFuncNamed)) {
      comment = " // function " + matched[1] + "(" + (!matched[2] ? "" : "..") + ")";
    } else if (matched = line.match(reFuncAnonyWithVar)) {
      comment = "; // " + matched[1] + " = function(" + (!matched[2] ? "" : "..") + ")";
    } else if (matched = line.match(reFuncAnonyApplyWithVar)) {
      comment = ")(); // " + matched[1] + " = (function(" + (!matched[2] ? "" : "..") + ")";
    } else if (matched = line.match(reFuncAnonyApplyNoVar)) {
      comment = ")(); // (function(" + (!matched[1] ? "" : "..") + ")";
    } else if (matched = line.match(reFuncAnonyOthers)) {
      comment = "";
    } else if (matched = line.match(reObjCreation)) {
      isCloseCurlyNewline = false;
      comment = ";";  // not exactly comment but the comma is helpful for the end user.
    } else if (matched = line.match(reLoopAndCondExpr)) {
      isCloseCurlyNewline = true;
      comment = "";
    } else { // others, covering cases suc as func1(arg1, {})
      isCloseCurlyNewline = false;
      comment = "";
    }
    
    return {
      isCloseCurlyNewline: isCloseCurlyNewline, 
      comment: comment 
    };
  } // function genJsCloseCurlyPosAndComment(..)

  // the main runtime logic
  function autoCloseCurly(cm) {
    var left='{', right ='}';
    // should be in closure
    var cur = cm.getCursor("start");
    var state = genJsCloseCurlyPosAndComment(cm.getLine(cur.line));
    // handle if close curly should be at a new line
    var ahead, anchor, outstr;    
    if (state.isCloseCurlyNewline) {
      ahead = CodeMirror.Pos(cur.line + 2, 0);
      anchor =  CodeMirror.Pos(cur.line + 1, 0);
      outStr = left + '\n\n' + right;
    } else {
      ahead = CodeMirror.Pos(cur.line, cur.ch + 1);
      anchor =  ahead;
      outStr = left + right;      
    }
    
    if (state.comment) {
      outStr += state.comment;
      ahead = CodeMirror.Pos(ahead.line, state.comment.length + 1 - 1); // needed to include } but zero-based
    } 
    cm.replaceSelection(outStr, { head: ahead, anchor: anchor });
    if (state.isCloseCurlyNewline) {
      cm.setCursor(ahead);
      cm.execCommand('indentAuto');
      cm.setCursor(anchor);
      cm.execCommand('indentAuto');
    }
  } // function autoCloseCurly(..)
  
  // setup logic to patch the keyMap generated by autocloseBrackets
  function patchAutoCloseBracketsByCurlyWithNewline(cm) {
    var kms = cm.state.keyMaps;
    var i, kmAutoCloseBrackets; 
    for(i = 0; i < kms.length; i++) {
      if (kms[i].name == 'autoCloseBrackets') {
        kmAutoCloseBrackets = kms[i];
        break;
      }
    }
    var patched = false;
    if (kmAutoCloseBrackets) {
      kmAutoCloseBrackets["'{'"] = autoCloseCurly;
      patched = true;
    }
    return patched;
  }
})();

