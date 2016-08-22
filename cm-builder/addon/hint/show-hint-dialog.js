(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror/lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror/lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * CodeMirror.showHint4Dialog() that show hints from a 
    * CodeMirror dialog box, typically, an <input> eleent of the dialog
    *
    * @exports CodeMirror
    */
   CodeMirror) {

  /**
   * @param cm CodeMirror instance
   * @param getHints a function that return the list of hints in an object, 
   * - list: the Array of hints, 
   * - inpElt: the <input> element that the hint is to be anchored at.
   * @see CodeMirror.showHint() This one is adpated from it. 
   */
  CodeMirror.showHint4Dialog = function(cm, getHints, options) {
    if (!options) options = {};
    /// in dialog case startch is probably not needed
    var startCh = cm.getCursor().ch, continued = false;

    function startHinting() {
      /// We want a single cursor position. (not relevant in dialog)
      /// if (cm.somethingSelected()) return;

      if (options.async)
        getHints(cm, showHints, options);
      else
        return showHints(getHints(cm, options));
    }

    /***
  // absolute offset, e.g., from root document
  // or from some fixed position element
  function getAbsOffsetInPos( elt ) {
    var originalElt = elt;

    var absOffsetLeft = 0;
    var absOffsetTop = 0;
    var lastNotNullElt;
    do {
      console.debug(elt);
      if ( !isNaN( elt.offsetLeft ) ) {
        absOffsetLeft += elt.offsetLeft;
        absOffsetTop += elt.offsetTop;
      }
      lastNotNullElt = elt;
    } while( elt = elt.offsetParent );

    return { left: absOffsetLeft, top: absOffsetTop,
            bottom: absOffsetTop + originalElt.offsetHeight,
            right: absOffsetLeft + originalElt.offsetWidth,
            rootElt: lastNotNullElt
           };
  } // function getAbsOffsetInPos()
  ***/

    function showHints(data) {

      if (!data || !data.list.length) return;
      var completions = data.list;
      // When there is only one completion, use it directly.
      if (!continued && options.completeSingle !== false && completions.length == 1) {
        /// in dialog, replacing the entire input
        data.inpElt.value = completions[0];
        return true;
      }

      // Build the select widget
      var hints = document.createElement("ul"), selectedHint = 0;
      hints.className = "CodeMirror-hints";
      for (var i = 0; i < completions.length; ++i) {
        var elt = hints.appendChild(document.createElement("li"));
        elt.className = "CodeMirror-hint" + (i ? "" : " CodeMirror-hint-active");
        elt.appendChild(document.createTextNode(completions[i]));
        elt.hintId = i;
      }

      var pos = {}; /// in dialog, do not calc coords from cursor
      pos.left = data.inpElt.offsetLeft;
      pos.top = data.inpElt.offsetTop;
      pos.bottom = data.inpElt.offsetTop + data.inpElt.offsetHeight;

      hints.style.left = pos.left + "px";
      hints.style.top = pos.bottom + "px";
      /// need to clean container's hidden overflow (if any) temporarily
      var containerElt = data.inpElt.parentElement;
      var containerEltOrigOverflow = window.getComputedStyle(containerElt).overflow;
      containerElt.style.overflow = "visible";
      containerElt.appendChild(hints); // parent is overflow: hidden; may need to workaround it

      ///console.debug('A. %s %s %O', hints.style.left, hints.style.top, hints);
      ///console.debug('Aa. overflow: %s', containerEltOrigOverflow);

      // If we're at the edge of the screen, then we want the menu to appear on the left of the cursor.
      var winW = window.innerWidth || Math.max(document.body.offsetWidth, document.documentElement.offsetWidth);
      var winH = window.innerHeight || Math.max(document.body.offsetHeight, document.documentElement.offsetHeight);
      var box = hints.getBoundingClientRect();
      var overlapX = box.right - winW, overlapY = box.bottom - winH;
      if (overlapX > 0) {
        if (box.right - box.left > winW) {
          hints.style.width = (winW - 5) + "px";
          overlapX -= (box.right - box.left) - winW;
        }
        hints.style.left = (pos.left - overlapX) + "px";
      }
      if (overlapY > 0) {
        var height = box.bottom - box.top;
        if (box.top - (pos.bottom - pos.top) - height > 0) {
          overlapY = height + (pos.bottom - pos.top);
        } else if (height > winH) {
          hints.style.height = (winH - 5) + "px";
          overlapY -= height - winH;
        }
        hints.style.top = (pos.bottom - overlapY) + "px";
      }


      function changeActive(i) {
        i = correctActiveIdxForScrollOver(i);
        if (selectedHint == i) return;
        hints.childNodes[selectedHint].className = "CodeMirror-hint";
        var node = hints.childNodes[selectedHint = i];
        node.className = "CodeMirror-hint CodeMirror-hint-active";
        if (node.offsetTop < hints.scrollTop)
          hints.scrollTop = node.offsetTop - 3;
        else if (node.offsetTop + node.offsetHeight > hints.scrollTop + hints.clientHeight)
          hints.scrollTop = node.offsetTop + node.offsetHeight - hints.clientHeight + 3;
      }

      function correctActiveIdxForScrollOver(i) {
        // new feature for convenience
        // old no ScrollOver logic
        ///i = Math.max(0, Math.min(i, completions.length - 1));

        if (i < 0) {
          // at top, now go to bottom;
          i = completions.length - 1;
        } else if (i > completions.length - 1) {
          // at bottom, now go top
          i = 0;
        } //  else is normal case, no change

        return i;
      } // function correctActiveIdxForScrollOver(..)

      function screenAmount() {
        return Math.floor(hints.clientHeight / hints.firstChild.offsetHeight) || 1;
      }

      var ourMap = {
        Up: function() {changeActive(selectedHint - 1);},
        Down: function() {changeActive(selectedHint + 1);},
        PageUp: function() {changeActive(selectedHint - screenAmount());},
        PageDown: function() {changeActive(selectedHint + screenAmount());},
        Home: function() {changeActive(0);},
        End: function() {changeActive(completions.length - 1);},
        Enter: pick,
        Tab: pick,
        Esc: close,
        Right: pick // new feature for convenience
      };
      if (options.customKeys) for (var key in options.customKeys) if (options.customKeys.hasOwnProperty(key)) {
        var val = options.customKeys[key];
        if (/^(Up|Down|Enter|Esc)$/.test(key)) val = ourMap[val];
        ourMap[key] = val;
      }

      // use cm.focus() as a workaround
      // it is done to take away the focus from the input box
      // which seems to be preventing cm code here to capture the
      // keystrokes and disptach according to the ourMap
      cm.focus();

      cm.addKeyMap(ourMap);

      /// dialog case cursorActivity seems to be irrelevant cm.on("cursorActivity", cursorActivity);
      cm.on("blur", close);
      CodeMirror.on(hints, "dblclick", function(e) {
        var t = e.target || e.srcElement;
        if (t.hintId != null) {selectedHint = t.hintId; pick();}
        setTimeout(function(){cm.focus();}, 20);
      });
      CodeMirror.on(hints, "click", function(e) {
        var t = e.target || e.srcElement;
        if (t.hintId != null) changeActive(t.hintId);
        setTimeout(function(){cm.focus();}, 20);
      });



      // simulate keydown, with weird workaround
      // @see http://jsbin.com/awenaq/4
      // @see http://stackoverflow.com/questions/10455626/
      function keyDown(el, keyCode) {
        var eventObj = document.createEventObject ?
            document.createEventObject() : document.createEvent("Events");

        if(eventObj.initEvent){
          eventObj.initEvent("keydown", true, true);
        }

        eventObj.keyCode = keyCode;
        eventObj.which = keyCode;
        if (eventObj.keyCode != keyCode) {
          console.error('created keyCode incorrect. Actual: %i; Expected: %i', eventObj.keyCode, keyCode);
        }

        // _dbg = eventObj; // debug

        var res;
        if (el.dispatchEvent) {
          res = el.dispatchEvent(eventObj);
        }
        else {
          res = el.fireEvent("onkeydown", eventObj);
        }
        return res;
      }

      var done = false, once;
      function close() {
        if (done) return;
        done = true;
        /// dialog case cursorActivity seems to be irrelevant clearTimeout(once);
        // restore container
        hints.parentNode.style.overflow = containerEltOrigOverflow;
        hints.parentNode.removeChild(hints);
        cm.removeKeyMap(ourMap);
        /// dialog case cursorActivity seems to be irrelevant cm.off("cursorActivity", cursorActivity);
        cm.off("blur", close);
        data.inpElt.focus(); // once completion is done, we want to focus back on the original input
      }

      function pick() {
        // dialog case do not replace text in editor
        data.inpElt.value = completions[selectedHint];
        close();
        if (options.pressEnterOnPick === undefined || options.pressEnterOnPick) {
          var DOM_VK_ENTER = 13;
          keyDown(data.inpElt, DOM_VK_ENTER);
        }
      }

      /// dialog case cursorActivity seems to be irrelevant
      /***
    var once, lastPos = cm.getCursor(), lastLen = cm.getLine(lastPos.line).length;
    function cursorActivity() {
      clearTimeout(once);

      var pos = cm.getCursor(), len = cm.getLine(pos.line).length;
      if (pos.line != lastPos.line || len - pos.ch != lastLen - lastPos.ch ||
          pos.ch < startCh || cm.somethingSelected())
        close();
      else
        once = setTimeout(function(){close(); continued = true; startHinting();}, 70);
    } ***/
      return true;
    };

    return startHinting();

  }; // CodeMirror.showHint4Dialog = function()

});

