(function() {
  var DEFAULT_BRACKETS = "()[]{}''\"\"";

  CodeMirror.defineOption("autoCloseBrackets", false, function(cm, val, old) {
    var wasOn = old && old != CodeMirror.Init;
    if (val && !wasOn)
      cm.addKeyMap(buildKeymap(typeof val == "string" ? val : DEFAULT_BRACKETS));
    else if (!val && wasOn)
      cm.removeKeyMap("autoCloseBrackets");
  });

  function buildKeymap(pairs) {
    var map = {name : "autoCloseBrackets"};
    for (var i = 0; i < pairs.length; i += 2) (function(left, right) {
      function maybeOverwrite(cm) {
        var cur = cm.getCursor(), ahead = cm.getRange(cur, CodeMirror.Pos(cur.line, cur.ch + 1));
        if (ahead != right) return CodeMirror.Pass;
        else cm.execCommand("goCharRight");
      }

      // new function, state used by PATCH      
      var rightBrackets = (function(pairs) {
        var res = [];
        for (var i = 1; i < pairs.length; i+= 2) {
          if (pairs[i] != pairs[i-1]) {
            res.push(pairs[i]);
          }
        }
        return res;
      })(pairs); // rightBrackets = (function(..)
      
      function shouldAddRightBracket(cm) {
        var cur = cm.getCursor(), ahead = cm.getRange(cur, CodeMirror.Pos(cur.line, cur.ch + 1));
        return (ahead === ' ' || ahead === '' || ahead === ';' || rightBrackets.indexOf(ahead) >= 0);
      } // function shouldAddRightBracket(..)

      map["'" + left + "'"] = function(cm) {
        if (left == right && maybeOverwrite(cm) != CodeMirror.Pass) return;

        // BEGIN PATCH for brackets, don't end bracket if there is something ahead
        // this is to address a common case: the user is trying to bracket some existing text, e.g.
        // -  abc(foo
        //       ^add only the left bracket, the right bracket will be counter-productive
        // In contrast, we preserve adding both left-and-right for the following cases
        // -  abc()
        //       ^end of line
        // -  reduce(function())
        //                   ^ ahead is a right bracket, typical case when typing a func as a parameter
        // -  abc();
        //       ^right before semi-colon, where is still end of line
        if (left != right && !shouldAddRightBracket(cm)) {
          return CodeMirror.Pass; 
        }
        // END PATCH

        var cur = cm.getCursor("start"), ahead = CodeMirror.Pos(cur.line, cur.ch + 1);
        cm.replaceSelection(left + right, {head: ahead, anchor: ahead});
      };
      if (left != right) map["'" + right + "'"] = maybeOverwrite;
    })(pairs.charAt(i), pairs.charAt(i + 1));
    return map;
  }
})();
console.debug('Hacked closebrackets running');