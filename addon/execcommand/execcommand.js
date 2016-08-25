(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror/lib/codemirror"),
        require("codemirror/addon/dialog/dialog"),
        require("../hint/show-hint-dialog"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror/lib/codemirror",
            "codemirror/addon/dialog/dialog",
            "../hint/show-hint-dialog"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * Provide a execCommandInteractive command to allow
    * users to enter any arbitary CodeMirror command, similar to M-x in emacs
    *
    * @exports CodeMirror
    */
   CodeMirror) {
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
                  doExecCommand, {closeOnBlur: false}); // closeOnBlur:false needed for autocomplete
    // Use keydown event, as keypress event does not work in some cases
    cm.getWrapperElement().querySelector('#' + dialogId).onkeydown =
      createAutoCompleteExecCmd(cm); // defined below
  } // function execCommandInteractive()

  CodeMirror.commands.execCommandInteractive = execCommandInteractive;
  CodeMirror.keyMap["default"]["Alt-X"] = "execCommandInteractive";

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

  // Create the autocomplete event handler that is tied to
  // CodeMirror instance supplied.
  function createAutoCompleteExecCmd(cm) {

    // This event handler depends on the parameter cm of the outer function 
    function autoCompleteExecCmd(event) {

      var keyName = CodeMirror.keyName(event);
      if ("Space" === keyName || "Ctrl-Space" === keyName) {
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
    } // function autoCompleteExecCmd(..)

    return autoCompleteExecCmd;
  } // function createAutoCompleteExecCmd(..)

});
