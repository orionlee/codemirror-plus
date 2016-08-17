// Define search commands. Depends on dialog.js or another
// implementation of the openDialog method.

// Replace works a little oddly -- it will do the replace on the next
// Ctrl-G (or whatever is bound to findNext) press. You prevent a
// replace by making sure the match is no longer selected when hitting
// Ctrl-G.

(function() {
  function searchOverlay(query) {
    if (typeof query == "string") return {token: function(stream) {
      if (stream.match(query)) return "searching";
      stream.next();
      stream.skipTo(query.charAt(0)) || stream.skipToEnd();
    }};
    return {token: function(stream) {
      if (stream.match(query)) return "searching";
      while (!stream.eol()) {
        stream.next();
        if (stream.match(query, false)) break;
      }
    }};
  }

  // BEGIN PATCH add search history feature
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
    return cm._searchHistory || (cm._searchHistory = new SearchHistory());
  }
  
  // END PATCH add search history feature

  // PATCH make changes in SearchState.query supports callback
  function SearchState() {
    this.posFrom = this.posTo = this._query = null;
    this.overlay = null;
    this.onQueryChange = null;
  }
  Object.defineProperty(SearchState.prototype, 'query', { 
    get: function() { return this._query; }, 
    set: function(val) { 
      this._query = val;
      if (this.onQueryChange) {
        this.onQueryChange({query: val});
      }
    }
  });
  // END PATCH make changes in SearchState.query supports callback
  
  function getSearchState(cm) {
    return cm._searchState || (cm._searchState = new SearchState());
  }
  function getSearchCursor(cm, query, pos) {
    // Heuristic: if the query string is all lowercase, do a case insensitive search.
    return cm.getSearchCursor(query, pos, typeof query == "string" && query == query.toLowerCase());
  }
  
  // PATCH search history
  function setupDialogAutoComplete(cm, inpId) {    
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
      if (event.ctrlKey === true && KeyboardEventUtl.codeEquals(event, "Space")) { 
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
    // the main setup logic: add keypress to the input box specified
    //
    var inpElt = document.getElementById(inpId);
    
    // use keydown event rather than keypress to handle some browser compatibility issue
    inpElt.onkeydown = autoCompleteSearchCmd;

  } // function setupDialogAutoComplete(..)
  
  function dialog(cm, text, shortText, f) {
    if (cm.openDialog) {      
      // PATCH search history
      if (text.match('inpId=""')) {
        var inpId = "ctl_search_" + Date.now();
        text = 
          text.replace('inpId=""', 'id="' + inpId + '"'); // add generated id for the inputbox
        cm.openDialog(text, f, { keepOpenOnBlur: true });
        setupDialogAutoComplete(cm, inpId);   
      } else {
        cm.openDialog(text, f);        
      }
    }
    else f(prompt(shortText, ""));
  }
  function confirmDialog(cm, text, shortText, fs) {
    if (cm.openConfirm) cm.openConfirm(text, fs);
    else if (confirm(shortText)) fs[0]();
  }
  function parseQuery(query) {
    var isRE = query.match(/^\/(.*)\/([a-z]*)$/);
    return isRE ? new RegExp(isRE[1], isRE[2].indexOf("i") == -1 ? "" : "i") : query;
  }
  var queryDialog =
    'Search: <input inpId="" type="text" style="width: 10em"/> <span style="color: #888">(Use /re/ syntax for regexp search. Ctrl-space to recall search history.)</span>';
  function doSearch(cm, rev) {
    var state = getSearchState(cm);
    if (state.query) return findNext(cm, rev);
    dialog(cm, queryDialog, "Search for:", function(query) {
      cm.operation(function() {
        if (!query || state.query) return;
        getSearchHistory(cm).add(query);
        state.query = parseQuery(query);
        cm.removeOverlay(state.overlay);
        state.overlay = searchOverlay(query);
        cm.addOverlay(state.overlay);
        state.posFrom = state.posTo = cm.getCursor();
        findNext(cm, rev);
      });
    });
  }
  function findNext(cm, rev) {cm.operation(function() {
    var state = getSearchState(cm);
    var cursor = getSearchCursor(cm, state.query, rev ? state.posFrom : state.posTo);
    if (!cursor.find(rev)) {
      cursor = getSearchCursor(cm, state.query, rev ? CodeMirror.Pos(cm.lastLine()) : CodeMirror.Pos(cm.firstLine(), 0));
      if (!cursor.find(rev)) return;
    }
    cm.setSelection(cursor.from(), cursor.to());
    state.posFrom = cursor.from(); state.posTo = cursor.to();
  });}
  function clearSearch(cm) {cm.operation(function() {
    var state = getSearchState(cm);
    if (!state.query) return;
    state.query = null;
    cm.removeOverlay(state.overlay);
  });}

  var replaceQueryDialog =
    'Replace: <input inpId="" type="text" style="width: 10em"/> <span style="color: #888">(Use /re/ syntax for regexp search.  Ctrl-space to recall search history.)</span>';
  var replaceAllQueryDialog = replaceQueryDialog.replace(/^Replace/, 'Replace all');
  var replacementQueryDialog = 'With: <input inpId="" type="text" style="width: 10em"/>';
  var doReplaceConfirm = "Replace? <button>Yes</button> <button>No</button> <button>Stop</button>";
  function replace(cm, all) {
    // PATCH change wording of replace all to make it clearer to user
    dialog(cm, (all ? replaceAllQueryDialog : replaceQueryDialog), "Replace:", function(query) {
      if (!query) return;
      getSearchHistory(cm).add(query);
      query = parseQuery(query);
      dialog(cm, replacementQueryDialog, "Replace with:", function(text) {
        getSearchHistory(cm).add(text); // replacment text also added to search history
        if (all) {
          cm.operation(function() {
            for (var cursor = getSearchCursor(cm, query); cursor.findNext();) {
              if (typeof query != "string") {
                var match = cm.getRange(cursor.from(), cursor.to()).match(query);
                cursor.replace(text.replace(/\$(\d)/, function(_, i) {return match[i];}));
              } else cursor.replace(text);
            }
          });
        } else {
          clearSearch(cm);
          var cursor = getSearchCursor(cm, query, cm.getCursor());
          var advance = function() {
            var start = cursor.from(), match;
            if (!(match = cursor.findNext())) {
              cursor = getSearchCursor(cm, query);
              if (!(match = cursor.findNext()) ||
                  (start && cursor.from().line == start.line && cursor.from().ch == start.ch)) return;
            }
            cm.setSelection(cursor.from(), cursor.to());
            confirmDialog(cm, doReplaceConfirm, "Replace?",
                          [function() {doReplace(match);}, advance]);
          };
          var doReplace = function(match) {
            cursor.replace(typeof query == "string" ? text :
                           text.replace(/\$(\d)/, function(_, i) {return match[i];}));
            advance();
          };
          advance();
        }
      });
    });
  }

  CodeMirror.commands.find = function(cm) {clearSearch(cm); doSearch(cm);};
  CodeMirror.commands.findNext = doSearch;
  CodeMirror.commands.findPrev = function(cm) {doSearch(cm, true);};
  CodeMirror.commands.clearSearch = clearSearch;
  CodeMirror.commands.replace = replace;
  CodeMirror.commands.replaceAll = function(cm) {replace(cm, true);};
})();
