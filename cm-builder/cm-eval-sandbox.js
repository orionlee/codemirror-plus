      // Set up message event handler.
      //  Defining all methods / listener in an anonymous function 
      //  executed upon DOMContentLoaded
      //  to avoid polluting the sandbox namespace 
      //  (which will run arbitrary code)
      window.addEventListener('DOMContentLoaded', function() {
        
        function getMatchedSrc(src, stackLine) {
          var posMatch = stackLine.match(/(\d+):(\d+)[)]?$/);
          if (posMatch) {
            var lineN = parseInt(posMatch[1], 10), 
                colN = parseInt(posMatch[2], 10);
            
            // split line, count empty line as a line too.
            var srcLines = src.match((/.*(\n|\r|\n\r|\r\n)?/g)).map(function(l) { 
              return l.replace(/[\n\r]*$/, ''); 
            }); 
            
            
            var res = srcLines[lineN - 1];
            // print a line to indicate matching column
            res += '\n';
            for(var i = 0; i < colN - 1; i++) {
              res += ' ';
            }
            res += '^';
            
            return res;
            
          } else {
            console.warn('getMatchedSrc(): cannot parse line column from stack line: ', stackLine);
            return;
          }
        } // function getMatchedSrc(..)
        
        function makeUserFriendlyStack(stack, src) {
          var lines = stack.split(/[\n\r]+/);
          
          var firstStackLine;         
          var newStack = lines[0]; // OPEN: should we include the first line?! , if we don't, need to handle edge case where there are only two lines. since we skip the last line
          for (var i = 1; i < lines.length - 1; i++) {
            var line = lines[i];
            if (i == 1) {
              firstStackLine = lines[i];
            }
            // match pattern of
            //   at eval (eval at <anonymous> (chrome-extension://hneablcelipadealmebgomejjmllfphg/cm-builder/cm-eval-sandbox.html:23:43), <anonymous>:6:3)
            //  (developer only cares about the end)
            line = line.replace(/^(\s*at\s+[^\s]+).*(<anonymous>:.+)[)]?$/, '$1 $2');
            newStack += ('\n' + line);
          }
          // skip the last line,  in the pattern of 
          //   at chrome-extension://hneablcelipadealmebgomejjmllfphg/cm-builder/cm-eval-sandbox.html:23:28"
          
          var matchedSrc;
          if (firstStackLine) {
            matchedSrc = getMatchedSrc(src, firstStackLine);
          }
          
          var res = {stack: newStack,
                     matchedSrc: matchedSrc
                    };          
          return res;
        } // function makeUserFriendlyStack(..)
        
        function serializeError(err, src) {
          var res = {};
          res.message = err.message;
          res.name = err.name || err.constructor.name || '';
          
          var fstack = makeUserFriendlyStack(err.stack, src);
          res.stack = fstack.stack;
          res.matchedSrc = fstack.matchedSrc;
          
          res.stackOrig = err.stack;
          
          res.isSerializedError = true;
          return res;
        } // function serializeError(..)
        
        window.addEventListener('message', function(event) {
          ///console.debug('sandbox on message: event:%o', event);
          ///window._event = event;
          console.assert('eval' === event.data.command, 
                         'sandbox onmessage(); unsupported command ', event.data.command);
          
          var message = {};
          try {
            message.src = event.data.src;
            message.result = eval(event.data.src);
          } catch (err) {
            message.error = serializeError(err, event.data.src);
            
            ///console.debug('sandbox on message: eval resulted in failure:\n%o', err.stack);
            ///_err = err;
          } finally {
            try {
              event.source.postMessage(message, event.origin);
            } catch (err) {
              try {
                if (err.name === 'DataCloneError') {
                  // case message.result cannot be serialized, e.g., a function
                  // try to a string representation the result
                  console.warn('sandbox eval(): message.result cannot be serialized, e.g., a function. Return the string representation instead.');
                  message.result = message.result.toString()
                  event.source.postMessage(message, event.origin);
                } else {
                  console.error('sandbox eval(): ' 
                                + 'Internal error in trying to post the result back as a message. '  
                                + 'Send an internal error message. '
                                + 'Error: %o\n%s', err, err.stack);
                  event.source.postMessage({error: {name: 'Error', 
                                                    message: 'Internal Error in sending the result back'}
                                           }, event.origin);
                } // if (err.name === 'DataCloneError') ...
              } catch (errFatal) {
                console.error('sandbox eval(): Attempts to recover from postMessage error fail. Cannot notify the user about the error. ' 
                              + 'Error: %o\n%s', err, err.stack);
                // attempts to recover from the error and sending a subsequent message fail. 
              }
            } // catch(err)
          }        
        });
      }); // window.addEventListener('DOMContentLoaded', ...
