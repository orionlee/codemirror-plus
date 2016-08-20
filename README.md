# CMACS

####   A Chrome app local code editor based on [CodeMirror](http://codemirror.net/), inspired by emACS.

Pre-configured to be lightweight, feature-rich for HTML/CSS/Javascript development, such as code-completion, code folding, brackets/tag completion, Javascript linting, etc. It also supports numerous other programming languages.

CMACS is inspired by Emacs, in that the interface is barebone. It also has a few Emacs-like features:

* Entering (CodeMirror) commands by Alt-X, aka Emacs M-x .
* Evaluate Javascript (in a sandbox) by Alt-E .
* Completion with nearby words by Ctrl-/, aka Emacs dabbrev-expand .
  * Note: it compliments the default language-specific autocomplete Ctrl-Space.
* Key Bindings, however, are not Emacs-like. CodeMirror does come with a emacs key bindings package that somewhat approximate the bindings. See [Ymacs](http://www.ymacs.org/) if you are looking for a closer clone.

The code base is derived from [Mini Code Edit](https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/mini-code-edit) Google Chrome sample app.

It is being refactored so that it can be ported / reused in other environment.

## Getting Started for developers

* Clone the repository to a local directory, e.g., c:\cmacs .
* In the directory, type "npm install" to get dependent libraries.
* In your Chrome Browser, go to chrome://extensions/ .
  * Click Developer mode if not yet done.
  * Click "Load unpacked extension...", and point to the above directory.
* If you want to use your own version of dependent libraries such as CodeMirror, use [npm link](https://docs.npmjs.com/cli/link).
