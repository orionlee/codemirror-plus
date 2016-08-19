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
      "Ctrl-I": "indentAuto",
      "Ctrl-Q": "toggleFold",
      "Shift-Ctrl-Q": "foldAll", // toggleFoldAll is problematic both semantically and implementation
      "Ctrl-Space": "autocomplete",
    },
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    foldOptions: { minFoldSize: 1, scanUp: true },
    continueComments: true,
  });


  // in CMv5, mode is defaulted to javascript, we MUST NOT want to make such assumption here,
  // as some caller (such as standalone editor.js assumes the initial mode to be empty,
  // and runs initCodeMirror4Mode() only when the new file's mode is to be different
  cm.setOption('mode', '');

  // main cm basics is done, now we do additional feature enhancement

  // Convention for initXXX() functions:
  // if supplied with cm ,
  //   the function changes the current CodeMirror instance,
  //   and typically adds something to CodeMirror class, e.g., new commands
  // if supplied with CodeMirror,
  //   the function changes CodeMirror class only, typically adding new commands

  // useful in cases where some command is defined but not exposed in UI
  // (This is done in a style similar to emacs)
  initExecCommand(cm);

  initEval(cm);

  initColumNumberMode(cm, uiCtrl);
  cm.execCommand('toggleColumNumberMode'); // enable by default

  // bind anyword-hint to Ctrl-/ for a non mode-specific autocomplete (fallback for user)
  //  It is in the spirit of emacs M-/ dabbrev-expand
  bindCommand(cm, 'autocompleteAnyword', {keyName: "Ctrl-/" }, function(cm) {
    editor.showHint({hint: CodeMirror.helpers.hint.anyword});
  });

  initSelectFold(cm);
  initSelectToLine(cm);

  extendSearchUI(cm, uiCtrl);

  initToggleShowTrailingSpace(CodeMirror);
  cm.setOption('newlineAndIndent', {removeTrailingSpace: true} ); // depends on trailingspace-removal.js

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

  // the observer/Eventlistener-like callback to be used to trigger UI
  function onSearchChange(evt) {
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

    // Main logic
    if (!evt.query) {
      uiCtrl.setSearchStatus(null, 0);
    } else {
      var numMatched = countNumMatched(evt.query);
      uiCtrl.setSearchStatus(evt.query, numMatched);
    }

  } // function onSearchChange(..)

  function findWithExtendUI(cm) {
    CodeMirror.commands.find(cm);
    // search UI invoked, so cm._searchState should be there
    // try to register the observer for changes
    if (cm._searchState && !cm._searchState.onQueryChange) {
      cm._searchState.onQueryChange = onSearchChange;
    }
  } // function findWithExtendUI()

  cm.addKeyMap({
    "Ctrl-F": findWithExtendUI
  });
} // function extendSearchUI(..)


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

function initSelectFold(cm) {
  function selectFold(cm) {
    // Use cm.findMatchingBracket(), rather than fold logic (CodeMirror.helpers.fold.auto)
    // to implement fold selection.
    // Pro:  can match bold forward and backward (fold logic only matches forward)
    // Cons: does not support non-bracket fold selection, e.g., fold by tags

    function toFoldRange(bracketRange) {
      if (!bracketRange ||  !bracketRange.match) {
        return null;
      }
      // else normal case of a matched bracket range
      var foldRange;
      if (bracketRange.forward) {
        foldRange = { from: CodeMirror.Pos(bracketRange.from.line, 0),
                      to: CodeMirror.Pos(bracketRange.to.line) };
      } else {
        foldRange = { from: CodeMirror.Pos(bracketRange.to.line, 0),
                      to: CodeMirror.Pos(bracketRange.from.line) };
      }
      return foldRange;
    } // function toFoldRange(..)

    // find matching bracket of cursor, and if cursor is not a bracket
    // use the first bracket of the current line to find matching bracket
    function findMatchingBracketOfCurLine(cm) {
      var bracketRange = cm.findMatchingBracket(cm.getCursor());
      if (!bracketRange ||  !bracketRange.match) {
        // case no matching bracket at current cursor, probably current cursor not a bracket
        // try to use a bracket of curLine as the starting point
        var bracketStartPos = (function() {
          var line = cm.getCursor().line;
          var text = cm.getLine(line) || '';
          // find a bracket, i.e., []{},  to start the match ( exclude ()  as they are not pertintent to fold)
          var ch = text.search(/[{}\[\]]/);

          var res = ch >= 0 ?  CodeMirror.Pos(line, ch) : null;
          return res;
        })(); // bracketStartPos = (function())

        if (bracketStartPos) {
          bracketRange = cm.findMatchingBracket(bracketStartPos);
        } else { // case no bracket at current line found, so no bracketRange
          bracketRange = null;
        }
      } // if (!bracketRange ...

      return bracketRange;
    } // function findMatchingBracketOfCurLine(..)

    //
    // main logic
    //
    var bracketRange = findMatchingBracketOfCurLine(cm);
    var foldRange = toFoldRange(bracketRange);
    if (foldRange) {
      cm.setSelection(foldRange.from, foldRange.to);
    }
  } // function selectFold()

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

function initToggleShowTrailingSpace(CodeMirror) {
  function toggleShowTrailingSpace(cm) {
    var oldVal = cm.getOption('showTrailingSpace');
    var newVal = !oldVal;
    cm.setOption('showTrailingSpace', newVal);
    return newVal;
  } // function toggleShowTrailingSpace(..)

  CodeMirror.commands.toggleShowTrailingSpace = toggleShowTrailingSpace;
} // function initToggleShowTrailingSpace()


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
        // CodeMirror javascript mode v3 uses jsTokenXxx, while v5 uses tokenXxx
        /// v3: if (state.tokenize.name == 'jsTokenComment') return CodeMirror.Pass;
        /// v3: if (state.tokenize.name != 'jsTokenBase') return 0;
        if (state.tokenize.name == 'tokenComment') return CodeMirror.Pass;
        if (state.tokenize.name != 'tokenBase') return 0;
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




    var res = {
      javascript: function(cm) {
        initJsHint(cm); // the syntax checker
        patchJsIndent(cm);

      }, // javascript : ...

      css: function(cm) {
        // no special init for CSS
      }, // css : ...

      htmlmixed: function(cm) {
        var chain = true;

        initJsHint(cm); // the syntax checker

        // MUST use setOption(), or the option's associated action won't take effect
        // indentTags is dervied from source htmlIndent list, the elements often include only (or mostly) text are taken out, mainly h1,2,3..., p, etc.
        cm.setOption("autoCloseTags", { whenClosing: true,
                                       whenOpening: true,
                                       indentTags: ["applet", "blockquote", "body", "div", "dl", "fieldset", "form", "frameset", "head", "html", "iframe", "layer", "legend", "object", "ol", "select", "table", "ul"] });

      },  // htmlmixed: ...

      xml: function(cm) {
        cm.setOption("autoCloseTags", true);
      }, // xml: ...

      none: function (cm) { // the default catch-all mode init
        // no special init
      } // none: ...
    }; // var res;
    return res;
  })(); // var initFunc4Mode =

  //
  // main logic
  //

  var modeInitFunc = initFunc4Mode[mode] || initFunc4Mode['none'];
  try {
    modeInitFunc(cm);
  } catch(e) {
    console.group('modeInitFunc:'+mode);
    console.error('Error in initializing %s-specific features. Some features might not work.', mode);
    console.error(e.stack);
    console.groupEnd();
  }

} // function initCodeMirror4Mode()
