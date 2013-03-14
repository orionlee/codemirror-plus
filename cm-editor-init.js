/**
 * This file encapsulates functions that creates and initalizes CodeMirror instances
 * with mode-appropriate feature.
 * 
 * It is agnostic to the parent UI, hence there is no DOM access here 
 * (no document, window, etc.) . The necessary parent UI access is provided via uiCtrl object.
 * 
 */

// main entry point: for initial creation
function createCodeMirror(cmElt, uiCtrl) {
  
  var cm = CodeMirror(cmElt, {
    lineNumbers: true,
    tabSize: 2, 
    lineWrapping: true, 
    matchBrackets: true,
    autoCloseBrackets: true, 
    patchAutoCloseBracketsByCurlyWithNewline: true,  // MUST be defined after autoCloseBrackets
    highlightSelectionMatches: false, // possibly troublesome when I select large amount of text 
    extraKeys: { 
      "Enter": "newlineAndIndentContinueComment" ,
      "Ctrl-I": "indentAuto"
    },    
    theme: "blackboard" // eclipse 
  });

  // main cm basics is done, now we do additional feature enhancement

  bindCommand(cm, 'autoFormatSelection', {keyName: "F12" }, 
    function(cm) {
      var range = { from: cm.getCursor(true), to: cm.getCursor(false) };
      cm.autoFormatRange(range.from, range.to);
  });


  // useful in cases where some command is defined but not exposed in UI
  // (This is done in a style similar to emacs)
  initExecCommand(cm);
  
  /// Note: eval() only works in sandbox, disable for now
  /// workaround: open devtool js console, then type:
  ///   res = eval(editor.getSelection())
  /// it achieves the same  result
  /// initEval(cm); 
  
  initGotoLine(cm);

  initColumNumberMode(cm, uiCtrl);
  cm.execCommand('toggleColumNumberMode'); // enable by default

  return cm;
} // function createCodeMirror

// Common helpers to setup CM features
function bindCommand(cm, cmdName, opts, cmdFunc) {

  function bindExtraKey(keyName) {
    // conflictsOnKey possible values: 
    //  replace (default), chain
    //  Possible to support noop
    if (opts.conflictsOnKey == 'chain') {
      var oldFunc = cm.options.extraKeys[keyName];
      if (oldFunc && typeof oldFunc == 'string') {
        // handle cases where original binding is indirectly to CodeMirror.commands 
        oldFunc = CodeMirror.commands[oldFunc]; 
      }
      cm.options.extraKeys[keyName] = 
        FunctionChainDecorator.createOrAdd(oldFunc, 
        cmdFunc, opts.chainName );
    } else { // replace (default) 
      cm.options.extraKeys[keyName] = cmdName;
    }    
  } // function bindExtraKey(..)
  
  // Possible to support chaining on existing command
  CodeMirror.commands[cmdName] = cmdFunc;

  if (opts.keyName) {
    if (opts.keyName instanceof Array) {
      opts.keyName.forEach(function (k) {
        bindExtraKey(k);
      });      
    } else { // normal case, single key
      bindExtraKey(opts.keyName);
    }
  }
  
  if (opts.eventName) {
    cm.on(opts.eventName, cmdFunc);      
  }
  
} // function bindCommand()


function initGotoLine(cm) {
  function gotoLineInteractive() {
    cm.openDialog('<span>Go to Line: <input type="number" size="6" style="width: 6em;" /></span>', function(lineNumStr) { 
      try {
        var lineNum = parseInt(lineNumStr) - 1;
        cm.setCursor(lineNum); 
      } catch (e) {
        cm.openDialog('<div style="background-color: yellow; width: 100%">&nbsp;' + 
                          '<button type="button">Ok</button><span style="color: red;">' + 
                          '. Error: ' + e.message + '</span></div>');
      }
    });
  }  
  
  bindCommand(cm, 'gotoLineInteractive', {keyName: "Alt-G" }, gotoLineInteractive);
  
}

function initColumNumberMode(cm, uiCtrl) {
  var toggleColumNumberMode = createToggleColumNumberMode(function(enabled, pos) {
  	var modType = "colNumMode";
    if (enabled) {
    	var text = 'Ch:' + (1 + pos.ch); // pos is 0-based while people prefer 1-based
    	uiCtrl.codeModeModifier.update(modType, text);
    } else {
    	uiCtrl.codeModeModifier.remove(modType);       
    }
  });
  bindCommand(cm, 'toggleColumNumberMode', {}, toggleColumNumberMode);   
} 


//
// Below are features that are mode-specific
//


// main entry point: after loading a file
// i.e, (turn to specific mode)
/**
 * @param cm the codemirror editor instance to be set
 * @param mode the mode to be set
 * @param uiCtrl  main ui control, which contains some helpers/callback to be invoked.
 *  This function should not modify the control.
 */
function initCodeMirror4Mode(cm, mode, uiCtrl) {

  var initFunc4Mode = (function() {

    function initFold4Js(cm, isChain)  {
      var conflictsOnKey = isChain ? 'chain' : 'replace';
      var codeFold4JsInner = CodeMirror.newFoldFunction(CodeMirror.braceRangeFinder);
      bindCommand(cm, 'codeFold4Js', 
        {keyName: "Ctrl-Q", conflictsOnKey: conflictsOnKey, chainName: 'codeFoldMixedMode', eventName: "gutterClick"}, 
	function(cm) { 
          codeFold4JsInner(cm, cm.getCursor().line);
      });
    
    }

    function initAutoComplete4Js(cm, isChain)  {
      var conflictsOnKey = isChain ? 'chain' : 'replace';
      // javascriptMixedModeHint can be used for both mixedmode and pure js mode
      bindCommand(cm, 'autocomplete4Js', 
        {keyName: "Ctrl-Space", conflictsOnKey: conflictsOnKey, chainName: 'autocompleteMixedMode'}, 
        function(cm) {
          CodeMirror.showHint(cm, CodeMirror.javascriptMixedModeHint); 
      });
    }

    function initJsHint(cm)  {
      // toggleJsHint is a command in the form of function(cm) {}
      var toggleJsHint = createToggleJsHint(function(jsHintEnabled) {
        var modType = 'jsHint';
        if (jsHintEnabled) {
          uiCtrl.codeModeModifier.update(modType, '[JSHint]');
        } else {
          uiCtrl.codeModeModifier.remove(modType);
        }
      });

      bindCommand(cm, 'toggleJsHint',  {keyName: "F10" }, 
        toggleJsHint); 
    }

    function initFold4Html(cm, isChain) {
      var conflictsOnKey = isChain ? 'chain' : 'replace';
      var codeFold4HtmlInner = CodeMirror.newFoldFunction(CodeMirror.tagRangeFinder);
      bindCommand(cm, 'codeFold4Html',  
        {keyName: "Ctrl-Q", conflictsOnKey: conflictsOnKey, chainName: 'codeFoldMixedMode', eventName: "gutterClick" }, 
        function(cm){ 
          codeFold4HtmlInner(cm, cm.getCursor().line);
      });
 
    }

    function initAutoComplete4Css(cm, isChain)  {
      var conflictsOnKey = isChain ? 'chain' : 'replace';
      bindCommand(cm, 'autocomplete4Css', 
        {keyName: "Ctrl-Space", conflictsOnKey: conflictsOnKey, chainName: 'autocompleteMixedMode'}, 
        function(cm) {
          CodeMirror.showHint(cm, CodeMirror.cssHint);
      });
    }
  
    var res = {
      javascript: function(cm) {
        initFold4Js(cm);
        initAutoComplete4Js(cm);
        initJsHint(cm); // the syntax checker

      }, // javascript : ...

      css: function(cm) {
        var codeFold4CssInner = CodeMirror.newFoldFunction(CodeMirror.braceRangeFinder);
        bindCommand(cm, 'codeFold4Css',  
          {keyName: "Ctrl-Q", conflictsOnKey: 'chain', chainName: 'codeFoldMixedMode', eventName: "gutterClick" }, 
          function(cm){ 
            codeFold4CssInner(cm, cm.getCursor().line);
        });

        initAutoComplete4Css(cm);
  
      }, // css : ...

      htmlmixed: function(cm) {
        var chain = true;
        initAutoComplete4Js(cm, chain); 

        initFold4Js(cm, chain);
        initJsHint(cm); // the syntax checker

        initFold4Html(cm, chain);
        // MUST use setOption(), or the option's associated action won't take effect
        cm.setOption("autoCloseTags", true);


        // no need to add codefolding for css, as it's the same as js
        initAutoComplete4Css(cm, chain);

      }  // htmlmixed: ...
    }; // var res;
    return res;
  })(); // var initFunc4Mode = 

  //
  // main logic
  //  
  
  var modeInitFunc = initFunc4Mode[mode];
  if (modeInitFunc) { 
    try {
      modeInitFunc(cm); 
    } catch(e) {
      console.group('modeInitFunc:'+mode);
      console.error('Error in initializing %s-specific features. Some features might not work.', mode);
      console.error(e.stack);
      console.groupEnd();
    }
  }

  // modes have setup theirs, including code-folding,
  //   now I'm ready to create an aggregate one
  function codeFoldAll(cm, codeFoldCommand) {
    if (!codeFoldCommand) { return; }
  
    for(var i = 0; i < cm.lineCount(); i++) { 
      if (cm.getLineHandle(i).height > 0) {
        cm.setCursor(CodeMirror.Pos(i, 0));
        codeFoldCommand( cm );
      } // else line is already hidden
    }
  }
  bindCommand(cm, 'toggleCodeFoldAll', {keyName: "Shift-Ctrl-Q" }, 
    function(cm) {
      codeFoldAll(cm, cm.options.extraKeys['Ctrl-Q']);
  });
 
} // function initCodeMirror4Mode()
