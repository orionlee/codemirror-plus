(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror/lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror/lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * Make markdown modes Live Preview-like
    *
    * @export CodeMirror #supportMarkdownModesPreviewLikeStyle(mode) extension
    */
   CodeMirror) {
  "use strict";

  // Make links in markdown clickable
  function openCmLinkOnNewWindow(cm, evt) {
    function doOpen(elt) {
      if (!elt.classList.contains('cm-url')) {
        throw new TypeError('Element must be of css class cm-url. Actual: ' + elt.className);
      }
      var url = elt.textContent.replace(/^\(|\)$/g, ''); // form (http://abcdef)
      var doc = elt.ownerDocument;
      var a = doc.createElement('a');
      a.id = 'tempLinkToOpen';
      a.target = "_blank";
      a.href = url;
      doc.body.appendChild(a);
      a.click();
      a.remove();
    } // function doOpen(..)

    // Given a .cm-link element, find the .cm-url element that contains the URL
    // In simple case, it could simply be cmLink.nextElementSibling.
    // However, the cursor could breakup the element into smaller pieces
    // due to #setCursorAtCSSClass(), e.g., a single <span class="cm-url">(...) will break into 
    // <span class="cm-url">(</span><span class="cm-url">http://...</span><span class="cm-url">)</span>
    // The function traverses the cm-link 's siblings to find the appropriate one.
    function findCmUrl(cmLink) {
      if (console && console.assert) console.assert(cmLink.classList.contains('cm-link'), 'input should be .cm-link element');

      function isUrl(elt) {
        if (!elt) return false;
        var text = elt.textContent;
        return elt.classList.contains('cm-url') && text !== "(" && text !== ")";
      } // function isUrl(..)

      for(var cmUrl = cmLink.nextElementSibling; cmUrl ; cmUrl = cmUrl.nextElementSibling) {
        if (isUrl(cmUrl)) {
          return cmUrl;
        }
      }
      return null;
    } // function findCmUrl(..)

    var cl = evt.target.classList;
    if (cl.contains('cm-url')) {
      doOpen(evt.target);
    } else if (cl.contains('cm-link')) {
      var urlEl = findCmUrl(evt.target);
      if (urlEl) {
        doOpen(urlEl);
      } else {
        if (console && console.warn) console.warn("Cannot correspond cm-url for ", evt.target);
      }
    } // else N/A: do nothing
  } // function openCmLinkOnNewWindow(..)


  // Add cm-cursor-at CSS class to the token where the cursor is
  // It is used to make some tokens to have preview-like styling
  // where the cursor is not at it, but appears normal editable text
  // when the cursor is at it.
  // Tokens need such help include: url and hr in markdown mode,
  //
  var cursorMark = null; // used by setCursorAtCSSClass
  function setCursorAtCSSClass(cm) {
    if (cursorMark) cursorMark.clear(); // clear previous one
    var pos = cm.getCursor();
    var token = cm.getTokenAt(pos);
    var Pos = CodeMirror.Pos;
    cursorMark = cm.markText(Pos(pos.line, token.start), Pos(pos.line, token.end),
                             {className: 'cm-cursor-at'});
  } // function setCursorAtCSSClass(..)


  function supportMarkdownModesPreviewLikeStyle(mode) {
    var cm = this;
    // Note:
    // It requires caller to supply the mode name *explicitly*,
    // rather than relying on cm.getDoc().getMode().name
    // because in the case the mode is first (lazily and asychronously) loaded,
    // the mode may not yet be loaded by this point of execution.
    var wrapperElt = cm.getWrapperElement();
    if ("markdown" === mode || "gfm" === mode) {
      wrapperElt.classList.add('cm-m-markdown');
      // CodeMirror does not support click event.
      //@see https://github.com/codemirror/CodeMirror/issues/3145
      cm.on('mousedown', openCmLinkOnNewWindow);
      cm.on('cursorActivity', setCursorAtCSSClass);
      setCursorAtCSSClass(cm);
    } else {  // in case previous file is .md . Need to remove the extra styling
      wrapperElt.classList.remove('cm-m-markdown');
      cm.off('mousedown', openCmLinkOnNewWindow);
      cm.off('cursorActivity', setCursorAtCSSClass);
    }
  } // function supportMarkdownModesPreviewLikeStyle(..)

  // the export
  CodeMirror.defineExtension('supportMarkdownModesPreviewLikeStyle', supportMarkdownModesPreviewLikeStyle);

});