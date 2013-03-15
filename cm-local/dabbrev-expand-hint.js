/**
 * Return strings that begin with the word at the startPos in the editor, up to maxMatches.
 * It is similar to dabbrev-expand (M-/) in emacs.
 * Usage: auto-completion, as a hint provider for show-hint 
 */
(function() {
  // the main function
  function dabbrevExpand(cm, startPos, maxMatches) {
    // relies on 
    // 1. search addon searchcursor.js
    // 2. tokenizer in use 
    var res = [];
    maxMatches = maxMatches || 10;
    startPos = startPos || cm.getCursor();
    var query = cm.getTokenAt(startPos).string;
    if (query) {
      var wrapAroundFind = createWrapAroundFindFunc(cm, query, startPos);
      for ( var match = wrapAroundFind(); 
            match && res.length < maxMatches; 
            match = wrapAroundFind() ) {
        match = processMatch(match, query); // filter out phony ones
        if (match && res.indexOf(match) < 0) {
          res.push(match);
        }
      }	    
    }
    return res;
  } // function dabbrevExpand(..)
  
  function createWrapAroundFindFunc(cm, query, startPos) {
    startPos = startPos || cm.getCursor();
    query = query || cm.getTokenAt(startPos).string;
    var caseInSensitive = false;
    var cursor = cm.getSearchCursor(query, startPos, caseInSensitive);
    var rev = true;
    function nextCandidate() {
      var found = cursor.find(rev);
      if (!found && rev) {
        // exhaust backward search, now forward
        rev = false;
        cursor = cm.getSearchCursor(query, startPos, caseInSensitive);
        found = cursor.find(rev);
      }
      if (found) {
        return cm.getTokenAt(cursor.pos.to).string;
      } else {
        return '';
      }	    
    } // function nextCandidate()
    
    return nextCandidate;
  } // function createWrapAroundFindFunc(..)
        
  function processMatch(match, query) {
    // only take matches that begin with the query
    match = ( match.indexOf(query) == 0 ? match : '' );
    
    // TODO: OPEN - get the first word (no space) of the token, in case token is multi-word, 
    // but it is unlikely to be helpful because multi-word token are probably comments, not code
    // so we may not want to bother the extra complexity that functionally add little
    
    // last, ignore the match that is exactly the same as query
    match = ( match != query ? match : '' ); 
    
    return match;
  } // function processMatch(..)
  
  /**
   * Main entry point: 
   * it wraps around the core logic as CodeMirror hint
   */
  CodeMirror.dabbrevExpandHint = function(cm, givenOptions) {
    // 1. Find the token at the cursor
    var cur = editor.getCursor();
    var token = editor.getTokenAt(cur); 

    // invoke actual logic
    var completions = dabbrevExpand(cm, cur); 

    var res = {list: completions,
               from: CodeMirror.Pos(cur.line, token.start),
               to: CodeMirror.Pos(cur.line, token.end)};    
    return res;
  }
  
  /**
   * Helper feature to allow dabbrevExpand as a fallback hint 
   * if other hints do not return any result.
   */
  CodeMirror.createHintWithDabbrevExpandFallback = function(hint) {
  	var hintWithFallback = function(cm , givenOptions) {
      var res = hint(cm, givenOptions);
      if (!res || !res.completions || res.list.length < 1) {
        res = CodeMirror.dabbrevExpandHint(cm, givenOptions);
      }
      return res;
    }; // var hintWithFallback = function(..) 
    
    return hintWithFallback;    
  }; // CodeMirror.createHintWithFallbackdAbbrevExpand = function(..)
  
})();


