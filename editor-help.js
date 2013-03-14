function initHelpUI(doc, cm) {
  doc.getElementById('help').onclick = function() {  
    var help = doc.getElementById('_helpDiv');
    if ('none' == help.style.display) {
      help.style.display = 'block';
    } else {
      help.style.display = 'none';
    }
  };
  
  
  function genKeyBindingsDocs(cm) {    
    var lines = []; // actual bindings doc, to be concated
  
    var lineTmpl = '<dt>_KEY</dt><dd>_VAL</dd>';
    
    var curKeyMap = CodeMirror.keyMap[cm.options.keyMap];
    var k, line;
    for (k in curKeyMap) { 
      if( 'fallthrough' == k ) {
        continue;
      }
      line = lineTmpl.replace('_KEY', k).replace('_VAL', curKeyMap[k].toString());
      lines.push(line); 
    }
  
    var extraKeys = cm.options.extraKeys;
    for (k in extraKeys) { 
      // for bindings that are FunctionChainDecorator (which has an opt. functionName() )
      // the treatment here allows them to be displayed in a more friendly wa
      var desc = ( extraKeys[k].functionName ? 
                     extraKeys[k].functionName() : extraKeys[k].toString() );
      line = lineTmpl.replace('_KEY', k).replace('_VAL', desc);
      lines.push(line); 
    }
  
    var resHtmlTmpl = '<dl>\n_BODY\n</dl>';
    var resHtml = resHtmlTmpl.replace('_BODY', lines.join('\n  '));
    return resHtml;                                                   
  }
  
  function renderKeyBindingsDocs(divId) {
    var div = doc.getElementById(divId);
    if (div && !div.innerHTML) {
      div.innerHTML = genKeyBindingsDocs(cm);
    }
  }
  
  doc.getElementById("_ctl_keybindings").onclick = function(event) {
    renderKeyBindingsDocs('_keybindings'); 
    this.style.display='none';
  };
  
  
  function genCommandsDocs(cm) {    
    var lines = []; // actual bindings doc, to be concated
  
    var lineTmpl = '<dd>_KEY</dd>';
    
    for (var k in CodeMirror.commands) { 
      var line = lineTmpl.replace('_KEY', k);
      lines.push(line); 
    }
  
    var resHtmlTmpl = '<dl>\n<dt>List of commands:</dt>\n  _BODY\n</dl>';
    var resHtml = resHtmlTmpl.replace('_BODY', lines.join('\n  '));
    return resHtml;                                                   
  }
  
  
  function renderCommandsDocs(divId) {
    var div = doc.getElementById(divId);
    if (div && !div.innerHTML) {
      div.innerHTML = genCommandsDocs(cm);
    }
  }
  
  doc.getElementById("_ctl_commands").onclick = function(event) {
    renderCommandsDocs('_commands'); 
    this.style.display='none';
  };
  
} // function initHelpUI
  