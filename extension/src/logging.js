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
  var pad = function(n, width) {
    var acc = n;
    while (n < Math.pow(10, width - 1)) {
      acc = "0" + acc;
      width = width - 1;
    }
    return acc;
  }
  return pad(now.getHours(), 2) + ":" + pad(now.getMinutes(), 2) + ":" + pad(now.getSeconds(), 2) + "." + pad(now.getMilliseconds(), 3);
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
