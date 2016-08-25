(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror/lib/codemirror"), require("codemirror/addon/dialog/dialog"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror/lib/codemirror", "codemirror/addon/dialog/dialog"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * Provide evalInteractive, evalSelection and
    * the convenient evalSmart commands.
    * They allow users to test run sections of javascript codes.
    * The codes are run in a sandbox: in other words, the
    * codes run do not affect the current editor environment
    *
    * The codes executed do not get attached to sandbox's
    * global namespace. To attach to the global namespace,
    * you must set it explicity, e.g.,
    *   window.someFunc = function() {..}
    *
    * Note: The sandboxing behavior is completely opposite of
    *  emac's eval-region, of which the elisp codes are
    * evaluated in the editor's environment.
    *
    * Environments such as Chrome App forbid non-sandboxed
    * eval.
    *
    * Limitation: only 1 CodeMirror instance can use eval at any given time.
    * (see #evalSrc() function for details)
    *
    * @exports CodeMirror
    */
   CodeMirror) {

  // create sandbox iframe eagerly upon init
  // so that the frame has time to be fully inited,
  // before we post any message;
  var ifEl = null;

  // init the ifEl variable, i.e., the underlying sanbox iframe
  function initEvalSandboxWithPath(pkgPath) {
    if (ifEl) { // in case the function called multipe times, only 1 iframe will be created.
      if (console && consle.warn) console.warn('initEvalSandboxWithPath() called again. Ignoring. pkgPath:', pkgPath)
      return;
    }

    ifEl = (function() {
      var ifEl = document.getElementById('eval-src');
      if (ifEl) {
        ifEl.remove();
      }

      ifEl = document.createElement('iframe');
      ifEl.style.display = 'none';
      ifEl.id = 'eval-src';
      ifEl.src = pkgPath + '/cm-eval-sandbox.html';
      document.body.appendChild(ifEl);

      return ifEl;
    })(); // ifEl = (function())
  } // function initEvalSandboxWithPath()


  function evalSrc(cm, src) {
    if (!ifEl) {
      throw new Error('evalSrc(): the underlying sanbox iframe has not been initialized');
    }
    
    var message = {
      command: 'eval',
      src: src
    };
    // To set CodeMirror instance to be used.
    // Limitation:
    //   only 1 CodeMirror instance use evalSrc() at any given time,
    //   Otherwise, the eval result might get routed to an incorrect
    //   CodeMirror instance
    reportEvalResult.cm = cm;
    ifEl.contentWindow.postMessage(message, '*');
  } // function evalSrc(..)

  // on result from sandboxed frame:
  // use window.onmesage rather than window.addEventListener('message'
  // so that the function can be executed multiple time (e.g, during debug)
  // without resulting into multiple listeners get registered
  window.onmessage = function(event) {
    ///console.debug('main onmessage() event: %o', event);
    /// _event = event;
    reportEvalResult(event.data.error, event.data.result);
  };

  function reportEvalResult(err, result) {
    var cm = reportEvalResult.cm; // should be set by evalSrc(), which sent the eval request to sandbox
    if (err) {
      cm.openDialog('<div style="background-color: yellow; width: 100%">&nbsp;' +
                    '<button type="button">Ok</button><span style="color: red;"> Unexpected Error in evaluating the codes: '
        + err.name + ': ' + err.message + '</span>'
        + '<pre id="errStack" style="font-family:monospace; font-size: smaller; font-weight: normal; margin-left: 12px;"></pre>'
        + '</div>', null, {});
      // err.stack contains tag-like string, so use textContent to html escape it
      document.getElementById('errStack').textContent =
        err.matchedSrc ? err.matchedSrc + '\n' + err.stack : err.stack;
      cm.state._evalLastResult = err; // for power users to debug
    } else {
      cm.openDialog('<button type="button">Ok</button> Result: <pre id="evalResult" style="font-family: monospace; margin-left: 12px;"></pre>', null, {});
      // use textContent to html scape it
      var resEl = document.getElementById('evalResult');
      resEl.textContent = JSON.stringify(result);
      if (resEl.offsetHeight < 25) { // if the result is typical 1-line, then display inline
        resEl.style.display = 'inline-block';
      }
      cm.state._evalLastResult = result; // for power users to debug
    }
  } // function reportEvalResult(..)

  function evalInteractive(cm) {

    function evalSrcOfThisCM(src) {
      return evalSrc(cm, src);
    }
    var dialogId = "ctl_eval_" + Date.now();
    // for debug 'onkeydown="console.debug(\'keydown: %i %s\', event.keyCode, event.keyIdentifier);"'
    cm.openDialog('Enter expresson: <input type="text" style="width: 30em;" id= "' + dialogId + '" />',
                  evalSrcOfThisCM, {});

    if (cm.getSelection()) {
      document.getElementById(dialogId).value  = cm.getSelection();
    }

  } // function evalInteractive()

  function evalSelection(cm) {
    var jsCodes = cm.getSelection();
    if (jsCodes) {
      evalSrc(cm, jsCodes);
    }
  } // function evalSelection(..)

  function evalSmart(cm) {
    if (cm.getSelection()) {
      return evalSelection(cm);
    } else {
      return evalInteractive(cm);
    }
  } // function evalSmart(..)

  //
  // Define the commands and key bindings
  //
  CodeMirror.commands.evalInteractive = evalInteractive;
  CodeMirror.commands.evalSelection = evalSelection;
  CodeMirror.commands.evalSmart = evalSmart;
  CodeMirror.keyMap["default"]["Alt-E"] = "evalSmart";

  CodeMirror.initEvalSandboxWithPath = initEvalSandboxWithPath;
});
