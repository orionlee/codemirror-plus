/**

Purpose:
  Chain a set of functions (typically some listener) so that they can behave as if it is one instance.
  Used 

Examples:
// Support chaining 
codeFold4HtmlMixed = FunctionChainDecorator.createInstance(CodeMirror.commands.codeFold4Js).addFunction(CodeMirror.commands.codeFold4Html);

// bind multiple functions to single key by the decorator
var editor = _codeEditState.editor;
editor.options.extraKeys["Ctrl-Q"] = undefined;

editor.options.extraKeys["Ctrl-Q"] = 
  FunctionChainDecorator.createOrAdd(editor.options.extraKeys["Ctrl-Q"], CodeMirror.commands.codeFold4Js);

editor.options.extraKeys["Ctrl-Q"] = 
  FunctionChainDecorator.createOrAdd(editor.options.extraKeys["Ctrl-Q"], CodeMirror.commands.codeFold4Html);

editor.options.extraKeys["Ctrl-Q"](editor);

editor = undefined;

 **/

function FunctionChainDecorator() {
  throw new Error("FunctionChainDecorator() not meant to be invoked. Use the helpers in its members");
} 

FunctionChainDecorator.createInstance = function(func, name) {
  var decorator = function() {
    var thisFunc = arguments.callee;
    var res;  
    for(var i = 0; i < thisFunc._funcChain_.length; i++) {
      var funcName = thisFunc._funcChain_[i].name || thisFunc._funcChain_[i] ;
      /// console.debug('FuncChain: %O\t%O', funcName, arguments);
      res = thisFunc._funcChain_[i].apply(null, arguments);
    }
    return res;
  };
  
  // public chain maintenance methods
  decorator.addFunction  = function(funcToAdd) {
    if (funcToAdd && typeof funcToAdd == 'function' ) {
      decorator._funcChain_.push(funcToAdd);
    } else {
      throw new TypeError('Incorrect type for funcToAdd: ' + funcToAdd);
    }
    return decorator;
  };

  decorator.functionName = function() {
    return (decorator._funcName_ + '[' + decorator._funcChain_.length + ']');
  }

  // private states
  decorator._funcChain_ = [];
  decorator._funcName_ = name || '(FunctionChainDecorator)'
  
  decorator.addFunction(func);
  
  return decorator;
};

FunctionChainDecorator.createOrAdd = function(funcExisting, funcToAdd, name) {
  var res;
  if (!funcExisting) {
    // base case: only one func exists, no need to chain
    res = funcToAdd; 
  } else if (typeof funcExisting.addFunction == 'function') {
    res = funcExisting.addFunction(funcToAdd);
  } else {
    res = FunctionChainDecorator.createInstance(funcExisting, name);
    res.addFunction(funcToAdd);  
  }
  return res;
};
