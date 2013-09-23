var kDebugError = 0;
var kDebugNormal = 1;
var kDebugFine = 2;

var visibleLevel = kDebugFine;
var consoleLevel = kDebugFine;

function timestampString() {
  var now = new Date();
  var pad = function(n) {
    if (n < 10) { return "0" + n; }
    return n;
  }
  return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds()) + "." + now.getMilliseconds();
}

function visibleLog(message) {
  document.getElementById(ids.statusText).innerHTML =
    "[" + timestampString() + "] " + message + 
    "<br/>" + document.getElementById(ids.statusText).innerHTML;
}

function consoleLog(message) {
  console.log(message);
  if (chrome.extension.getBackgroundPage()) {
    chrome.extension.getBackgroundPage().log(message);
  }
}

function log(level, message) {
  if (level <= consoleLevel) {
    console.log(message);
  }
  if (level <= visibleLevel) {
    visibleLog(message);
  }
}
