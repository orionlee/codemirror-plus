/**
 * Support javascript autocomplete in mixed html environment
 *
 * Dependency at runtime: Underlying autocomplete
 * CodeMirror.javascriptHint has been setup
 */
(function () {
  //
  // the main logic
  //  
  CodeMirror.javascriptMixedModeHint = function(editor, givenOptions) {
    var res = null;
    // 1. Find the token at the cursor
    var cur = editor.getCursor();
    var token = editor.getTokenAt(cur); 

    // 2. if the token is a context NOT for javascript
    //    skip it. (blacklist approach)
    var inUnsupportedMode = {css: true, html: true};
    if ( token.state && token.state.token && inUnsupportedMode[token.state.token.name] ) {
      return null; // case mixedhtml css context, or the main html context
    }
    // alternative considered: use a whitelist approach, ie, pure javascript or js in html
    // the downside is in unforseen scenario (that actually is js), we risk not running it.
    // the actual logic for such case would be:
    //  state.tokenize.name == 'jsTokenBase' (pure js mode)
    //  state.token.name == 'script' (js in mixedhtml mode)
   
    // 3. the context is okay, run the underlying hint    
    return CodeMirror.javascriptHint(editor, givenOptions);
        
  }; // javascriptMixedModeHint = function ...
  
})();
