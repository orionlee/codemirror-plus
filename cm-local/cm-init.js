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
    patchAutoCloseBracketsSkipCommentline: true, // MUST be defined after all closeBrackets option
    highlightSelectionMatches: false, // possibly troublesome when I select large amount of text 
    extraKeys: { 
      "Enter": "newlineAndIndentContinueComment" ,
      "Ctrl-I": "indentAuto"
    }
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

  // a fallback autocomplete that is not mode-specific
  // behavior similar to emacs dabbrev-expand M-/
  initDabbrevExpandAutoComplete(cm);
  
  initSelectFold(cm);
  initSelectToLine(cm);
  
  extendSearchUI(cm, uiCtrl);
  return cm;
} // function createCodeMirror

function extendSearchUI(cm, uiCtrl) {
  // build-in CodeMirror search does not provide any hooks to add features (such as UI)
  // here we use a workaround by observing changes in CodeMirror 
  // internal state cm._searchState, and invokes UI callback to update changes

  if (!uiCtrl.setSearchStatus) {
    console.debug('extendSearchUI(): uiCtrl does not implement setSearchStatus(). No extended UI will be used.');
    return;
  }
  
  // the observer to be used to trigger UI
  function onSearchChange(changes) {
    // built-in search only searches one at a time and does not provide count
    // hence we are doing a separate search to get the count 
    // a caveat is when the editor content changes, the count does not change.
    // but it should be close enough match for it to happen.
    //
    // alternative rejected: 
    //  use the count from overlay, i.e., cm.getWrapperElement().querySelectorAll('.cm-searching').length
    // in addition to being hacky, the overlay is not complete, because 
    //  overlay works on the stream (part of the text that is on display), rather than whole body
    function countNumMatched(query) {
      var qryREActual = (function() {
        if (typeof(query) === 'string') {
          if (query.toLowerCase() === query) {
            // case insenstive search
            return new RegExp(query, 'gi');          
          } else {
            return new RegExp(query, 'g');          
          }
        } else if (RegExp.prototype.isPrototypeOf(query)) { 
          // query is already a regex, create a global version
          return new RegExp(query.source, 
                            'g' + (query.ignoreCase ? 'i' : '') + (query.multiline ? 'm' : '')
                           );        
        } else {
          throw new TypeError('countNumMatched(query): query must be a string or RegExp: ', query);                   
        }      
      })(); // qryREActual = (function()
      
      var matches = cm.getValue().match(qryREActual);
      matches = (matches ? matches.length : 0);
      return matches;
    } // function countNumMatched()
    
    
    for(var i = 0; i < changes.length; i++) {
      var ch = changes[i];
      if (ch.name === 'query') {
        if (ch.type === 'delete' || ch.object.query === null) {
          uiCtrl.setSearchStatus(null, 0);
        } else {
          var query = ch.object.query;
          var numMatched = countNumMatched(query);
          uiCtrl.setSearchStatus(query, numMatched);          
        }
        return; // don't care any further changes
      }
    }  
  } // function onSearchChange(..)
  
  function findWithExtendUI(cm) {
    CodeMirror.commands.find(cm);
    // search UI invoked, so cm._searchState should be there
    // try to register the observer for changes
    if (cm._searchState && !cm._searchState.observer) {
      cm._searchState.observer = onSearchChange;
      Object.observe(cm._searchState, onSearchChange);  
    } 
  } // function findWithExtendUI()
  
  cm.addKeyMap({
    "Ctrl-F": findWithExtendUI
  });  
} // function extendSearchUI(..)


function initGotoLine(cm) {
  function gotoLineInteractive() {
    cm.openDialog('<span>Go to Line: <input type="number" size="6" style="width: 6em;" /></span>', function(lineNumStr) { 
      try {
        var lineNum = parseInt(lineNumStr, 10) - 1;
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

function initDabbrevExpandAutoComplete(cm)  {
  bindCommand(cm, 'dabbrevExpand', 
    {keyName: "Ctrl-/"}, 
    function(cm) {
      CodeMirror.showHint(cm, CodeMirror.dabbrevExpandHint);
  });
}

function initSelectFold(cm) {
  function selectFold(cm) {
    // TODO: use a rangeFinder sensitive to current mode(e.g. tag for html, brace for css, etc.)
    var foldRange = CodeMirror.braceRangeFinder(cm, CodeMirror.Pos(cm.getCursor().line, 0));
    if (foldRange) {
      cm.setSelection(CodeMirror.Pos(foldRange.from.line, 0), CodeMirror.Pos(foldRange.to.line));    
    }
  }  
  
  bindCommand(cm, 'selectFold', {keyName: "Ctrl-Alt-Q" }, selectFold);
  
}

function initSelectToLine(cm) {
  function selectToLineInteractive(cm) {
    var curLine = cm.getCursor().line;
    cm.openDialog('<span>Select to Line (cur: ' + (curLine+1) + '): <input type="number" size="6" style="width: 6em;" /></span>', function(lineNumStr) { 
      try {
        var lineNum = parseInt(lineNumStr, 10) - 1;
        var stLine, endLine;
        if (curLine < lineNum) {
          stLine = curLine; endLine = lineNum;
        } else {
          stLine = lineNum; endLine = curLine;
        }
        cm.setSelection(CodeMirror.Pos(stLine, 0), CodeMirror.Pos(endLine));    
      } catch (e) {
        cm.openDialog('<div style="background-color: yellow; width: 100%">&nbsp;' + 
                          '<button type="button">Ok</button><span style="color: red;">' + 
                          '. Error: ' + e.message + '</span></div>');
      }
    });
  }  
  
  bindCommand(cm, 'selectToLineInteractive', {keyName: "Ctrl-Alt-G" }, selectToLineInteractive);
  
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
      var jsMixedModeWithDabbrevFallbackHint = 
          CodeMirror.createHintWithDabbrevExpandFallback(CodeMirror.javascriptMixedModeHint);
      bindCommand(cm, 'autocomplete4Js', 
        {keyName: "Ctrl-Space", conflictsOnKey: conflictsOnKey, chainName: 'autocompleteMixedMode'}, 
        function(cm) {
          CodeMirror.showHint(cm, jsMixedModeWithDabbrevFallbackHint); 
      });
    }

    function initJsHint(cm)  {
      // toggleJsHint is a command in the form of function(cm) {}
      var cmds = createJsHintCommands(function(jsHintEnabled, numIssues) {
        var modType = 'jsHint';
        if (jsHintEnabled) {
          var msg = numIssues ? '[JSHint:' + numIssues + ']' : '[JSHint]' ;
          uiCtrl.codeModeModifier.update(modType, msg);
        } else {
          uiCtrl.codeModeModifier.remove(modType);
        }
      });

      bindCommand(cm, 'toggleJsHint',  {keyName: "F10" }, 
        cmds.toggleJsHint); 
      bindCommand(cm, 'enableJsHint',  {}, cmds.enableJsHint); 
      bindCommand(cm, 'disableJsHint',  {}, cmds.disableJsHint); 
    }

    /**
     *  Patch javascript mode so that lines begin with 
     *  1) function call (.) or,
     *  2) concatentation (+) 
     *  will be indented.
     * 
     *  Examples:
     *  foo.func1(arg1)
     *    .func2(arg2);
     *  
     *  foo = 'string1'  
     *    + 'string2'
     *    + 'string3';
     * 
     */ 
    function patchJsIndent(cm) {
      var jsMode = cm.getMode('javascript');
      console.assert(!jsMode._indentOrig, 'javascript mode: indent() has been patched unexpectedly');
      jsMode._indentOrig = jsMode.indent;
      var indentUnit = cm.getOption('indentUnit');
      
      jsMode.indent = function(state, textAfter) { 
        // BEGIN mimic original code's boundary initial case check
        if (state.tokenize.name == 'jsTokenComment') return CodeMirror.Pass;
        if (state.tokenize.name != 'jsTokenBase') return 0;
        // END mimic original code's boundary initial case check
        var firstChar = textAfter && textAfter.charAt(0), lexical = state.lexical;
        if (firstChar === '.' || firstChar === '+') return lexical.indented + indentUnit;
        return jsMode._indentOrig(state, textAfter); 
      };
      
      // Patch electricChars so that upon typing dot(.) or plus(+)
      // the line will be automatically indented.
      console.assert(!jsMode._electricCharsOrig, 'javascript mode: electricChars has been patched unexpectedly');
      jsMode._electricCharsOrig = jsMode.electricChars;
      jsMode.electricChars +=  ".+";
    } // function patchJsIndent(..)

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
      var cssWithDabbrevFallbackHint = 
          CodeMirror.createHintWithDabbrevExpandFallback(CodeMirror.cssHint);      
      bindCommand(cm, 'autocomplete4Css', 
        {keyName: "Ctrl-Space", conflictsOnKey: conflictsOnKey, chainName: 'autocompleteMixedMode'}, 
        function(cm) {
          CodeMirror.showHint(cm, cssWithDabbrevFallbackHint);
      });
    }
  
    
    var res = {
      javascript: function(cm) {
        initFold4Js(cm);
        initAutoComplete4Js(cm);
        initJsHint(cm); // the syntax checker
        patchJsIndent(cm);

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
    if (typeof codeFoldCommand == 'string') {
      codeFoldCommand = CodeMirror.commands[codeFoldCommand];
    }
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
      // use extraKeys indirection so that the mode-specific folding will be selected
      // at runtme.
      codeFoldAll(cm, cm.options.extraKeys['Ctrl-Q']);
  });
 
} // function initCodeMirror4Mode()
