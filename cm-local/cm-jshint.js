// @param callback, optional
// @return a function(cm) that acts as a 
//  CodeMirror command to toggleJsHint
function createToggleJsHint(callback){
  // set by the entry point function below,
  // also serve to indicate if jshint is enabled.
  var _cm = null; 
  
  var widgets = [];
  function clearWidgets() { 
    for (var i = 0; i < widgets.length; ++i) {
      _cm.removeLineWidget(widgets[i]);
    }
    widgets.length = 0; // clear the widgets
  }
  
  function updateHints() {
    function getSelectionHandleIfAny(_cm) {
      var sel = _cm.getDoc().sel;
      if (sel.from == sel.to) {
        return null; // nothing is really selected
      } else {
        return sel;
      }
    }
    
    _cm.operation(function(){
      clearWidgets();
      var lineOffset;
      var selHandle = getSelectionHandleIfAny(_cm);
      if (!selHandle) {
        // case jshint entie buffer;
        JSHINT(_cm.getValue());
        lineOffset = 0;
      } else { // case jshint a specific portion
        JSHINT(_cm.getSelection());
        lineOffset = selHandle.from.line;        
      }

      for (var i = 0; i < JSHINT.errors.length; ++i) {
        var err = JSHINT.errors[i];
        if (!err) continue;
        var msg = document.createElement("div");
        var icon = msg.appendChild(document.createElement("span"));
        icon.innerHTML = "!!";
        icon.className = "lint-error-icon";
        msg.insertAdjacentHTML('beforeend', (err.reason + ' at char:' + err.character) + '&nbsp;&nbsp;' + 
            '<a class="lint-help" target="blank" href="http://www.google.com/search?q=' + encodeURIComponent('jslint ' + err.reason) + 
            '">Help...</a>');
        ///msg.appendChild(document.createTextNode(err.reason + ' at char:' + err.character));
        msg.className = "lint-error";
        widgets.push(_cm.addLineWidget(err.line - 1 + lineOffset, msg, {coverGutter: false, noHScroll: true}));
      }
    });
    var info = _cm.getScrollInfo();
    var after = _cm.charCoords({line: _cm.getCursor().line + 1, ch: 0}, "local").top;
    if (info.top + info.clientHeight < after)
      _cm.scrollTo(null, after - info.clientHeight + 3);
  }

  var timeoutId;
  function updateHintsOnChange() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(updateHints, 1000);
  }
  
  function enableJsHint(cm) {
    _cm = cm;
    _cm.on("change", updateHintsOnChange);
    /// updateHints(); for ease of debug
    setTimeout(updateHints, 100);      
  }

  function disableJsHint() {
    try {
      clearTimeout(timeoutId);
      clearWidgets();
      _cm.off("change", updateHintsOnChange);
    } finally {
      // being paranoid.
      _cm = null;
    }
  }
  
  function toggleJsHint(cm) {
    if (_cm) {
      disableJsHint();
      if (callback) { callback(false); }
    } else {
      enableJsHint(cm);
      if (callback) { callback(true); }
    }
  }
  
  // now return the entry point function
  return toggleJsHint;
  
} // function createToggleJsHint
