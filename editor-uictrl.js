/**
 * The UI control provides the methods to allow the caller to update UI 
 * based on changes in the model (editor), encapsulating UI update (aka all DOM access),
 * with the exception of accessing main editor itself.
 * 
 * It also encapsulates (and hence depends on) specifics in the HTML / CSS of the UI, 
 * e.g., elements' IDs, css classes to toggle, etc.
 * 
 * The control is passive in the sense that it does not know the underlying model
 *  (the codemirror editor object). 
 * 
 */
function createEditorUICtrl(window, doc) {
  "use strict";

  // imports from global to support "use strict";
  var console = window.console;
  
  var _titleElt, _modeElt;
  // used to show status of some CM commands, addon, e.g., if lint is on, col num mode is on, etc.
  var _codeModeModifierDiv; 
  var _searchStatusDiv;
  var _newButton, _openButton, _openRecentBtn, _saveButton, _saveAsButton;
  var _errorButton, _exitButton;

  var _editorFocusFunc;

  var _exitCallback = null;  
  
  function createTitleCtrl() {
    var titleCtrl = {};

    // @interface
    titleCtrl.set = function(title, tooltip) {
      tooltip = tooltip || title;
      doc.title = title; // the top-level DOM document object's title'
      _titleElt.innerText = title;
      _titleElt.title = tooltip; // for tooltip      
    };

    return titleCtrl;
  } // function createTitleCtrl(..)

  
  // codeModeModifier UI helpers
  //  the div contains possibly many smaller spans identified by modType
  //  (lint, col num mode, etc.)
  function createCodeModeModifierCtrl() {
    var codeModeModifier = {};
        
    // @interface
    codeModeModifier.update = function(modType, text) {
      var modTypeElt = codeModeModifier.get(modType);
      if (!modTypeElt) {
        _codeModeModifierDiv.insertAdjacentHTML(
          'beforeend', '<span id="' + modType  +'"></span>');
        
        modTypeElt = codeModeModifier.get(modType);
      }
      // now the modType span is sure setup. Set the content;  
      modTypeElt.innerText = text;  
    }; // function update(..)
  
    // @interface
    codeModeModifier.remove = function(modType) {
      var modTypeElt = codeModeModifier.get(modType);
      if (modTypeElt) {
        modTypeElt.remove();
      }
    };
    
    // @interface
    codeModeModifier.get = function(modType) {
      return _codeModeModifierDiv.querySelector('#' + modType);
    } ;
    
    return codeModeModifier;
  } // function createCodeModeModifierCtrl(..)
  
  
  //
  // main logic
  //
  var $id = doc.getElementById.bind(doc); 
  
  _titleElt = $id("title");
  _modeElt = $id('mode');
  _codeModeModifierDiv = $id('_codeModeModifier');
  _searchStatusDiv = $id('_searchStatus');
  
  _newButton = $id("new");
  _openButton = $id("open");
  _openRecentBtn = $id('openRecent');
  _saveButton = $id("save");
  _saveAsButton = $id("saveAs");
  
  _exitButton = $id("exit");
  _errorButton = $id('error_btn');
  
  var uiCtrl = {};

  // @interface
  uiCtrl.title = createTitleCtrl();
  
  // @interface
  uiCtrl.setMode = function(modeName) {
    _modeElt.innerText = modeName; 
  }; // uiCtrl.setMode = function(..)
  
  // @interface
  uiCtrl.codeModeModifier = createCodeModeModifierCtrl();

  // @interface
  uiCtrl.setDirty = function(isDirty) {
    if (isDirty) {
      _saveButton.disabled = false; 
      _titleElt.classList.add("fileDirty");    
    } else {
      _saveButton.disabled = true;
      _titleElt.classList.remove("fileDirty");    
    }    
  }; // setDirty = function(..)

  // @interface
  uiCtrl.setSearchStatus = function (query, numMatched) {
    if (query) {
      var nmUI = _searchStatusDiv.querySelector('#numMatched');
      nmUI.innerHTML = numMatched;
      if (numMatched > 0) {
        nmUI.classList.remove('none');
      } else {
        nmUI.classList.add('none');
      }

      _searchStatusDiv.style.display = 'initial'; // show the UI
    } else { // query cleared, clear the UI
      _searchStatusDiv.style.display = 'none'; 
    }
  }; // uiCtrl.setSearchStatus = function(..)
  
  // @interface
  uiCtrl.io = {};
  
  // @interface
  uiCtrl.io.registerListeners = function(newCallback, openCallback, openRecentCallback, saveCallback, saveAsCallback) {
    _newButton.addEventListener("click", newCallback);
    _openButton.addEventListener("click", openCallback);
    _openRecentBtn.addEventListener("click", function(evt) {
      var el = evt.srcElement;
      if (el.isSameNode(_openRecentBtn)) {
        var dropDownEl = _openRecentBtn.querySelector('ul');
        if (dropDownEl) { // case a dropdown is there, so remove it.
          destroyRecentListDropDownUI();
        } else {
          openRecentCallback(evt);
        }
      } else {
        /// console.debug('#openRecent: click %o on child elements (no-op here): %o', evt, el);
      }
    });
    _saveButton.addEventListener("click", saveCallback);
    _saveAsButton.addEventListener("click", saveAsCallback);    
  }; // uiCtrl.io.registerListeners = function()

  
  // helper to clean up the UI element's created by 
  // createRecentListDropDownUI
  function destroyRecentListDropDownUI() {
    var dropDownEl = _openRecentBtn.querySelector('ul');
    console.assert(dropDownEl, 'Recent File dropdown <ul> should still exist');
    
    if (dropDownEl) dropDownEl.remove();
    _openRecentBtn.onkeydown = null; // no need to listen to it as the list gets destroyed.  
    _editorFocusFunc(); // in case the btn gets focused with keyboard shortcut

    document.removeEventListener('click', destroyRecentListDropDownUIOnClick);
  } // function destroyRecentListDropDownUI(..)

  
  function destroyRecentListDropDownUIOnClick(evt) {
    function inSubtreeOf(el, ancestorExpected) {
      if (!ancestorExpected) {
        return false;
      }
      for (var cur = el; cur; cur = cur.parentElement) {
        if (cur.isEqualNode(ancestorExpected)) {
          return true;
        }
      }
      return false;
    } // function inSubtreeOf(..)
    if ( evt.isContextMenuCommandRun || 
         inSubtreeOf(evt.target, _openRecentBtn) || 
         inSubtreeOf(evt.target, document.querySelector('.ctx-menu')) ) {
      return; // click on the dropdown, or context-menu itself, no-op
    }
    destroyRecentListDropDownUI();
  } // function destroyRecentListDropDownUIOnClick(..)
  
  // @interface
  // @param recentList see ioCtrl.getRecentOpenList
  // @param doOpenRecentById callback method that does the actual opening file, 
  //    e.g., ioCtrl.openRecentById
  uiCtrl.io.createRecentListDropDownUI = function(recentList, doOpenRecentById, doPinUnpin,  doRemoveFromRecent) {
    var dropDownEl = _openRecentBtn.querySelector('ul');
    if (dropDownEl) { // destory old one if any
      dropDownEl.remove();
    }
    dropDownEl = doc.createElement('ul');
    dropDownEl.className = 'CodeMirror-hints dropdown'; // TODO: remove CodeMirror-hints dependency
    
    function paintDropDown(dropDownEl, recentList) {
      dropDownEl.innerHTML = ''; // clear out any existing UI

      var showInfo = (function() {
        var MAX_NUM_SHOWN = 10;
        
        var curPos = 0, pinned; // state used by showInfo
        var filesShown = []; // state used by showInfo
        var res = function showInfo(info, i) {
          if (!info) {
            console.error('paintDropDown(): recentList item unexpectedly null. Skip the item. pinned: %s, i:%s', pinned, i);
            return;
          }
          if (curPos >= MAX_NUM_SHOWN) {
            return;
          }
          if (filesShown.indexOf(info[0]) >= 0) {
            return; // has already been shown, skip 
          } else {
            filesShown.push(info[0]);
          }
          curPos++;
          var li = doc.createElement('li');
          li.classList.add('entry');
          if (pinned) {
            li.classList.add('pinned');
          }
          li.dataset.filePath = info[0];
          li.dataset.id = info[1];
          var fileName = info[0].replace(/^(.*?)([^\\\/]+)$/, '$2');
          var numHtml = (function() {
            if (curPos <= 9) {
              return '<span class="accessKey">' + curPos + '</span>. ';  
            } else if (curPos == 10) {
              return '1<span class="accessKey">' + 0 + '</span>. ';  
            } else {
              return '<span>' + curPos + '</span>. ';  
            }       
          })(); // numHtml = (function())
          var pinTitle = (pinned ? 'Unpin from this list' : 'Pin to this list');
          li.innerHTML = numHtml + fileName + '<span class="pin" title="' + pinTitle + '"></span>';
          li.title = info[0].replace(/\\\\/, '\\'); // replace \\ with easier to read \ 
          dropDownEl.appendChild(li);
        }; // var res = function showInfo(..)
        
        res.setPinned = function setPinned(pinned_) {
          pinned = pinned_;
        }; // res.setPinned(pinned_) = function(..)
        
        return res;
      })(); // showInfo = (function()
      
      if(recentList.pinned.length > 0) {
        dropDownEl.insertAdjacentHTML('beforeend', '<li class="sep">Pinned<hr></li>'); 
        showInfo.setPinned(true);
        recentList.pinned.forEach(showInfo);
      }
      
      if(recentList.recent.length > 0) {
        dropDownEl.insertAdjacentHTML('beforeend', '<li class="sep">Recent<hr></li>');
        showInfo.setPinned(false);
        recentList.recent.forEach(showInfo);
      }
    } // function paintDropDown(..)
    
    paintDropDown(dropDownEl, recentList);

    _openRecentBtn.appendChild(dropDownEl); 
        
    // ensure we get a handle of the <ul> attached to DOM
    dropDownEl = _openRecentBtn.querySelector('ul');
    
    // helper to do the actual open and necessary UI cleanup
    //  used by both mouse click and keydown listeners
    function doOpenRecentSpecifiedAtLi(el) {
      console.assert(el.tagName == 'LI', 'Element should be a <li>. Actual: ' + el.tagName);
      var fileId = el.dataset.id;
      // the destroy function will be invoked by doOpenRecent, regardless if open succeeds or not
      doOpenRecentById(fileId, destroyRecentListDropDownUI);      
    } // function doOpenRecentSpecifiedAtLi(..)
    
    function doPinUnpinSpecifiedAtLi(toPin, el) {
      console.assert(el.tagName == 'LI', 'Element should be a <li>. Actual: ' + el.tagName);
      var fileId = el.dataset.id;
      var filePath = el.dataset.filePath;
      doPinUnpin(toPin, filePath, fileId, function(updatedRecentList) {
        paintDropDown(dropDownEl, updatedRecentList);
      }); 
    } // function doPinUnpinSpecifiedAtLi(..)
    
    // setup select file to open by mouse click
    dropDownEl.onclick = function(evt) {
      if (dropDownEl.classList.contains('ctx-menu-clicked')) {
        return; // don't allow dropdown menu action while the context menu is still active
      }
      var el = evt.target;
      if (el.classList.contains('entry')) {
        doOpenRecentSpecifiedAtLi(el);
      } // else the unlikely event on clicking the <ul> without touching any <li>s, do nothing
      
      if (el.tagName == 'SPAN') {
        var toPin = !el.parentElement.classList.contains('pinned');
        doPinUnpinSpecifiedAtLi(toPin, el.parentElement);
      }
    }; // dropDownEl.onclick = function(..)
    
    // setup select file to open by pressing 0-9
    // ( 0 means 10th file)
    _openRecentBtn.onkeydown = function(evt) {
      // Must use keydown rather than keypress, to capture Esc key
      // Semantically, using keydown olso makes sense too.
      
      if (dropDownEl.classList.contains('ctx-menu-clicked')) {
        return; // don't allow dropdown menu action while the context menu is still active
      }

      function isKeyEscapePressed(event) {

        // event.key is not suitable as it represents the char generated, not the key pressed,
        // i.e., sensitive to shift, etc. for keyW, it may generate "W" or "w"
        if (event.code && event.code != "") {
          // Chrome?, FF32+, Opera?, (no IE nor Safari)
          // @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code#Browser_compatibility
          return event.code == 'Escape'; 
        } else if (event.keyIdentifier && event.keyIdentifier != "U+0000") {
          // non-standard, but works for Safari 5.1+ and Chrome (26 - 52)
          // only works for keydown (NOT keypress)
          // @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyIdentifier#Browser_compatibility
          return event.keyIdentifier == "U+0018";
        } else if (event.which && event.which != 0) {
          // legacy browsers
          return event.which === 27;
        } else {
          console.warn('isSpaceKeyPressed() cannot determine if space is pressed. Likely to be a browser compatibility issue. Event: %o', event);
          return false;
        }
        // Note: event.charCode is deprecated in favor of .key
      } // function isKeyEscapePressed(..)
      
      if (isKeyEscapePressed(evt)) { // hit Esc key to hide the dropdown
        destroyRecentListDropDownUI();
        evt.preventDefault();
        return;
      }
      
      //
      // captuer number keys and open files accordingly
      //
      var keyCode = evt.keyCode; // keydown has only keyCode, no charCode
      
      var numPressed = (function() { // keyCode to number (0-9)
        if (keyCode >= 48 && keyCode <= 57) {
          return keyCode - 48;
        } else {
          return undefined;
        }
      })(); // numPressed = (function())
      
      var idx = (function(num) {
        if (typeof num === 'number') {
          // here 0 means 10th file, i.e., idx 9
          return (num === 0 ? (10 - 1) : (num - 1));
        } else {
          return undefined;
        }
      })(numPressed); // idx = (function())
      
      /// console.debug('#openRecent.onkeydown: ', evt.keyIdentifier, keyCode, numPressed, idx);

      var liEl = (function(idx) {
        if (typeof idx === 'number') {
          var liList = dropDownEl.querySelectorAll('li.entry');
          if (idx < liList.length) {
            return liList[idx];
          } // else number not within the range, no-op
        }
        return undefined;
      })(idx); // liEl = (function(..))
      
      if (liEl) {
        // the key is to be handled by this function, no need to go further.
        evt.preventDefault();
        doOpenRecentSpecifiedAtLi(liEl);
      }
    }; // _openRecentBtn.onkeydown = function(..)
    
    document.addEventListener('click', destroyRecentListDropDownUIOnClick);
    
    function doRemoveFromRecentListSpecifiedAtLi(el) {
      console.assert(el.tagName == 'LI', 'Element should be a <li>. Actual: ' + el.tagName);
      var fileId = el.dataset.id;
      var filePath = el.dataset.filePath;
      var pinned = el.classList.contains('pinned');
      
      doRemoveFromRecent(pinned, filePath, fileId, function(updatedRecentList) {
        paintDropDown(dropDownEl, updatedRecentList);
      }); 
    } // function doRemoveFromRecentListSpecifiedAtLi(..)

    function doContextMenuCommand(command, targetEl) {
      console.assert(command === 'remove', 'doContextMenuCommand() supports remove only. actual: %s', command);
      doRemoveFromRecentListSpecifiedAtLi(targetEl);  
    } // function doContextMenuCommand(..)
    
    dropDownEl.oncontextmenu = function(evt) {
      // context menu has already been clicked, do not do it again until the existing one is done
      if (dropDownEl.classList.contains('ctx-menu-clicked')) {
        return;
      }
      if (evt.target.classList.contains('entry')) {        
        evt.preventDefault(); // do not want system default context menu
        createRecentListContextMenu(evt.target, evt.pageX, evt.pageY - 8, doContextMenuCommand);
      }
    }; // dropDownEl.oncontextmenu = function(..)

  }; // function createRecentListDropDownUI(..)


  // BEGIN Recent List Context Menu  
  //
  var createRecentListContextMenu = function(entryEl, pageX, pageY, doContextMenuCommand) {
    var ctxMenu = (function(pageX, pageY) {
      var ctxMenu = document.createElement('ul');
      ctxMenu.className = 'ctx-menu';
      ctxMenu.style.left = pageX + 'px';
      ctxMenu.style.top = pageY + 'px';
      
      var mItem = document.createElement('li');
      mItem.className = 'ctx-menu-item';
      mItem.textContent = 'Remove from this list';
      mItem.dataset.command = 'remove';
      ctxMenu.appendChild(mItem);
      document.body.appendChild(ctxMenu);
      return ctxMenu;
    })(pageX, pageY); // ctxMenu = (function())
            
    ctxMenu.onclick = function(evt) {
      if (evt.target.classList.contains('ctx-menu-item')) {
        doContextMenuCommand(evt.target.dataset.command, entryEl);
        evt.isContextMenuCommandRun = true; // used to signal to keep parent dropdown 
        destroyRecentListContextMenu(null, true);
      } // else do nothing
    }; // ctxMenu.onclick = function(..)
    
    entryEl.classList.add('ctx-menu-clicked'); // so that the entry will remain highlighted in UI
    entryEl.parentElement.classList.add('ctx-menu-clicked'); // indicator to allow parent menu to be disabled temporarily
    ctxMenu.menuLogicalParent = entryEl;

    document.addEventListener('click', destroyRecentListContextMenu);
  }; // var createRecentListContextMenu = function(..)
  
  var destroyRecentListContextMenu = function(evt, force) {
    if (!force && evt.target.classList.contains('ctx-menu-item')) {
      // ignore click on the context menu itself
      return;
    }
    var ctxMenu = document.querySelector('.ctx-menu');
    if (ctxMenu) {
      ctxMenu.menuLogicalParent.classList.remove('ctx-menu-clicked'); // the li.entry item
      ctxMenu.menuLogicalParent.parentElement.classList.remove('ctx-menu-clicked'); // the ul.dropdown item
      ctxMenu.remove(); 
    }
    document.removeEventListener('click', destroyRecentListContextMenu);
  }; // destroyRecentListContextMenu = function()
 
  //
  // END Recent List Context Menu  
  

  // @interface  
  uiCtrl.safeExitWindow = function() {
    if (_exitCallback) {
      _exitCallback(function() {
        // this wil be invoked if exitCallback determines it is 
        // safe to exit;
        window.close();
      });      
    } else {
      // no callback to veto exit, so exit right away
      window.close();
    }
  }; // uiCtrl.safeExitWindow = function()

  _exitButton.addEventListener("click", uiCtrl.safeExitWindow);
    
  // @interface  
  uiCtrl.registerOnExitListener = function(exitCallback) {
    _exitCallback = exitCallback;
  }; // uiCtrl.registerOnExitListener = function(..)
 

  /**
   * @interface  
   * 
   * uiCtrl generally does not need codemirror editor,
   * but there are special cases, namely, needs to refocus 
   * on the editor.
   * this hook provides a mechanism for uiCtrl to focus
   * without fully aware of the editor.
   * @param editorFocusFunc a function that will focus the editor, 
   *   e.g.,  editor.focus.bind(editor) .
   */
  uiCtrl.setEditorFocusFunction = function(editorFocusFunc) {
    _editorFocusFunc = editorFocusFunc;
  }; // uiCtrl.setEditorFocusFunction = function(..)
  
  // @interface  
  uiCtrl.error = {};

  // @interface  
  uiCtrl.error.showMsg = function(msg, errObj) {
    var errorDiv = $id('error');
    var errorMsgDiv = $id('errormsg');
    
    if (errorDiv.style.display != 'none') {
      console.warn("uiCtrl.error.showMsg() - an existing message is still displayed: %s", 
                   errorMsgDiv.innerText);
    }
    
    errorMsgDiv.innerText = msg;
    errorDiv.style.display = 'block';
    _errorButton.focus();
  
    ///if (errObj) { errHist.push(errObj); }
    
    if (errObj && errObj.stack) {
      console.error("%s . %s", msg, errObj.stack);
    } else if(errObj) {
      console.error("%s . %O", msg, errObj);    
    } else {
      console.error(msg);      
    }
  }; // uiCtrl.error.showMsg = function(..)
  
  // @interface  
  uiCtrl.error.clearMsg = function() {
    $id('error').style.display = 'none';
    _editorFocusFunc(); 
  };

  _errorButton.addEventListener("click", uiCtrl.error.clearMsg);
                                                         
  return uiCtrl;
  
} // function createEditorUICtrl(..)

