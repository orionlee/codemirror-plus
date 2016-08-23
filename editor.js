function editorAppInit(window) {
  "use strict";
  
  // globals used 
  var document = window.document, 
      console = window.console,
      chrome = window.chrome,
      CodeMirror = window.CodeMirror,
      DnDFileController = window.DnDFileController, 
      KeyboardEventUtl = window.KeyboardEventUtl;
  
  // globals defined in other cmacs top-level script
  var createIOCtrl = window.createIOCtrl, 
      createEditorUICtrl = window.createEditorUICtrl, 
      bindCommand = window.bindCommand, 
      initHelpUI = window.initHelpUI;
  
  var editor; // abstraction over entire editor
  
  // abstraction over (non-CodeMirror aka ediotr) UI  constructs and methods;
  var _uiCtrl; 
  var _ioCtrl;
  
  /**
 * Invoked after new file has been loaded to the editor,
 * to update UI, and possibly editor setup accordingly.
 */
  function handleDocumentChange(filePath) {
    function findModeByFileContent(cm) {
      // implemented by inspecting shebang line, if it exists

      // in shebang line, the last word is usually
      // name of the programming language, its alias or extension
      var extOrName = (function() {
        var line1 = cm.getLine(0);
        var matches = line1.match(/^#!.+?([^ /\\]+)\s*$/);
        if (matches) {
          return matches[1];
        } else {
          return "";
        }
      })(); // extOrName = (function())

      var info = CodeMirror.findModeByExtension(extOrName) ||
          CodeMirror.findModeByName(extOrName);
      
      return info;
    } // function findModeByFileContent(..)
    
    var info = null;
    var fileName;
    if (filePath) {
      fileName = filePath.match(/[^\/\\]+$/)[0];
      _uiCtrl.title.set(fileName, filePath);
      info = CodeMirror.findModeByFileName(fileName);
      if (!info) {
        // usually some scripts with no extension
        info = findModeByFileContent(editor);
      }
    } else {
      _uiCtrl.title.set("[no document loaded]");
    }
    
    if (info && editor.getOption('mode') !== info.mime) {
      _uiCtrl.setMode(info.name);
      editor.setOption("mode", info.mime);
      CodeMirror.autoLoadMode(editor, info.mode);
      CodeMirror.builder.initMode(editor, info.mode, _uiCtrl);
    } // else mode not changed. no-op
    
    // manually fire the change event as document just loaded
    updateUIOnChange(editor);  
    
    // needed in case the editor is loaded via keyboard shortcut, e.g., open recent file.
    editor.focus();
    
    // the followings are highly-specific to my own workflow
    customThemeIfApplicable(filePath); 
    autoFoldForFlagFicSkeleton(fileName);
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
  
  function autoFoldForFlagFicSkeleton(fileName) {
    function foldHtmlAtString(str, returnRange) {
      CodeMirror.commands.clearSearch(editor); // hack to ensure ._searchState is created.
      editor._searchState.query = str;
      CodeMirror.commands.findNext(editor);
      var pos = editor._searchState.posFrom;
      console.debug('%s: %o', str, pos);
      editor.foldCode(pos);
      
      CodeMirror.commands.clearSearch(editor);
      editor.setSelection(pos); // clear selection from search
      if (returnRange) {
        return CodeMirror.helpers.fold.xml(editor, pos);
      } else {
        return;
      }
    } // function foldHtmlAtString(..)
    
    function selectFlagsH1Text(cm) {
      var h1Line = cm.getLine(118);
      if (!h1Line.match(/<h1>.+<\/h1>/)) {
        console.warn('The line is not <h1>: ', h1Line);
        return false;
      }
      var chStart = h1Line.indexOf('<h1>') + 4;
      var chEnd = h1Line.indexOf('</h1>');

      cm.setSelection(CodeMirror.Pos(118, chStart), CodeMirror.Pos(118, chEnd));
      
      // replace special characters (if any) not suitable for filename in the copied title text
      var reSpecialChars = /[:?*\\\/]/g;
      var toUndo = false;
      if (reSpecialChars.test(cm.getSelection())) {
        cm.replaceSelection(cm.getSelection().replace(reSpecialChars, '_'));
        toUndo = true;
      }
      
      setTimeout(function() {
        document.execCommand('copy'); // chrome 43+
        if (toUndo) {
          setTimeout(cm.undo.bind(cm), 50);
        }
      }, 250); 

    } // function selectFlagsH1Text(..)

    if (fileName == 'flagfic_skeleton.html') {    
      foldHtmlAtString('<head');     
      var bookR = foldHtmlAtString('<div id="book"', true);  
      foldHtmlAtString('<script type="text/javascript"');
      
      // select div#id, as the typical use case is to remove them (to be replaced by copy-pasted one)
      editor.setSelection(CodeMirror.Pos(bookR.from.line, 0), CodeMirror.Pos(bookR.to.line+1, 0));
      
      bindCommand(editor, 'selectFlagsH1Text', {keyName: "Ctrl-H"}, selectFlagsH1Text);
      editor.openDialog('<button>Ok</button> Ctrl-H to select / copy &lt;H1> Text to paste as filename');
    }
    
  } // function autoFoldForFlagFicSkeleton(..)
  
  
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
  
  // BEGIN IO callbacks
  function readSuccessCallback(fileFullPath, fileContent) {
    // clean-up old states before reading in new file
    resetEditorStates(editor);
    
    editor.setValue(fileContent); // actual file content
    editor.markClean(); // starting point of edit and history
    editor.clearHistory();
    
    // new content ready, update UI accordingly
    handleDocumentChange(fileFullPath);
    
  } // function readSuccessCallback(..)
  
  function saveSuccessCallback(fileFullPath) {
    editor.markClean();
    handleDocumentChange(fileFullPath); // in case of save as a file with different name
  } // function saveSuccessCallback()
  
  
  function newSuccessCallback() {
    editor.setValue("");
    editor.markClean();
    handleDocumentChange(null);
    
  } // function newSuccessCallback()
  
  // END IO callbacks
  
  // BEGIN UI event hooks to connect to IO logic
  function handleNewButton() {
    if (false) {
      _ioCtrl.newFile();    
    } else {
      chrome.app.window.create('main.html', {
        frame: 'none', width: window.outerWidth, height: window.outerHeight,
        top: window.screenTop + window.screen.availHeight * 0.05,
        left: window.screenLeft + window.screen.availWidth * 0.05
      });
    }
  }
  
  function handleOpenButton() {
    proceedIfFileIsCleanOrOkToDropChanges(editor, function() {
      _ioCtrl.chooseAndOpen();      
    });    
  }
  
  function handleSaveButton() {
    _ioCtrl.save(editor.getValue());
  }
  
  function handleSaveAsButton() {
    _ioCtrl.chooseAndSave(editor.getValue());
  }
  
  function handleOpenRecentButton(ev) {
    _ioCtrl.getRecentList(function(recentList) {
      // call uiCtrl to populate recent button with the list
      _uiCtrl.io.createRecentListDropDownUI(recentList,
                                            function(fileId, destroyUICallback) {
                                              proceedIfFileIsCleanOrOkToDropChanges(editor, function() {
                                                _ioCtrl.openRecentById(fileId);      
                                              }, destroyUICallback);          
                                            }, 
                                            _ioCtrl.pinUnpinRecentListEntry, 
                                            _ioCtrl.removeFromRecentList
                                           );
    });  
  } // function handleOpenRecentButton()
  
  // END UI event hooks to connect to IO logic
  
  var updateUIOnChange = function(cm) { 
    var isDirty = !cm.isClean();
    _uiCtrl.setDirty(isDirty);  
  };
  
  
  // @param cleanUpCallback if specified, it will be invoked irrespective of proceed or not
  //   the effect is equivalent to finally {} block of normal sychrnous flow
  function proceedIfFileIsCleanOrOkToDropChanges(cm, proceedCallback, cleanUpCallback) {
    
    function proceedAndCleanUp(cm) {
      try { 
        proceedCallback(cm);
      } finally {
        if (cleanUpCallback) {
          cleanUpCallback(cm);
        }
      }
    } // function proceedAndCleanUp(..)
    
    function proceedIfOkToDropChanges(cm, okCallback, cancelCallback) {
      cancelCallback = cancelCallback || (function noop() {});
      
      cm.openConfirm('Are you sure to discard the changes? ' + 
                     '<button>Cancel</button> <button>Ok</button>', 
                     [ cancelCallback, okCallback]);
    } 
    
    
    if (cm.isClean()) {
      proceedAndCleanUp(cm);
    } else {
      proceedIfOkToDropChanges(cm, proceedAndCleanUp, cleanUpCallback);
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
    
    _uiCtrl = createEditorUICtrl(window, document);
    
    var errorCallback = _uiCtrl.error.showMsg;
    _ioCtrl = createIOCtrl(window, 
                           readSuccessCallback, 
                           saveSuccessCallback, 
                           newSuccessCallback, 
                           errorCallback);
    
    _uiCtrl.io.registerListeners(handleNewButton,                            
                                 handleOpenButton, 
                                 handleOpenRecentButton, 
                                 handleSaveButton, 
                                 handleSaveAsButton);
    
    editor = CodeMirror.builder.create(document.getElementById("editor"), _uiCtrl);
    CodeMirror.modeURL = "node_modules/codemirror/mode/%N/%N.js";  // one-time init for autoload mode feature
    window.editor = editor; // the top level export, entry point to the created editor
    
    _uiCtrl.setEditorFocusFunction(editor.focus.bind(editor));
    
    var safeToExitCallback = proceedIfFileIsCleanOrOkToDropChanges.bind(undefined, editor);
    _uiCtrl.registerOnExitListener(safeToExitCallback);
    
    // finally exwant to bind Ctrl-W, but Ctrl-W is also used in emacs for 
    // very different reasons. So aovid it to reduce chances of accidental exit
    bindCommand(editor, 'safeExitWindow', {keyName: ["Alt-F4", "Ctrl-F4"] }, 
                _uiCtrl.safeExitWindow);
    
    // Prevent OS exit window key (Alt-F4, etc.) from propagating to the OS,
    // so that they can be handled by the editor binding above
    function preventOSExitWindow(evt) { 
      /// console.debug(evt);

      if ( (evt.ctrlKey && KeyboardEventUtl.codeEquals(evt, "KeyW")) || // Ctrl-W
          (evt.ctrlKey && KeyboardEventUtl.codeEquals(evt, "F4")) || 
          (evt.altKey && KeyboardEventUtl.codeEquals(evt, "F4")) ) { 
        evt.preventDefault(); 
      }
    }  
    window.addEventListener('keydown', preventOSExitWindow);
    
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
    
    _ioCtrl.newFile();    
    
    window.onresize();
    
    // this should be moved to uiCtrl 
    // but since it relies on global editor instance 
    // to dynamically generate doc, it is left 
    // alone for now. it has no bearing on other features anyway
    
    window.initHelpUI(document, editor);
    
    // drag-n-drop support over the window itself
    patchDnDOverOnWinIfNeeded(editor); 
    
    // upon minimize, maximize, etc., we will adjust by calling correspond resize
    chrome.app.window.current().onBoundsChanged.addListener(window.onresize);
    
    // the followings are highly-specific to my own workflow
    // do not add fanfiction files to recent file list (as they are not likely to be re-opened).
    _ioCtrl.setRecentListIgnoreFunc(function(filePath) {
      return /_fanfictions.+[A-Z]{2,} [MTK]\.html$/.test(filePath);  
    });

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
      
      // the standard item.getFile() does not provide ways to save the file back
      // We are using Chrome's FileEntry construct anyway
      var chosenFileEntry = item.webkitGetAsEntry();
      
      proceedIfFileIsCleanOrOkToDropChanges(editor, function() {
        _ioCtrl.openFileEntry(chosenFileEntry);
      });
      
    });
    
  } // function patchDnDOverOnWinIfNeeded(..)
    
  editorAppInit._inspect = function(expr) { // for debug purposes
    var res = eval(expr);  // jshint ignore:line
    return res;
  }; // editorAppInit._inspect = function(..)
  
} // function editorAppInit(..)
editorAppInit(window);

