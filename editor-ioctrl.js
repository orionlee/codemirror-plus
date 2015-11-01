function createIOCtrl(window, readSuccessCallback, saveSuccessCallback, newSuccessCallback, errorCallback) {
  "use strict";
  
  // imports from global to support "use strict";
  var FileError = window.FileError, FileReader = window.FileReader, Blob = window.Blob, 
      console = window.console, chrome = window.chrome;
  
  
  // copy rest of params to state-like variables here
  var  _readSuccessCallback, _saveSuccessCallback, _newSuccessCallback, _errorCallback;
  _readSuccessCallback = readSuccessCallback;
  _saveSuccessCallback = saveSuccessCallback;  
  _newSuccessCallback = newSuccessCallback; 
  _errorCallback = errorCallback;

  // the internal state: the file to do I/O with 
  var _fileEntry;
  var _hasWriteAccess;
  
  // a set of functions encapsulating recent files feature,
  // to be defined later
  var _recentFilesManager; 
    
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
    //  (a sub-structure of recentList)
    
    var InfoList = (function() {
      
      var IL_MAX_LENGTH = 20; // much larger than actual display max to allow for deleting from the list
      var IL_IDX_PATH = 0;
      var IL_IDX_ID = 1;
      function ilGetById(infoList, id) {
        for(var i = 0; i < infoList.length; i++) {
          var info = infoList[i];
          if (!info) {
            console.error('ilGetById(): infoList[%s] unexpectedly null. infoList: %o', i, infoList);
            continue;
          }
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
      
      function ilAdd(infoList, filePath, fileId, toAdd) {
        // remove existing one (by matching filepath), if any;      
        infoList = ilRemove(infoList, filePath);
        
        // add to the top of the list
        var info = [filePath, fileId];
        if (toAdd) { // pin list use case
          infoList.push(info);  
        } else { // recent list use case
          infoList.unshift(info);  
        }
        
        // truncate to avoid the list gets too large
        if (infoList.length > IL_MAX_LENGTH) {
          infoList.length = IL_MAX_LENGTH;
        }
        
        return infoList;      
      } // function ilAdd(..)
      
      function ilRemove(infoList, filePath) {
        var curOffset = ilGetOffsetByFilePath(infoList, filePath);
        if (curOffset >= 0) {
          infoList.splice(curOffset, 1); 
        }
        return infoList;      
      } // function ilRemove(..)
      
      function ilUpdateIfAny(infoList, filePath, fileEntryId) {
        for(var i = 0; i < infoList.length; i++) {
          var info = infoList[i];
          if (filePath == info[IL_IDX_PATH]) {
            info[IL_IDX_ID] = fileEntryId;
            return i;
          }
        }
        return -1;
      } // function ilUpdateIfAny(..)

      
      //
      // Object-oriented wrapper to make outside code clearer
      //
      
      function InfoList() {
        throw new Error('InfoList constructor is not meant to be invoked directly');
      } // function InfoList()
      Object.setPrototypeOf(InfoList.prototype, Array.prototype);
      
      InfoList.asInfoList = function(ary) {
        console.assert(Array.isArray(ary), 'InfoList.asInfoList(ary): argument ary should be an array', ary);
        Object.setPrototypeOf(ary, InfoList.prototype);        
        return ary;
      };
      
      InfoList.create = function() {
        return InfoList.asInfoList([]);
      }; // InfoList.create = function()
            
      InfoList.IDX_PATH = IL_IDX_PATH;
      Object.defineProperty(InfoList, 'IDX_PATH', {writable: false});

      InfoList.IDX_ID = IL_IDX_ID;
      Object.defineProperty(InfoList, 'IDX_ID', {writable: false});
      
      // internal helper to create an array out of
      // this, arguments, see below for use cases
      //
      // Note: [this].concat(arguments) DOES NOT work
      //  because arguments, while array-like-ish, is not
      //  an arary, but an Arguments object
      // [this].concat(arguments) will simply result 
      // as [this, arguments]
      function _toArray(obj, args) {
        var res = [obj];
        for(var i = 0; i < args.length; i++) {
          res.push(args[i]);
        }
        return res;
      } // function _toArray(..)
      
      var ilfn = InfoList.prototype;
      
      ilfn.getById = function() {
        return ilGetById.apply(null, _toArray(this, arguments));
      }; // ilfn.get = function()
      

      ilfn.add = function() {
        return ilAdd.apply(null, _toArray(this, arguments));
      }; // ilfn.add = function()
      
      ilfn.remove = function() {
        return ilRemove.apply(null, _toArray(this, arguments));
      }; // ilfn.remove = function()

      ilfn.updateIfAny = function() {
        return ilUpdateIfAny.apply(null, _toArray(this, arguments));
      }; // ilfn.updateIfAny = function()

      return InfoList;
    })(); // InfoList = (function()
    
    
    //
    // END helpers to manipulate in-memory infoList object
    
    
    // Debug helper snippets for chrome.stroage:
    //   chrome.storage.local.get('recentFiles', function(items) { console.debug(items.recentFiles); _dbg = items.recentFiles; })
    //   chrome.storage.local.get(null, function(items) { console.debug(items); _dbg = items; })
    //   chrome.storage.local.remove('recentFiles', function() {});
    //   chrome.storage.local.set({recentFiles: _dbg}, function(args) { console.debug(args); _dbg = args; })

    
    /**
     * @return a recentList object in the form of: 
     * { pinned: <infoList>, recent: <infoList> }
     * <infoList> is an Array of [filePath, fileId] pair, 
     *    fileId can be used to reopen with #openRecentById 
     */
    var getRecentList = function(cb) {
      chrome.storage.local.get(KEY, function(items) {
        if (chrome.runtime.lastError) {
          _errorCallback(chrome.runtime.lastError.message, chrome.runtime.lastError);
          return;
        }
        
        var recentList;
        if (items[KEY]) {
          recentList= {pinned: InfoList.asInfoList(items[KEY].pinned), 
                       recent: InfoList.asInfoList(items[KEY].recent)};          
        } else {
          recentList= {pinned: InfoList.create(), recent: InfoList.create()};
        } 
        cb(recentList);
      });
    };


    var updateRecentList = function(updateFn, doneFn) {
      getRecentList(function(recentList) {
        recentList = updateFn(recentList);
        var items = {};
        items[KEY] = recentList;
        chrome.storage.local.set(items, function() {
          if (chrome.runtime.lastError) {
            _errorCallback(chrome.runtime.lastError.message, chrome.runtime.lastError);
            return;
          }
          if (doneFn) {
            doneFn(recentList);
          }
        });
      });      
    }; // function updateRecentList(..)
      
    var openRecentById = function(id, _cb) {
      // optional _cb callback is useful only in a isolation test of _recentFilesMgr, without
      // the supporting ioCtrl methods
      var cb = _cb || onChosenFileToOpen;
      getRecentList(function(recentList) {
        var recentFileInfo = recentList.pinned.getById(id);
        if (!recentFileInfo) {          
          recentFileInfo = recentList.recent.getById(id);
        }
        if (!recentFileInfo) {          
          _errorCallback('Internal error: File with id ' + id + ' not found in recent file list.');
        }
        /// console.debug(recentFileInfo);
        chrome.fileSystem.restoreEntry(recentFileInfo[InfoList.IDX_ID], function(entry) {
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
    
    var toIgnoreForRecentList = null;
    
    /**
     * @param fn the function used to filter recent list. If fn(filePath) returns true, 
     * the file will NOT be added to the recent list
     */ 
    function setRecentListIgnoreFunc(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError('setRecentListIgnoreFunc(fn): fn should be a function. Actual: ' + (typeof fn));
      }
      toIgnoreForRecentList = fn;
    } // function setRecentListIgnoreFunc(..)
    
    var addInfo = function(entry, filePath) {
      if (toIgnoreForRecentList && toIgnoreForRecentList(filePath)) {
        return;
      }
        
      var fileEntryId = chrome.fileSystem.retainEntry(entry);
      updateRecentList(function(recentList) {
        recentList.recent.add(filePath, fileEntryId);        
        recentList.pinned.updateIfAny(filePath, fileEntryId); // use the latest fileEntryId if it's there        
        return recentList;
      });
    };
    
    var pinUnpin = function(toPin, filePath, fileId, cb) {
      updateRecentList(function(recentList) {
        if (toPin) {
          var toEnd = true;
          recentList.pinned.add(filePath, fileId, toEnd);
        } else {
          recentList.pinned.remove(filePath);        
        }
        return recentList;
      }, cb);
    }; 
    
    var removeInfo = function(pinned, filePath, fileId, cb) {
      updateRecentList(function(recentList) {
        if (pinned) {
          recentList.pinned.remove(filePath);
        } else {
          recentList.recent.remove(filePath);        
        }
        return recentList;
      }, cb);
    }; 
    
    return {
      getRecentList: getRecentList,
      openRecentById: openRecentById,
      addInfo: addInfo,
      pinUnpin: pinUnpin,
      removeInfo: removeInfo,
      setRecentListIgnoreFunc: setRecentListIgnoreFunc
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
  
  // interface users will use 
  var ioCtrl = {
    newFile: newFile, 
    chooseAndOpen: chooseAndOpen,
    // openFileEntry is exposed as it is needed to support drag-and-drop.
    // Otherwise, fileEntry is supposed to be an implementation details.
    // see top-level code (editor.js) patchDnDOverOnWinIfNeeded() for details
    openFileEntry: onChosenFileToOpen, 
    chooseAndSave: chooseAndSave,
    save: save, 
    openRecentById: openRecentById,
    getRecentList: _recentFilesManager.getRecentList,
    pinUnpinRecentListEntry: _recentFilesManager.pinUnpin, 
    removeFromRecentList: _recentFilesManager.removeInfo,
    setRecentListIgnoreFunc : _recentFilesManager.setRecentListIgnoreFunc
    ///debug: function() {
    ///  console.log('IOCtrl - hook to internal states');
    ///  debugger;
    ///}
  };
  
  return ioCtrl;
    
} // function createIOCtrl(..)
