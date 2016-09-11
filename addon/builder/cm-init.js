(function(mod) {
  var deps = ["codemirror/lib/codemirror",
              "codemirror/addon/hint/show-hint",

              "codemirror/mode/javascript/javascript",
              "codemirror/addon/hint/javascript-hint",

              "codemirror/mode/css/css",
              "codemirror/addon/hint/css-hint",

              "codemirror/mode/xml/xml",
              "codemirror/mode/htmlmixed/htmlmixed",
              "codemirror/addon/hint/xml-hint",
              "codemirror/addon/hint/html-hint",

              "codemirror/addon/hint/anyword-hint",

              "codemirror/addon/mode/loadmode",
              "codemirror/addon/mode/overlay", // needed by some mode such as markdown
              "codemirror/mode/meta",

              "codemirror/addon/edit/matchbrackets",
              "codemirror/addon/edit/closebrackets",
              "codemirror/addon/edit/closetag",
              "codemirror/addon/search/match-highlighter",

              "../mode/javascript/closebrackets-patch4javascript", // MUST be placed after closebrackets addon

              "codemirror/addon/comment/continuecomment",

              "codemirror/addon/fold/foldcode",
              "codemirror/addon/fold/brace-fold",
              "codemirror/addon/fold/xml-fold",
              "codemirror/addon/fold/comment-fold",
              "codemirror/addon/fold/foldgutter",

              "codemirror/addon/dialog/dialog",
              "../hint/show-hint-dialog",  // needed for aotocomplete by serarch and execCommandInteractive
              "../search/search",
              "../search/search-autocomplete",

              "codemirror/addon/search/jump-to-line",

              "codemirror/addon/lint/lint",

              // Note: prefer to use 2.5.1 - 2.6.3. 
              // Versions < v.2.5, or  v2.7.0+ (at least up to v2.9.3)
              // does not work with RequireJs / AMD
              // @see https://github.com/jshint/jshint/issues/2840
              "jshint/dist/jshint", 
              "codemirror/addon/lint/javascript-lint",

              "jsonlint/lib/jsonlint",
              "codemirror/addon/lint/json-lint",

              "htmlhint/lib/htmlhint",
              "codemirror/addon/lint/html-lint", // NOTE: as of v5.18.1, it requires htmlhint's main be defined

              "../misc/colnummode",
              "../execcommand/execcommand",
              "../eval/cm-eval",

              "codemirror/addon/edit/trailingspace",
              "../edit/trailingspace-removal",
              "../misc/font-size",
             ]; // deps = ...

  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod.apply( null, deps.map(function(d) { return require(d); }) );
  else if (typeof define == "function" && define.amd) // AMD
    define(deps, mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * Add CodeMirror.builder, whichencapsulates functions that creates and
    * initalizes CodeMirror instances with mode-appropriate feature.
    * It provides 2 convenient functions:
    * - create(cmElt, uiCtrl): to create the pre-configured CodeMirror instance
    * - initMode(cm, mode, uiCtrl): additional mode-specific configuration
    *
    * On uiCtrl parameter: encapsulates the parent UI (outside of CodeMirror)
    * that is needed, e.g., uiCtrl.setMode(modeName) allows the parent UI to show
    * the current mode.
    *
    * @exports CodeMirror
    */
     CodeMirror) {
     "use strict";

   /**
   * Utility to bind a CodeMirror command function, of the form function(cm) ,
   * to CodeMirror (class) with a given name, and optionally bind the command
   * to given instance with given keys.
   * @param opts keyName property, a string of an array of string of keys to be bounded to the command
   */
  function bindCommand(cmdName, opts, cmdFunc) {

    function bindExtraKey(keyName) {
      var keyMap = CodeMirror.keyMap["default"];

      if (keyMap[keyName]) {
        console.warn('bindCommand: key %s already bound to %s. Rebinding it with %s', keyName, keyMap[keyName], cmdName);
      }

      keyMap[keyName] = cmdName;
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

  } // function bindCommand()

  // main entry point: for initial creation
  function createCodeMirror(cmElt, uiCtrl) {

    var cm = CodeMirror(cmElt, {
      lineNumbers: true,
      tabSize: 2,
      lineWrapping: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      patchAutoCloseBrackets4Javascript: true,  // MUST be defined after autoCloseBrackets
      highlightSelectionMatches: false, // possibly troublesome when I select large amount of text
      extraKeys: {
        "Ctrl-I": "indentAuto",
        "Ctrl-Q": "toggleFold",
        "Shift-Ctrl-Q": "foldAll", // toggleFoldAll is problematic both semantically and implementation
        "Ctrl-Space": "autocomplete",
        "Alt-F": "findPersistent",
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

    initColumnNumberMode(cm, uiCtrl);

    initSetModeInterActive(CodeMirror, uiCtrl);

    // bind anyword-hint to Ctrl-/ for a non mode-specific autocomplete (fallback for user)
    //  It is in the spirit of emacs M-/ dabbrev-expand
    bindCommand('autocompleteAnyword', {keyName: "Ctrl-/" }, function(cm) {
      cm.showHint({hint: CodeMirror.helpers.hint.anyword});
    });

    initSelectFold(cm);
    initSelectToLine(cm);

    extendSearchUI(cm, uiCtrl); // to show num. of matches
    if (CodeMirror.extendSearchWithAutoComplete) {
      CodeMirror.extendSearchWithAutoComplete(cm);
    } else {
      console.warn("search-autocomplete addon is not loaded. Autocomplete disabled.");
    }

    initToggleShowTrailingSpace(CodeMirror);
    cm.setOption('newlineAndIndent', {removeTrailingSpace: true} ); // depends on trailingspace-removal.js

    initLint(cm, uiCtrl);

    return cm;
  } // function createCodeMirror

  /**
   * Extend standard CodeMirror search addon to show number of matches in the
   * parent UI.
   * @param uiCtrl parent UI abstraction, it should have a function .setSearchStatus(query, numMatched) that can be used to update number of matches of search.
   */
  function extendSearchUI(cm, uiCtrl) {

    if (!uiCtrl.setSearchStatus) {
      console.warn('extendSearchUI(): uiCtrl does not implement setSearchStatus(). No extended UI will be used.');
      return;
    }

    // the observer/Eventlistener-like callback to be used to trigger UI
    function onSearchChange(cm, query) {
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
            // escape special characters used by RegExp
            var queryTxtForRE = query.replace(/([.[(+*?])/g, '\\$1');
            if (queryTxtForRE.toLowerCase() === queryTxtForRE) {
              // case insenstive search
              return new RegExp(queryTxtForRE, 'gi');
            } else {
              return new RegExp(queryTxtForRE, 'g');
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
      if (!query) {
        uiCtrl.setSearchStatus(null, 0);
      } else {
        var numMatched = countNumMatched(query);
        uiCtrl.setSearchStatus(query, numMatched);
      }

    } // function onSearchChange(..)

    cm.on("search", onSearchChange);

  } // function extendSearchUI(..)


  function initColumnNumberMode(cm, uiCtrl) {
    function columnNumberModeCallback(enabled, pos) {
      var modType = "colNumMode";
      if (enabled) {
        var text = 'Ch:' + (1 + pos.ch); // pos is 0-based while people prefer 1-based
        uiCtrl.codeModeModifier.update(modType, text);
      } else {
        uiCtrl.codeModeModifier.remove(modType);
      }
    } // function columnNumberModeCallback;

    cm.setOption("columnNumberMode", {enabled: true, callback: columnNumberModeCallback});
  }

  // Issues to resolve if it is to be provided as a addon:
  //   - how to deal with  uiCtrl
  //   - how to set initCodeMirror4Mode() without explicitly calling it
  // Note: as it is, uiCtrl passed here does not work well with multiple CM instances
  function initSetModeInterActive(CodeMirror, uiCtrl) {
    function setModeInterActive(cm) {
      function doSetMode(modeName) {
        var info = CodeMirror.findModeByName(modeName);
        if (info) {
          // Issue: logic copied from editor.js:handleDocumentChange() To be refactored
          uiCtrl.setMode(info.name);
          cm.setOption("mode", info.mime);
          CodeMirror.autoLoadMode(cm, info.mode);
          initCodeMirror4Mode(cm, info.mode, uiCtrl);
        } else {
          cm.openDialog('<div style="background-color: yellow; width: 100%">&nbsp;' +
                        '<button type="button">Ok</button><span style="color: red;">Mode ' +
                        modeName + ' not found.</span></div>');
        }
      } // function doSetMode(..)

      var dialogId = 'ctl_mode_' + Date.now();
      cm.openDialog('Enter mode: <input type="text" style="width: 10em;" id= "' + dialogId + '" />',
                    doSetMode);
      // TODO: consider to supply showhint with list of names
      //   CodeMirror.modeInfo.map(function(i) { return i.name; })
    } // function setModeInterActive()

    CodeMirror.commands.setModeInterActive = setModeInterActive;

  } // function initSetModeInterActive(..)


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

    bindCommand('selectFold', {keyName: "Ctrl-Alt-Q" }, selectFold);

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

    bindCommand('selectToLineInteractive', {keyName: "Ctrl-Alt-G" }, selectToLineInteractive);

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


  function initLint(cm, uiCtrl) {

    // the logic that updates uiCtrl
    function showLintStatus(enabed, numIssues) {
      var modType = 'Lint';
      if (enabed) {
        var msg = numIssues ? '[Lint:' + numIssues + ']' : '[Lint]' ;
        uiCtrl.codeModeModifier.update(modType, msg);
      } else {
        uiCtrl.codeModeModifier.remove(modType);
      }
    } // function showLintStatus(..)

    function onUpdateLinting(annotationsNotSorted, annotations, cm) {
      if (!annotationsNotSorted) { // if set to null, indicate lint is off
        showLintStatus(false);
        return;
      }

      var numIssues = annotationsNotSorted.filter(function(ann) {
        // underlying JSHINT will return warnings that are not related to the code
        // but of JSHINT config itself (due to lint.js passing non JSHINT-relevant options over)
        // , e.g., "Bad option: 'onUpdateLinting'."
        //
        return (ann.from.line >= 0);
      }).length;
      showLintStatus(true, numIssues);
    } // function onUpdateLinting(..)

    function disableLint(cm) {
      cm.setOption('lint', false);
      if (cm.state._onUpdateLinting) {
        cm.state._onUpdateLinting(null); // Update UI to show Lint disabled altogher.
      }
    } // function disableLint(..)

    function enableLint(cm) {
      cm.setOption('lint', { onUpdateLinting: cm.state._onUpdateLinting,
                            /// lintOnChange: false
                            });

    } // function enableLint(..)

    function toggleLint(cm) {
      if (cm.getOption('lint')) {
        disableLint(cm);
      } else {
        enableLint(cm);
      }
    } // function toggleLint(..)

    // add lint-markers to CM instance
    var gutters = cm.getOption('gutters');
    gutters.push("CodeMirror-lint-markers");
    cm.setOption('gutters', gutters);

    // Set the CM instance / UICtrl specific update
    // to the instance itself
    // This is done so that the commands (non-instance specific)
    // can work on any CM instances, provied _onUpdateListing is set correctly.
    cm.state._onUpdateLinting = onUpdateLinting;

    // Note: the commands are
    bindCommand('toggleLint',  {keyName: "F10" }, toggleLint);
    bindCommand('enableLint',  {}, enableLint);
    bindCommand('disableLint',  {}, disableLint);
  } // function initLint(..)
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
          patchJsIndent(cm);

        }, // javascript : ...

        css: function(cm) {
          // no special init for CSS
        }, // css : ...

        htmlmixed: function(cm) {
          var chain = true;

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


    function addPreviewLikeStyle4MarkdownModes(cm, mode) {
      var wrapperElt = cm.getWrapperElement();
      if ("markdown" === mode || "gfm" === mode) {
        wrapperElt.classList.add('cm-m-markdown');
      } else {  // in case previous file is .md . Need to remove the extra styling
        wrapperElt.classList.remove('cm-m-markdown');        
      }
    } // function addPreviewLikeStyle4MarkdownModes(..)
    
    //
    // main logic
    //

    /*jshint sub:true*/
    var modeInitFunc = initFunc4Mode[mode] || initFunc4Mode['none'];
    /*jshint sub:false*/
    try {
      modeInitFunc(cm);
      addPreviewLikeStyle4MarkdownModes(cm, mode);
    } catch(e) {
      console.group('modeInitFunc:'+mode);
      console.error('Error in initializing %s-specific features. Some features might not work.', mode);
      console.error(e.stack);
      console.groupEnd();
    }

  } // function initCodeMirror4Mode()

    // Set the exports
    var builder = {
      create: createCodeMirror,
      initMode: initCodeMirror4Mode
    };
    CodeMirror.builder = builder;

});
