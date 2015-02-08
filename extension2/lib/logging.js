var kDebugError = 0;
var kDebugNormal = 1;
var kDebugFine = 2;
var kDebugVeryFine = 3;

var visibleLevel = kDebugNormal;
var consoleLevel = kDebugVeryFine;

var visibleLoggingDiv_ = "";

function configureVisibleLogging(divName) {
  visibleLoggingDiv_ = divName;
}

function timestampString() {
  var now = new Date();
  var pad = function(n) {
    if (n < 10) { return "0" + n; }
    return n;
  }
  return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds()) + "." + now.getMilliseconds();
}

function visibleLog(message) {
  if (visibleLoggingDiv_ != "") {
    document.getElementById(visibleLoggingDiv_).innerHTML =
      "[" + timestampString() + "] " + message + 
      "<br/>" + document.getElementById(visibleLoggingDiv_).innerHTML;
  }
}

function consoleLog(message) {
  console.log(message);
  if (chrome.extension.getBackgroundPage()) {
    chrome.extension.getBackgroundPage().log(message);
  }
}

function setConsoleLogLevel(level) {
  consoleLevel = level;
}

function setVisibleLogLevel(level) {
  visibleLevel = level;
}

function log(level, message) {
  if (level <= consoleLevel) {
    console.log(message);
  }
  if (level <= visibleLevel) {
    visibleLog(message);
  }
}

exports.log = log;
exports.kDebugError = kDebugError;
exports.kDebugNormal = kDebugNormal;
exports.kDebugFine = kDebugFine;
exports.kDebugVeryFine = kDebugVeryFine;
exports.setVisibleLogLevel = setVisibleLogLevel;
exports.setConsoleLogLevel = setConsoleLogLevel;
exports.configureVisibleLogging = configureVisibleLogging;
