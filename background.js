chrome.app.runtime.onLaunched.addListener(function(launchData) {
  // width 640 for font size 12
  //       720 for font size 14
  chrome.app.window.create('main.html', {
    frame: 'none', width: 900, height: 600,
    top: 40,
    left: 80
  },
  function(win) {
    win.contentWindow.launchData = launchData;
    win.contentWindow._dbgW = win;
  });
});
