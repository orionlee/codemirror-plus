// show ColNumberMode, the main entry
// after execution would be
// toggleColumNumberMode CM command
// Known issues:
// 1. it might be better be modeled as a CM option, rather than a CM command
//    (options allow it to be specify on startup more easily')
function createToggleColumNumberMode(callback) {
  
  var _cm;
  
  function hideColumnNumber() {
    if (callback) {
      callback(false, null);
    }
  } // function hideColumnNumber(..)
  
  function showColumNumber(cm) { 
    // cm passed in and member _cm 
    // should be the same instance '
    if (callback) {
      callback(true, cm.getCursor());
    }
  } // function showColumNumber(..)
  
  
  // the main entry point that can serve as a CM command
  function toggleColumNumberMode(cm) {
    if (_cm) { // currently on, so toggle off
      _cm.off('cursorActivity', showColumNumber);
      _cm = null;
      setTimeout(hideColumnNumber, 1000);
    }  else { // currently off, toggle on 
      _cm = cm;
      _cm.on('cursorActivity', showColumNumber);
      showColumNumber(_cm); // make it show before cursor moving
    }
  } // function toggleColumNumberMode(..)
  
  return toggleColumNumberMode;
  
} // function createToggleColumNumberMode(..)
 
