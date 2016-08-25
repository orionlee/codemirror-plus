(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("codemirror/lib/codemirror"), require("./search"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["codemirror/lib/codemirror", "./search"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(
   /**
    * Extend CodeMirror standard search addon with 
    * auto complete by search history. Usage:
    *   CodeMirror.extendSearchWithAutoComplete(cm); // extend search with autocomplete
    * 
    * @exports CodeMirror 
    */
   CodeMirror) {
  "use strict";

  // BEGIN add search history feature
  function SearchHistory(maxLength) {
    this.maxLength = maxLength || 40;
    this.hist = [];  
  } // function SearchHistory()
  SearchHistory.prototype.getAll = function() {
    // clone it to avoid side effect
    var histCopy = this.hist.map(function(e) { return e; });
    return histCopy;
  };
  SearchHistory.prototype.add = function(query) {
    if (!query) {
      return;
    } // empty strin: silent no-op;

    query = query.toString(); // in case query parameter is a RegExp, we store the textual form
    
    // handle duplicates (from the last one)
    var lastOne = this.hist.length > 0 ? this.hist[this.hist.length - 1] : "";
    if (query != lastOne) {
      this.hist.push(query);    
    }
    if (this.hist.length > this.maxLength) {
      this.hist.shift();
    }
  };
  
  function getSearchHistory(cm) {
    return cm.state._searchHistory || (cm.state._searchHistory = new SearchHistory());
  }
  
  // END search history feature


  /**
   * Setup auto complete of searches by search history.
   * 
   * @param cm the CodeMirror instance
   * @param inpElt the input DOM elemeent of the search field in the 
   * search dialog to be auto completed. 
   */
  function setupDialogAutoComplete(cm, inpElt) {    
    function getSearchHistoryHints(inpValue) {
      var res = [];
      var hist = getSearchHistory(cm).getAll();
      for (var i = hist.length - 1; i >= 0; i--) {
        // all search query starts with inpValue, 
        // including "" as inpValue
        if (!inpValue || hist[i].indexOf(inpValue) === 0) {
          if (res.indexOf(hist[i]) < 0) { // remove duplicates
            res.push(hist[i]);          
          }
        }
      }
      // keep the reverse history order
      return res;
    } // function getCodeMirrorCommandHints()
    
    function autoCompleteSearchCmd(event) {
      // if Ctrl-space,
      if ("Ctrl-Space" === CodeMirror.keyName(event)) { 
        event.preventDefault();
        /// console.debug('Trying to to complete "%s"', event.target.value);
        var inpValue = event.target.value;
        var inpElt = event.target;
        CodeMirror.showHint4Dialog(cm, function() {
          var data = {};
          data.list = getSearchHistoryHints(inpValue);
          data.inpElt = inpElt;
          return data;
        },  { pressEnterOnPick: false } ); 
      } // if ctrl-space
    } // function autoCompleteSearchCmd(..)
    
    //
    // the main setup logic: add keydown to the input box specified    
    //   use keydown event rather than keypress to handle some browser compatibility issue
    //
    inpElt.onkeydown = autoCompleteSearchCmd;

  } // function setupDialogAutoComplete(..)


  // Setup the hooks to main search addon
  function extendSearchWithAutoComplete(cm) {
    
    function addToSearchHistory(cm, query) {
      getSearchHistory(cm).add(query);
    } // function addToSearchHistory()

    // tracks search history
    cm.on("searchEntered", addToSearchHistory);
    cm.on("replaceEntered", addToSearchHistory);

    // add auto complete by search history to search dialog
    cm.on("searchDialog", setupDialogAutoComplete);
  } // function extendSearchWithAutoComplete(..)

  
  //
  // the exports
  // TODO: Consider provide a CodeMirror option search: {autoComplete: true} instead
  // 
  CodeMirror.extendSearchWithAutoComplete = extendSearchWithAutoComplete;
  
});
