
(function() {
  CodeMirror.defineOption("patchAutoCloseBracketsSkipCommentline", false, function(cm, val, old) {
    var wasOn = old && old != CodeMirror.Init;
    if (val && !wasOn) {
      var patched = patchAutoCloseBracketsSkipCommentline(cm);
      if (!patched) {
        if (console && console.warn) 
          console.warn('CodeMirror patchAutoCloseBracketsSkipCommentline: option autoCloseBrackets is not on. None has been patched.');        
      }
    } else if (!val && wasOn) {
      if (console && console.error) 
        console.error('CodeMirror patchAutoCloseBracketsSkipCommentline: once patched, cannot be undone.');
    }
  });
  

  function decorateCloseBracketWithSkipCommentLine(closeBracketFunc) {
    function closeBracketWithSkipCommentLine(cm) {
      if (cm.getTokenAt(cm.getCursor()).type == 'comment') {
        // current line is a comment, do nothing extra
        return CodeMirror.Pass;
      } 
      closeBracketFunc(cm);
    } // function closeBracketWithSkipCommentLine(..)
    
    return closeBracketWithSkipCommentLine;
  } // function decorateCloseBracketWithSkipCommentLine(..)
  

  // setup logic to patch the keyMap generated by autocloseBrackets
  function patchAutoCloseBracketsSkipCommentline(cm) {
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
      for (var key in kmAutoCloseBrackets) {
        var newCloseBracketFunc =
          decorateCloseBracketWithSkipCommentLine(kmAutoCloseBrackets[key]);
        kmAutoCloseBrackets[key] = newCloseBracketFunc;
      }
      patched = true;
    }
    return patched;
  }
})();

