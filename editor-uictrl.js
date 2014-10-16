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
function createEditorUICtrl(doc) {

  var _titleElt, _modeElt;
  // used to show status of some CM commands, addon, e.g., if lint is on, col num mode is on, etc.
  var _codeModeModifierDiv; 
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
          dropDownEl.remove();
        } else {
          _openRecentBtn.blur(); // in case the btn gets focused with shortcut
          openRecentCallback(evt);
          evt.stopPropagation(); // no need to propagate the event to children's onclick
        }
      } else {
        /// console.debug('#openRecent: click %o on child elements (no-op here): %o', evt, el);
      }
    });
    _saveButton.addEventListener("click", saveCallback);
    _saveAsButton.addEventListener("click", saveAsCallback);    
  }; // uiCtrl.io.registerListeners = function()


  // @interface
  // @param infoList see ioCtrl.getRecentOpenList
  // @param doOpenRecentById callback method that does the actual opening file, 
  //    e.g., ioCtrl.openRecentById
  uiCtrl.io.createRecentListDropDwonUI = function(infoList, doOpenRecentById) {
    var dropDownEl = _openRecentBtn.querySelector('ul');
    if (dropDownEl) { // destory old one if any
      dropDownEl.remove();
    }
    dropDownEl = doc.createElement('ul');
    dropDownEl.className = 'CodeMirror-hints dropdown'; // TODO: remove CodeMirror-hints dependency
    infoList.forEach(function(info) {
      var li = doc.createElement('li');
      li.dataset.id = info[1];
      li.textContent = info[0].replace(/^(.*?)([^\\\/]+)$/, '$2');
      li.title = info[0].replace(/\\\\/, '\\'); // replace \\ with easier to read \ 
      dropDownEl.appendChild(li);
    });
    _openRecentBtn.appendChild(dropDownEl); 
    
    // ensure we get a handle of the <ul> attached to DOM
    dropDownEl = _openRecentBtn.querySelector('ul');
    
    dropDownEl.onclick = function(evt) {
      var el = evt.srcElement;
      if (el.tagName == 'LI') {
        var fileId = el.dataset.id;
        dropDownEl.remove();
        doOpenRecentById(fileId); 
      } // else the unlikely event on clicking the <ul> without touching any <li>s, do nothing
    }; // dropDownEl.onclick = function(..)
  } // function createRecentListDropDwonUI(..)

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
                                                         
  // support move by dragging toolbar
  var btns = doc.querySelector('.buttons');
  btns.addEventListener('mousedown', moveStart);  
  
  return uiCtrl;
  
} // function createEditorUICtrl(..)

