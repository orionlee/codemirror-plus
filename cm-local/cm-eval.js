/**
 * Provide a evalInteractive  and evalSelection commands 
 * to allow power users to develop new features more easily,
 * similar to eval-region and in emacs
 * Note: it only works in google app sandbox environment
 * which means it not work well in normal cases
 */
function initEval(cm) {

	function doEval(jsCodes) { 
    try {
      var res = eval(jsCodes);
      /// console.debug('Running code ( %s ). Result (or error): %O', jsCodes, res); 
      cm.openDialog('<button type="button">Ok</button> Result: '+  res); // should htmlescape res;
      cm._evalLastResult = res; // for power users to debug 
    } catch (e) {
      cm.openDialog('<div style="background-color: yellow; width: 100%">&nbsp;' + 
                        '<button type="button">Ok</button><span style="color: red;"> Unexpected Error in evaluating the script. ' + '. Error: ' + e.message + '</span></div>');
      cm._evalLastResult = e; // for power users to debug 
    }
  } // function doEval()
  
  function evalInteractive(cm) {

    var dialogId = "ctl_eval_" + Date.now();
    // for debug 'onkeydown="console.debug(\'keydown: %i %s\', event.keyCode, event.keyIdentifier);"' 
    cm.openDialog('Enter expresson: <input type="text" style="width: 30em;" id= "' + dialogId + '" />',  
                  doEval, {keepOpenOnBlur: true });	// keepOpenOnBlur requires the patched dialog.js
    
    /// TODO document.getElementById(dialogId).onkeypress = autoCompleteExecCmd;
  } // function evalInteractive()
  
  function evalSelection(cm) {
    var jsCodes = cm.getSelection();
    if (jsCodes) {
      doEval(jsCodes);
    } 
  } // function evalSelection(..)
  
  bindCommand(cm, 'evalInteractive', {keyName: "Alt-E" }, evalInteractive);
  bindCommand(cm, 'evalSelection', {keyName: "Shift-Alt-E" }, evalSelection);
  
}
