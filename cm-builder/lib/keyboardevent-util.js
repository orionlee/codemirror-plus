(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    module.exports = mod();
  else if (typeof define == "function" && define.amd) // AMD
    return define([], mod);
  else // Plain browser env
    (this || window).KeyboardEventUtl = mod();
})(function() {
  "use strict";
    
  /**
   * Determine if a certain key is pressed. Use case is for handling hot keys.
   * 
   * @param event KeyboardEvent in question
   * @param code the key (not the character it creates) pressed, specifically, KeyboardEvent.code.
   * E.g, for KeyW the code is "KeyW" , while the character it represents may be "w" or "W",
   * For browser not supporting KeyboardEvent.code, the implementation fallbacks to other means to check.
   * @see http://unixpapa.com/js/key.html a discussion on the messiness of detereming key pressed. While the doc is not up-to-date, especially with the emergence of event.code, the spirit is applicable.
   */
  function codeEquals(event, code) {

    var KEY_IDENTIFIER = 1,
        WHICH = 2, 
        CODES_MAP = {
          "Space": ["U+0020", 32], 
          "Escape": ["U+0018", 27],
          "F4": ["F4", 115], 
          "KeyW": ["U+0057", 87], 
    };
    // CODES_MAP needs to be expanded as needed
   
    var codeMap = CODES_MAP[code];
    if (!codeMap) {
      throw new TypeError('codeEquals(event, code) - unsupported code: ' + code);
    }
    
    // event.key is not suitable as it represents the char generated, not the key pressed,
    // i.e., sensitive to shift, etc. for keyW, it may generate "W" or "w"
    if (event.code && event.code !== "") {
      // Chrome?, FF32+, Opera?, (no IE nor Safari)
      // @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code#Browser_compatibility
      return event.code == code; 
    } else if (event.keyIdentifier && event.keyIdentifier !== "U+0000") {
      // non-standard, but works for Safari 5.1+ and Chrome (26 - 52)
      // only works for keydown (NOT keypress)
      // @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyIdentifier#Browser_compatibility
      return event.keyIdentifier == codeMap[KEY_IDENTIFIER];
    } else if (event.which && event.which !== 0) {
      // legacy browsers
      return event.which === codeMap[WHICH];
    } else {
      console.warn('codeEquals() cannot determine the keypressed. Likely to be a browser compatibility issue. Event: %o', event);
      return false;
    }
  } // function codeEquals(..)  
  

  var KeyboardEventUtl = {
    codeEquals: codeEquals, 
  };

  return KeyboardEventUtl;
});
