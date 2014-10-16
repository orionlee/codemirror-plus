var createIOCtrl = (function() {

  var _fileEntry;
  var _hasWriteAccess;
  
  var _recentFilesManager;
  
  // TODO: consider to be parametrized
  var  _readSuccessCallback, _saveSuccessCallback, _newSuccessCallback, _errorCallback;
  
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
      _errorCallback(msg, e);
    }; // var fileIOErrorHandler = function( ...)
    
    return fileIOErrorHandler;
  })();
  
  
  function setFile(theFileEntry, isWritable) {
    _fileEntry = theFileEntry;
    _hasWriteAccess = isWritable;
  }
    
  function readFileIntoEditor(theFileEntry) {
    if (theFileEntry) {
      theFileEntry.file(function(file) {
        var fileReader = new FileReader();
  
        fileReader.onload = function(e) {
          // note: theFileEntry.fullPath does not give 
          // native file system path, which is needed 
          chrome.fileSystem.getDisplayPath(theFileEntry, function(displayPath) {          
            _readSuccessCallback(displayPath, e.target.result);            
            _recentFilesManager.addInfo(theFileEntry, displayPath);            
          }); // getDisplayPath(..)        
        }; // fileReader.onload = ..
  
        fileReader.onerror = function(e) {
          fileIOErrorHandler(e, "Open File failed: ");
        };
  
        fileReader.readAsText(file);
      }, fileIOErrorHandler);
    }
  }
  
  function writeEditorToFile(theFileEntry, fileContent) {
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
  
      var blob = new Blob([fileContent]);
      fileWriter.truncate(blob.size);
      fileWriter.onwriteend = function() {
        fileWriter.onwriteend = function(e) {
          if (this.error) {
            // "this"" is fileWriter instance
            fileIOErrorHandler(this.error, "Save File failed:");      
          } else {
            // note: theFileEntry.fullPath does not give 
            // native file system path, which is needed 
            chrome.fileSystem.getDisplayPath(theFileEntry, function(displayPath) {
              //TODO: @depends _saveSuccessCallback(fileFullPath);
              _saveSuccessCallback(displayPath);
              _recentFilesManager.addInfo(theFileEntry, displayPath);
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
  
  var onChosenFileToSave = function(theFileEntry, fileContent) {
    setFile(theFileEntry, true);
    writeEditorToFile(theFileEntry, fileContent);
  };

  // encapsulate the management of recent list of files
  _recentFilesManager = (function() {
    var KEY = 'recentFiles';
    
    // BEGIN helpers to manipulate in-memory infoList object
    //
    
    var IL_MAX_LENGTH = 10;
    var IL_IDX_PATH = 0;
    var IL_IDX_ID = 1;
    function ilGetById(infoList, id) {
      for(var i = 0; i < infoList.length; i++) {
        var info = infoList[i];
        if (id == info[IL_IDX_ID]) {
          return info;
        }
      }
      return null;
    }
    
    function ilGetOffsetByFilePath(infoList, filePath) {
      for(var i = 0; i < infoList.length; i++) {
        var info = infoList[i];
        if (filePath == info[IL_IDX_PATH]) {
          return i;
        }
      }
      return -1;      
    } // function ilGetOffsetByFilePath(..)
    
    function ilAdd(infoList, filePath, fileId) {
      // remove existing one (by matching filepath), if any;
      var info = [filePath, fileId];
      var curOffset = ilGetOffsetByFilePath(infoList, filePath);
      if (curOffset >= 0) {
        infoList.splice(curOffset, 1); 
      }
      
      // add to the top of the list
      infoList.unshift(info);
      
      // truncate to avoid the list gets too large
      if (infoList.length > IL_MAX_LENGTH) {
        infoList.length = IL_MAX_LENGTH;
      }

       return infoList;      
    } // function ilAdd(..)
    
    //
    // END helpers to manipulate in-memory infoList object
    
    
    // Debug helper snippets for chrome.stroage:
    //   chrome.storage.local.get('recentFiles', function(items) { console.debug(items.recentFiles); _dbg = items.recentFiles; })
    //   chrome.storage.local.get(null, function(items) { console.debug(items); _dbg = items; })
    //   chrome.storage.local.remove('recentFiles', function() {});
    
    
    /**
     * @return an Array of [filePath, fileId] pair, 
     *    fileId can be used to reopen with #openRecentById 
     */
    var getInfoList = function(cb) {
      chrome.storage.local.get(KEY, function(items) {
        if (chrome.runtime.lastError) {
          _errorCallback(chrome.runtime.lastError.message, chrome.runtime.lastError);
          return;
        }
        
        var infoList = items[KEY] || [];        
        cb(infoList);
      });
    };

      
    var openRecentById = function(id, cb) {
      // optional callback is useful only in a isolation test of _recentFilesMgr, without
      // the supporting ioCtrl methods
      cb = cb || onChosenFileToOpen;
      getInfoList(function(infoList) {
        var recentFileInfo = ilGetById(infoList, id);
        if (!recentFileInfo) {          
          _errorCallback('Internal error: File with id ' + id + ' not found in recent file list.');
        }
        /// console.debug(recentFileInfo);
        chrome.fileSystem.restoreEntry(recentFileInfo[IL_IDX_ID], function(entry) {
          if (chrome.runtime.lastError) {
            _errorCallback(chrome.runtime.lastError.message, chrome.runtime.lastError);
            return;
          }

          if (entry) {
            cb(entry);
          } else {
            console.warn('Load recent file fails.');
          }
        });        
      });
    };  
      
    var addInfo = function(entry, filePath) {
      var fileEntryId = chrome.fileSystem.retainEntry(entry);
      getInfoList(function(infoList) {
        ilAdd(infoList, filePath, fileEntryId);
        var items = {};
        items[KEY] = infoList;
        chrome.storage.local.set(items, function() {
          if (chrome.runtime.lastError) {
            _errorCallback(chrome.runtime.lastError.message, chrome.runtime.lastError);
            return;
          }
        });
      });
    };
    
    return {
      getInfoList: getInfoList,
      openRecentById: openRecentById,
      addInfo: addInfo
    };
  })(); // _recentFilesManager = (function()
  
  //
  // top-level exposed methods
  //
  
  // @interface
  function openRecentById(id) {
    _recentFilesManager.openRecentById(id);
  } // function openRecentById(..)
  
  
  // @interface
  function chooseAndOpen() {
    chrome.fileSystem.chooseEntry({ type: 'openFile' }, function(entry) {
      if (entry) {
        onChosenFileToOpen(entry);
      } else {
        console.debug('File Open: canceled by user. No-op.');
      }
    }); // chrome.fileSystem.chooseEntry()
    
  } // function chooseAndOpen()
  
  // @interface
  function save(fileContent) {
    if (_fileEntry && _hasWriteAccess) {
      writeEditorToFile(_fileEntry, fileContent);
    } else if (_fileEntry) {
      chrome.fileSystem.getWritableEntry(_fileEntry, function(entry) {
        if (chrome.runtime.lastError) {
          _errorCallback(chrome.runtime.lastError.message, chrome.runtime.lastError);
          return;
        }
        if (!entry) {
          _errorCallback("Save file failed - the writable handle is null.");
          return;
        }
        // re-obtain the cur file as writable
        onChosenFileToSave(entry, fileContent); 
      }); 
    } else {
      chooseAndSave(fileContent);
    }
    
  } // function saveFile(..)
  
  // @interface
  function chooseAndSave(fileContent) {
    chrome.fileSystem.chooseEntry({ type: 'saveFile' }, function(entry) {
      if (entry) {
        onChosenFileToSave(entry, fileContent);
      } else {
        console.debug('Save As canceled by user. Do nothing.');
      }
    });  
  } // function chooseAndSave(..)
  
  // @interface
  function newFile() {
    _fileEntry = null;
    _hasWriteAccess = false;
    _newSuccessCallback();
  }
  
  // the top level function to be exported
  function createIOCtrl(readSuccessCallback, saveSuccessCallback, newSuccessCallback, errorCallback) {  
    _readSuccessCallback = readSuccessCallback;
    _saveSuccessCallback = saveSuccessCallback;  
    _newSuccessCallback = newSuccessCallback; 
    _errorCallback = errorCallback;
  
    // interface users will use 
    var res = {
      newFile: newFile, 
      chooseAndOpen: chooseAndOpen,
      // openFileEntry is exposed as it is needed to support drag-and-drop.
      // Otherwise, fileEntry is supposed to be an implementation details.
      // see top-level code (editor.js) patchDnDOverOnWinIfNeeded() for details
      openFileEntry: onChosenFileToOpen, 
      chooseAndSave: chooseAndSave,
      save: save, 
      openRecentById: openRecentById,
      getRecentList: _recentFilesManager.getInfoList 
      ///debug: function() {
      ///  console.log('IOCtrl - hook to internal states');
      ///  debugger;
      ///}
    };
    
    return res;
  } // function createIOCtrl(..)
  
  return createIOCtrl;
  
})(); // createIOCtrl = (function())
