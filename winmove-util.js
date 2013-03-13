/**
 * Support moving window by dragging certain area (typically toolbar)
 * 
 */

window.moveStart = (function() {
  
  function genMoveStop(moveGo) {
    return function(event) {
      document.removeEventListener("mousemove", moveGo,   true);
      document.removeEventListener("mouseup",  arguments.callee, true);
    };
  }
  
  function genMoveGo(offsetX, offsetY) {
    var lastMoveTime = 0;
    return function(event) {
      if (Date.now() - lastMoveTime > 20) {
        var newX, newY;
        newX = event.clientX + offsetX;
        newY = event.clientY + offsetY;
    
        window.moveTo(newX, newY);
        lastMoveTime = Date.now();
      } // else don't move quite yet'
      
      event.preventDefault();
    };
  }
  
  // the main entry point function to be registered 
  // as a mousedown event listener
  function moveStart(event) {
    
    // calc. offset between mouse and top-left corner of the element for more precise move
    var offsetX, offsetY;
    offsetX = window.screenX - event.clientX;
    offsetY = window.screenY - event.clientY;
  
    var moveGo = genMoveGo(offsetX, offsetY);
    var moveStop = genMoveStop(moveGo);
  
    event.preventDefault();
  
    document.addEventListener("mousemove", moveGo,   true);
    document.addEventListener("mouseup",  moveStop, true);
  
  }

  return moveStart;
  
})(); // window.moveStart = (function()

