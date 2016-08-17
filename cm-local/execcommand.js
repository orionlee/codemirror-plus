/**
 * Provide a execCommandInteractive  command to allow
 * users to enter any arbitary command, similar to M-x in emacs
 */
function initExecCommand(cm) {
  // useful in cases where some command is defined but not exposed in UI
  // (This is done in a style similar to emacs)
  function execCommandInteractive(cm) {
   function doExecCommand(cmd) { 
      try {
        var res = cm.execCommand(cmd);
        /// console.debug('Executing Command %s . Result: %s', cmd, res); 
      } catch (e) {
        cm.openDialog('<div style="background-color: yellow; width: 100%">&nbsp;' + 
                          '<button type="button">Ok</button><span style="color: red;"> Error in running command ' + 
                          cmd + '. Error: ' + e.message + '</span></div>');
      }
    } // function doExecCommand()

    var dialogId = "ctl_execCmd_" + Date.now();
    // for debug 'onkeydown="console.debug(\'keydown: %i %s\', event.keyCode, event.keyIdentifier);"' 
    cm.openDialog('Enter command: <input type="text" style="width: 10em;" id= "' + dialogId + '" />' + 
                      '<span style="color: #999">(Press Help for list of commands)</span>', 
                      doExecCommand, {keepOpenOnBlur: true });	// keepOpenOnBlur requires the patched dialog.js
    // Use keydown event, as keypress event does not work in some cases
    document.getElementById(dialogId).onkeydown = autoCompleteExecCmd;
  } // function execCommandInteractive()
  
  bindCommand(cm, 'execCommandInteractive', {keyName: "Alt-X" }, execCommandInteractive);
  
  // Basics done, The following is for autocomplete
  
  function getCodeMirrorCommandHints(inpValue) {
    var res = [];
    for (var cmdName in CodeMirror.commands) {
      // all cmd starts with inpValue
      if (cmdName.indexOf(inpValue) === 0) {
        res.push(cmdName);
      }
    }
    res.sort();
    return res;
  } // function getCodeMirrorCommandHints()
  
  window.autoCompleteExecCmd  = function(event) {
    
    function isSpaceKeyPressed(event) {
      
      if (event.key && event.key != "Unidentified") { 
        // emerging standard: Chrome 51+, FF23+, IE9+, Opera 38+ but no Safari
        // @ses https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key#Browser_compatibility
        return event.key == " ";
      } else if (event.keyIdentifier && event.keyIdentifier != "U+0000") {
        // non-standard, but works for Safari 5.1+ and Chrome (26 - 52)
        // only works for keydown (NOT keypress)
        // @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyIdentifier#Browser_compatibility
        return event.keyIdentifier == "U+0020";
      } else if (event.which && event.which != 0) {
        // legacy browsers
        return event.which === 32;
      } else {
        console.warn('isSpaceKeyPressed() cannot determine if space is pressed. Likely to be a browser compatibility issue. Event: %o', event);
        return false;
      }
      // Note: event.charCode is deprecated in favor of .key
    } // function isSpaceKeyPressed(..)
    
    // if space or Ctrl-space (event.ctrlKey == true), so the logic reduced to just space
    if (isSpaceKeyPressed(event)) { 
      event.preventDefault();
      /// console.debug('Trying to to complete "%s"', event.target.value);
      var inpValue = event.target.value;
      var inpElt = event.target;
      CodeMirror.showHint4Dialog(cm, function() {
        var data = {};
        data.list = getCodeMirrorCommandHints(inpValue);
        data.inpElt = inpElt;
        return data;
      } ); 
    } // if space or ctrl-space
  }; // window.autoCompleteExecCmd
  
}
