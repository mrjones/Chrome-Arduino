var kDebugError = 0;
var kDebugNormal = 1;
var kDebugFine = 2;

var visibleLevel = kDebugFine;
var consoleLevel = kDebugFine;

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
