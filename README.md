# Local code editor based on CodeMirror

Pre-configured to be feature-rich for HTML/CSS/Javascript development, such as code-completion, code folding, brackets/tag completion, Javascript linting, etc.

It does, however, suffer some limitation due to restriction of chrome packaged app (mostly on file system access), including:

* unable to saving backup files
* re-opening recent files
* "save as" causing locking of the new files (untile entire chrome restarts)

## Original description

As seen in [Mini Code Edit](https://github.com/GoogleChrome/chrome-app-samples/tree/master/mini-code-edit) sample app: 

A non-trivial sample with basic features of a code editor, like syntax detection and syntax highlight. If also uses the extended FileSystem API that allows a user to select files from the disk so the app can read and write to that file.

## APIs

* [chrome.fileSystem](http://developer.chrome.com/trunk/apps/fileSystem.html)
* [Runtime](http://developer.chrome.com/trunk/apps/app.runtime.html)
* [Window](http://developer.chrome.com/trunk/apps/app.window.html)

