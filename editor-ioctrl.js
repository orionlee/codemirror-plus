var createIOCtrl = (function() {

  var _fileEntry;
  var _hasWriteAccess;
  
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
  
  //
  // top-level exposed methods
  //
  
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
      openFileEntry: onChosenFileToOpen, 
      chooseAndSave: chooseAndSave,
      save: save 
      ///debug: function() {
      ///  console.log('IOCtrl - hook to internal states');
      ///  debugger;
      ///}
    };
    
    return res;
  } // function createIOCtrl(..)
  
  return createIOCtrl;
  
})(); // createIOCtrl = (function())
