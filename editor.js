var editor;
var fileEntry;
var hasWriteAccess;

// abstraction over (non-CodeMirror aka ediotr) UI  constructs and methods;
var _uiCtrl; 

var fileIOErrorHandler = (function() {
  var codeToMsg = {};
  for (var codeName in FileError) { 
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

/**
 * Invoked after new file has been loaded to the editor,
 * to update UI, and possibly editor setup accordingly.
 */
function handleDocumentChange(filePath) {
  var mode = "";
  var modeName = "";
  if (filePath) {
    var fileName = filePath.match(/[^\/\\]+$/)[0];
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
  
  // manually fire the change event as document just loaded
  updateUIOnChange(editor);  
  
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

/**
 * Reset any lingering states / processes before reading a new file to the editor.
 */
function resetEditorStates(cm) {
  if (CodeMirror.commands.clearSearch) {
    CodeMirror.commands.clearSearch(cm);
  }
  
  if (CodeMirror.commands.disableJsHint) {
    CodeMirror.commands.disableJsHint(cm);
  }
} // function resetEditorStates(..)

function readFileIntoEditor(theFileEntry) {
  if (theFileEntry) {
    theFileEntry.file(function(file) {
      var fileReader = new FileReader();

      fileReader.onload = function(e) {
        // note: theFileEntry.fullPath does not give 
        // native file system path, which is needed 
        chrome.fileSystem.getDisplayPath(theFileEntry, function(displayPath) {
          // clean-up old states before reading in new file
          resetEditorStates(editor);
          
          editor.setValue(e.target.result); // actual file content
          editor.markClean(); // starting point of edit and history
          editor.clearHistory();

          // new content ready, update UI accordingly
          handleDocumentChange(displayPath);
          
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
            handleDocumentChange(displayPath); // in case of save as a file with different name
            updateUIOnChange(editor); // inform UI editor is clean again, etc.
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

  editor = createCodeMirror(document.getElementById("editor"), _uiCtrl);
  
  _uiCtrl.setEditorFocusFunction(editor.focus.bind(editor));

  var safeToExitCallback = proceedIfFileIsCleanOrOkToDropChanges.bind(undefined, editor);
  _uiCtrl.registerOnExitListener(safeToExitCallback);

  // finally exwant to bind Ctrl-W, but Ctrl-W is also used in emacs for 
  // very different reasons. So aovid it to reduce chances of accidental exit
  bindCommand(editor, 'safeExitWindow', {keyName: ["Alt-F4", "Ctrl-F4"] }, 
              _uiCtrl.safeExitWindow);
  
  
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

  // this should be moved to uiCtrl 
  // but since it relies on global editor instance 
  // to dynamically generate doc, it is left 
  // alone for now. it has no bearing on other features anyway
  
  initHelpUI(document, editor);
  
  // drag-n-drop file support over app icon
  if (window.launchData) {
    var fileEntryToOpen = window.launchData.intent.data;
    onChosenFileToOpen(fileEntryToOpen);
  }

  // drag-n-drop support over the window itself
	patchDnDOverOnWinIfNeeded(editor); 
  
};

// codemirror specific changes upon window resize
// it does not need to be part of uiCtrl
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
                                 
