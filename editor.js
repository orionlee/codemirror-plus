var editor;
var fileEntry;
var hasWriteAccess;

// BEGIN UI construct
//

var _uiCtrl; // abstraction over ui constructs and methods;

/**
 * The UI control provides the methods to allow the caller to update UI 
 * based on changes in the model (editor), encapsulating UI update (aka all DOM access),
 * with the exception of accessing main editor itself.
 * 
 * It is passive in the sense that it does not know the underlying model
 *  (the codemirror editor object). 
 * 
 * TODO: fill in other controls 
 */
function createEditorUICtrl(doc) {

  var _titleElt, _modeElt;
  // used to show status of some CM commands, addon, e.g., if lint is on, col num mode is on, etc.
  var _codeModeModifierDiv; 
  var _newButton, _openButton, _saveButton, _saveAsButton;
  var _errorButton, _exitButton;

  var _editorFocusFunc;
  
  function createTitleCtrl() {
    var titleCtrl = {};

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
  function createCodeModeModifierCtrl(codeModeModifierDiv) {
    var codeModeModifier = {};
        
    codeModeModifier.update = function(modType, text) {
      var modTypeElt = codeModeModifier.get(modType)
      if (!modTypeElt) {
        _codeModeModifierDiv.insertAdjacentHTML(
          'beforeend', '<span id="' + modType  +'"></span>');
        
        modTypeElt = codeModeModifier.get(modType);
      }
      // now the modType span is sure setup. Set the content;  
      modTypeElt.innerText = text;  
    }; // function update(..)
  
    codeModeModifier.remove = function(modType) {
      var modTypeElt = codeModeModifier.get(modType);
      if (modTypeElt) {
        modTypeElt.remove();
      }
    };
    
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
  _saveButton = $id("save");
  _saveAsButton = $id("saveAs");
  
  _exitButton = $id("exit");
  _errorButton = $id('error_btn');
  
  var uiCtrl = {};
  uiCtrl.title = createTitleCtrl();
  
  uiCtrl.setMode = function(modeName) {
    _modeElt.innerText = modeName; 
  }; // uiCtrl.setMode = function(..)
  
  uiCtrl.codeModeModifier = createCodeModeModifierCtrl();

  uiCtrl.setDirty = function(isDirty) {
    if (isDirty) {
      _saveButton.disabled = false; 
      _titleElt.classList.add("fileDirty");    
    } else {
      _saveButton.disabled = true;
      _titleElt.classList.remove("fileDirty");    
    }    
  }; // setDirty = function(..)
  
  uiCtrl.io = {};
  
  uiCtrl.io.registerListeners = function(newCallback, openCallback, saveCallback, saveAsCallback) {
    _newButton.addEventListener("click", newCallback);
    _openButton.addEventListener("click", openCallback);
    _saveButton.addEventListener("click", saveCallback);
    _saveAsButton.addEventListener("click", saveAsCallback);    
  }; // uiCtrl.io.registerListeners = function()

  
  uiCtrl.registerOnExitListener = function(exitCallback) {
    _exitButton.addEventListener("click", exitCallback);  
  }; // uiCtrl.registerOnExitListener = function(..)
 

  /**
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
  
  uiCtrl.error = {};

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
  
  uiCtrl.error.clearMsg = function() {
    $id('error').style.display = 'none';
    _editorFocusFunc(); 
  };

  _errorButton.addEventListener("click", uiCtrl.error.clearMsg);
                                                         
  return uiCtrl;
  
} // function createEditorUICtrl(..)

//
// END UI constructs

var fileIOErrorHandler = (function() {
  var codeToMsg = {};
  for (codeName in FileError) { 
    if (/_ERR$/.test(codeName)) {
      // the prop is an error code
      var code = FileError[codeName];
      codeToMsg[code] = codeName;
    }
  }
  
  var fileIOErrorHandler = function(e, msgPrefix) {
    var msg = codeToMsg[e.code];
    
    if (!msg) {
        msg = "Unknown Error [" + e.message + "]";      
    }
    
    msgPrefix = msgPrefix || 'Error:';
    _uiCtrl.error.showMsg(msgPrefix + " " + msg, e);
  }; // var fileIOErrorHandler = function( ...)
  
  return fileIOErrorHandler;
})();

function handleDocumentChange(filePath) {
  var mode = "";
  var modeName = "";
  if (filePath) {
    var fileName = filePath.match(/[^/\\]+$/)[0];
    _uiCtrl.title.set(fileName, filePath);
        
    if (fileName.match(/.js$/)) {
	  	mode = "javascript";
  		modeName = "JavaScript";    
    } else if (fileName.match(/.json$/)) {
      mode = {name: "javascript", json: true};
      modeName = "JavaScript (JSON)";
    } else if (fileName.match(/.html?$/)) {
      mode = "htmlmixed";
      modeName = "HTML";
    } else if (fileName.match(/.css$/)) {
      mode = "css";
      modeName = "CSS";
    } // else use deafult (Unknown)
  } else {
    _uiCtrl.title.set("[no document loaded]");
  }
  
  if (editor.getMode() != mode) {
    _uiCtrl.setMode(modeName);
    editor.setOption("mode", mode);
    initCodeMirror4Mode(editor, mode, _uiCtrl);
  } // else mode not changed. no-op
    
  customThemeIfApplicable(filePath); 
}

/**
 * @param filePath full file system path, 
 * or the logic might not work.
 * In particular, fileEntry.fullPath is only
 * an abstraction and should not be passed here.
 */
function customThemeIfApplicable(filePath) {
  if (filePath && filePath.match(/pweb-dev/)) { // make them look different
    editor.setOption('theme', 'rubyblue');
  } else {
    // default, need to be set explicitly in case mutilple files have been opened.
    editor.setOption('theme', 'blackboard');
  }
} // function customThemeByFile(..)


function newFile() {
  fileEntry = null;
  hasWriteAccess = false;
  handleDocumentChange(null);
}

function setFile(theFileEntry, isWritable) {
  fileEntry = theFileEntry;
  hasWriteAccess = isWritable;
}

function readFileIntoEditor(theFileEntry) {
  if (theFileEntry) {
    theFileEntry.file(function(file) {
      var fileReader = new FileReader();

      fileReader.onload = function(e) {
        // note: theFileEntry.fullPath does not give 
        // native file system path, which is needed 
        chrome.fileSystem.getDisplayPath(theFileEntry, function(displayPath) {
          handleDocumentChange(displayPath);
        editor.setValue(e.target.result); // actual changes
        
        if (CodeMirror.commands.clearSearch) {
          CodeMirror.commands.clearSearch(editor);
        }
        // the editor is just chnaged as if the file is dirty
        // but really it's just started
        editor.markClean();
        updateUIOnChange(editor);
        }); // getDisplayPath(..)        
      }; // fileReader.onload = ..

      fileReader.onerror = function(e) {
        fileIOErrorHandler(e, "Open File failed: ");
      };

      fileReader.readAsText(file);
    }, fileIOErrorHandler);
  }
}

function writeEditorToFile(theFileEntry) {
  theFileEntry.createWriter(function(fileWriter) {
    fileWriter.onerror = function(e) {
      // this one seems to be unnecessary, 
      // as any error will still 
      // be propagated to onwriteend callback
      // e is a ProgressEvent (not an error)
      if (e && e.target && e.target.error) {
	      fileIOErrorHandler(e.target.error, "Saving File failed: ");
      } else {
        console.error('onerror: unknown event %O', e);
      }
    };

    var blob = new Blob([editor.getValue()]);
    fileWriter.truncate(blob.size);
    fileWriter.onwriteend = function() {
      fileWriter.onwriteend = function(e) {
        if (this.error) {
          // "this"" is fileWriter instance
		      fileIOErrorHandler(this.error, "Save File failed:");      
        } else {
          editor.markClean();
          // note: theFileEntry.fullPath does not give 
          // native file system path, which is needed 
          chrome.fileSystem.getDisplayPath(theFileEntry, function(displayPath) {
            handleDocumentChange(displayPath);
            updateUIOnChange(editor);
            console.debug("Write completed.");              
          });
        }
      };

      fileWriter.write(blob);
    };
  }, fileIOErrorHandler);
} // function writeEditorToFile()

var onChosenFileToOpen = function(theFileEntry) {
  setFile(theFileEntry, false);
  readFileIntoEditor(theFileEntry);
};

var onWritableFileToOpen = function(theFileEntry) {
  setFile(theFileEntry, true);
  readFileIntoEditor(theFileEntry);
};

var onChosenFileToSave = function(theFileEntry) {
  setFile(theFileEntry, true);
  writeEditorToFile(theFileEntry);
};

function handleNewButton() {
  if (false) {
    newFile();
    editor.setValue("");
  } else {
    chrome.app.window.create('main.html', {
      frame: 'none', width: window.outerWidth, height: window.outerHeight 
    });
  }
}

function handleOpenButton() {
  proceedIfFileIsCleanOrOkToDropChanges(editor, function() {
    chrome.fileSystem.chooseEntry({ type: 'openFile' }, function(entry) {
      if (entry) {
        onChosenFileToOpen(entry);
      } else {
        console.debug('File Open: canceled by user. No-op.');
      }
    }); // chrome.fileSystem.chooseEntry()
  });
  
}

function handleSaveButton() {
  if (fileEntry && hasWriteAccess) {
    writeEditorToFile(fileEntry);
  } else if (fileEntry) {
    chrome.fileSystem.getWritableEntry(fileEntry, function(entry) {
      if (chrome.runtime.lastError) {
        _uiCtrl.error.showMsg(chrome.runtime.lastError.message, chrome.runtime.lastError);
        return;
      }
      if (!entry) {
        _uiCtrl.error.showMsg("Save file failed - the writable handle is null.");
        return;
      }
      // re-obtain the cur file as writable
      onChosenFileToSave(entry); 
    }); 
  } else {
    handleSaveAsButton();
  }
}

function handleSaveAsButton() {
  chrome.fileSystem.chooseEntry({ type: 'saveFile' }, function(entry) {
    if (entry) {
      onChosenFileToSave(entry);
    } else {
      console.debug('Save As canceled by user. Do nothing.');
    }
  });
}


var updateUIOnChange = function(cm) { 
  var isDirty = !cm.isClean();
  _uiCtrl.setDirty(isDirty);  
};


function proceedIfFileIsCleanOrOkToDropChanges(cm, proceedCallback) {

  function proceedIfOkToDropChanges(cm, proceedCallback) {
    var noop = function () {};
  
		cm.openConfirm('Are you sure to discard the changes? ' + 
                   '<button>Cancel</button> <button>Ok</button>', 
                   [ noop, proceedCallback]);
	} 

  
	if (cm.isClean()) {
    proceedCallback(cm);
  } else {
    proceedIfOkToDropChanges(cm, proceedCallback);
  } 
} // function proceedIfFileIsCleanOrOkToDropChanges(..)


function safeCloseWindow(cm) {
  proceedIfFileIsCleanOrOkToDropChanges(cm, function() {
    window.close();
  });
} // function safeCloseWindow(..)



/*** disable snippets 
function initContextMenu() {
  chrome.contextMenus.removeAll(function() {
    for (var snippetName in SNIPPETS) {
      chrome.contextMenus.create({
        title: snippetName,
        id: snippetName,
        contexts: ['all']
      });
    }
  });
}

chrome.contextMenus.onClicked.addListener(function(info) {
  // Context menu command wasn't meant for us.
  if (!document.hasFocus()) {
    return;
  }

  editor.replaceSelection(SNIPPETS[info.menuItemId]);
});
***/


window.onload = function() {
  /// initContextMenu(); disable snippets for now
  
  _uiCtrl = createEditorUICtrl(document);
  
  _uiCtrl.io.registerListeners(handleNewButton,                            
                               handleOpenButton, 
                               handleSaveButton, 
                               handleSaveAsButton);

  _uiCtrl.registerOnExitListener(function(evt) {
    safeCloseWindow(editor);
  });

  editor = createCodeMirror(document.getElementById("editor"), _uiCtrl);
  
  _uiCtrl.setEditorFocusFunction(editor.focus.bind(editor));

  
  // chrome app-specific features binding
  var extraKeys = editor.getOption('extraKeys') || {};
  var extraKeysForApp = {  
        "Cmd-N": function(cm) { handleNewButton(); },
        "Ctrl-N": function(cm) { handleNewButton(); },
        "Cmd-O": function(cm) { handleOpenButton(); },
        "Ctrl-O": function(cm) { handleOpenButton(); },
        "Cmd-S": function(cm) { handleSaveButton(); },
        "Ctrl-S": function(cm) { handleSaveButton(); },
        "Shift-Ctrl-S" : function(cm) { handleSaveAsButton(); },
        "Shift-Cmd-S" : function(cm) { handleSaveAsButton(); } 
      };
  var k;
  for (k in extraKeysForApp) {
    extraKeys[k] = extraKeysForApp[k];
  }
  editor.setOption('extraKeys', extraKeys);

  editor.on('change',  updateUIOnChange);

  newFile();
  onresize();
  
  initHelpUI();
  
  // move by dragging toolbar
  var btns = document.querySelector('.buttons');
  btns.addEventListener('mousedown', moveStart);  
  
  // drag-n-drop file support over app icon
  if (window.launchData) {
    var fileEntryToOpen = window.launchData.intent.data;
    onChosenFileToOpen(fileEntryToOpen);
  }

  // drag-n-drop support over the window itself
	patchDnDOverOnWinIfNeeded(editor); 
  
};

window.onresize = function() {
  var container = document.getElementById('editor');
  var containerWidth = container.offsetWidth;
  var containerHeight = container.offsetHeight;

  var scrollerElement = editor.getScrollerElement();
  scrollerElement.style.width = containerWidth + 'px';
  scrollerElement.style.height = containerHeight + 'px';

  // the outermost window edge
  var win = document.getElementById('win');
  win.style.width = (window.innerWidth - 10) + 'px';
  win.style.height = (window.innerHeight - 10) + 'px';
  
  editor.refresh();
  editor.focus();
};

// drag-n-drop support over the window itself
function patchDnDOverOnWinIfNeeded(editor) {
  
  var dragDrop = editor.getOption('dragDrop');
  if (!dragDrop) {
    return; // dnd not enabled anyway, so irrelevant
  }
  //
  // case dnd enabled. do the patch
  //
  // disable built-in dnd because it does not work
  //  (it keeps getting error during replacing contents)
  // Uncaught TypeError: Cannot call method 'chunkSize' of undefined codemirror.js:4522
  editor.setOption('dragDrop', false); 
  
  // use this alternative
  var dnd = new DnDFileController('body', function(data) {
    var item = data.items[0];
    // might consider restrict  filetype by checking
    // mimetype on item.type . however, some files
    // such as .md, .json , may not have type registered

    chosenFileEntry = item.webkitGetAsEntry();
    
    proceedIfFileIsCleanOrOkToDropChanges(editor, function() {
      onChosenFileToOpen(chosenFileEntry);
    });
    
  });
  
} // function patchDnDOverOnWinIfNeeded(..)
                                 
