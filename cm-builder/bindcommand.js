/**
 * Utility to bind a CodeMirror command function, of the form function(cm) ,
 * to CodeMirror (class) with a given name, and optionally bind the command 
 * to given instance with given keys.
 * 
 * In particular, it also supports chaining of a command to a keybinding. E.g.,
 * in htmlmixed environment, javascript autocomplete and css autocomplete can
 * both be bound to the samle key (Ctrl-Space). 
 * In such case, they will be chained and invoked.
 * 
 */ 
function bindCommand(cm, cmdName, opts, cmdFunc) {

  function bindExtraKey(keyName) {
    // conflictsOnKey possible values: 
    //  replace (default), chain
    //  Possible to support noop
    if (opts.conflictsOnKey == 'chain') {
      var oldFunc = cm.options.extraKeys[keyName];
      if (oldFunc && typeof oldFunc == 'string') {
        // handle cases where original binding is indirectly to CodeMirror.commands 
        oldFunc = CodeMirror.commands[oldFunc]; 
      }
      cm.options.extraKeys[keyName] = 
        FunctionChainDecorator.createOrAdd(oldFunc, 
        cmdFunc, opts.chainName );
    } else { // replace (default) 
      cm.options.extraKeys[keyName] = cmdName;
    }    
  } // function bindExtraKey(..)
  
  // Possible to support chaining on existing command
  CodeMirror.commands[cmdName] = cmdFunc;

  if (opts.keyName) {
    if (opts.keyName instanceof Array) {
      opts.keyName.forEach(function (k) {
        bindExtraKey(k);
      });      
    } else { // normal case, single key
      bindExtraKey(opts.keyName);
    }
  }
  
  if (opts.eventName) {
    cm.on(opts.eventName, cmdFunc);      
  }
  
} // function bindCommand()
