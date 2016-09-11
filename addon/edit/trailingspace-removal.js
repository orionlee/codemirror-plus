(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror/lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror/lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * Add removeTrailingSpace facilties to CodeMirror.
    * - an option remove traling space upon newline:
    * - a command to remove all trailing spaces of the current file
    *
    * @exports CodeMirror
    */
   CodeMirror) {

  /**
   * Define a new option for newlineAndIndent:
   *   newlineAndIndent: { removeTrailingSpace: true}
   * If removeTrailingSpace is set to true, then upon newline,
   * the trailing spaces of the previous line will be removed
   *
   * Internally, it is done by patching built-in newlineAndIndent command
   */
  function initNewlineAndIndentPatchOnTrailingSpace(CodeMirror) {
    if (CodeMirror.commands._newlineAndIndentOriginal) {
      if (console && console.warn) {
        console.warn('initNewlineAndIndentPatchOnTrailingSpace(): patch has previously been applied. Skip it');
      }
      return;
    }

    function removeTrailingSpaceOfPrevLine(cm) {
      var cursor = cm.getCursor();
      var lNum = cursor.line - 1;
      if (lNum >= 0) {
        var lTxt = cm.getLine(lNum);
        if (lTxt.endsWith(" ") || lTxt.endsWith("\t")) { // case has trailing space
          cm.replaceRange(lTxt.replace(/[\s\t]+$/, ''), CodeMirror.Pos(lNum, 0), CodeMirror.Pos(lNum, lTxt.length)); // essentially doing the non-standard trimRight()
        } // else no trailing spaces, just continue
      } // else the current line is the first line, just continue

    } // function removeTrailingSpaceOfPrevLine(..)

    var newlineAndIndentOriginal = CodeMirror.commands.newlineAndIndent;
    function newlineAndIndentWithTrailingSpaceOpt(cm) { // the new one decorating around the original
      newlineAndIndentOriginal(cm);
      // since I cannot change original code easily, in this implementation
      // I fetch previous line and process it accordingly
      var newlineAndIndentOpt = cm.getOption('newlineAndIndent');
      if (newlineAndIndentOpt && newlineAndIndentOpt.removeTrailingSpace) {
        removeTrailingSpaceOfPrevLine(cm);
      }
    } // function newlineAndIndentWithTrailingSpaceOpt()
    CodeMirror.commands.newlineAndIndent = newlineAndIndentWithTrailingSpaceOpt;
    CodeMirror.commands._newlineAndIndentOriginal = newlineAndIndentOriginal;
  } // function initNewlineAndIndentPatchOnTrailingSpace(..)


  /**
   * Define command removeAllTrailingSpaces(cm)
   */
  function initRemoveAllTrailingSpaces(CodeMirror) {
    function removeAllTrailingSpaces(cm) {
      var curPos = cm.getCursor(); // save cursor position
      var lines = cm.getValue().split(/[\n\r]/);
      var modified = false;
      var newLines = lines.map(function(line) {
        if (line.endsWith(" ") || line.endsWith("\t")) { // case has trailing space
          modified = true;
          return line.replace(/[\s\t]+$/, ''); // essentially doing the non-standard trimRight()
        } else {
          return line;
        }
      });
      if (modified) {
        var newText = newLines.join(cm.doc.lineSeparator());
        cm.setValue(newText);
        cm.setCursor(curPos); // restore cursor poistion.
      }
      // else do nothing: avoid unnecessarily doing cm.setValue(),
      // which will change the state of the doc and mark it as dirty.

    } // function removeAllTrailingSpaces(..)

    CodeMirror.commands.removeAllTrailingSpaces = removeAllTrailingSpaces;

  } // function initRemoveAllTrailingSpaces(..)



  //
  // main logic
  //
  initNewlineAndIndentPatchOnTrailingSpace(CodeMirror);
  initRemoveAllTrailingSpaces(CodeMirror);

});
