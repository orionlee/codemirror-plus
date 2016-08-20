(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {

  /**
   * Allow users to specify editor's font size
   */ 
  function setFontSizeInteractive(cm) {
    function setFontSize(size) {
      cm.getWrapperElement().style.fontSize = size;
    } // function setFontSize(..)

    var curFontSize = cm.getWrapperElement().style.fontSize || "";
    cm.openDialog('Enter new font size: <input type="text" style="width: 10em;"/>' + 
                  '<span style="color: #999">(125%, 14px, etc.)</span>', 
                  setFontSize, {value: curFontSize}); 
  } // function setFontSizeInteractive(..)

  CodeMirror.commands.setFontSizeInteractive = setFontSizeInteractive; 
});
