// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var ParseHexFile = require("./hexparser.js").ParseHexFile;
var logging = require("./logging.js");
var stk500 = require("./stk500.js");
var avr109 = require("./avr109.js");
var binary = require("./binary.js");

var hexToBin = binary.hexToBin;
var binToHex = binary.binToHex;
var log = logging.log;
var kDebugError = logging.kDebugError;
var kDebugNormal = logging.kDebugNormal;
var kDebugFine = logging.kDebugFine;
var kDebugVeryFine = logging.kDebugVeryFine;

// API
//
// uploadCompiledSketch(parseHexfile(filename), serialportname) ??

function Uploader() {

}

Uploader.prototype.uploadSketch = function(deviceName, protocol, sketchUrl) {
  var uploader = this;
  var u2 = sketchUrl + "?bustcache=" + (new Date().getTime());
  log(kDebugNormal, "Uploading blink sketch from: " + u2);

  this.fetchProgram_(u2, function(programBytes) { 
    log(kDebugFine, "Fetched program. Uploading to: " + deviceName);
    log(kDebugFine, "Protocol: " + protocol);
    uploader.uploadCompiledSketch_(programBytes, deviceName, protocol);
  });
}


//
// IMPLEMENTATION
//
Uploader.prototype.fetchProgram_ = function(url, handler) {
  log(kDebugFine, "Fetching: " + url)
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        var programBytes = ParseHexFile(xhr.responseText);
        log(kDebugFine, "Fetched Data:\n" + xhr.responseText);
//        log(kDebugFine, "Program Data: " + xhr.responseText.substring(0,25) + "...");
        handler(programBytes);
      } else {
        log(kDebugError, "Bad fetch: " + xhr.status);
      }
    }
  };
  xhr.open("GET", url, true);
  xhr.send();
}

function pad(data, pageSize) {
  while (data.length % pageSize != 0) {
    data.push(0);
  }
  return data;
}

Uploader.prototype.uploadCompiledSketch_ = function(hexData, deviceName, protocol) {
  if (protocol == "stk500") {
    var boardObj = stk500.NewStk500Board(chrome.serial, 128);
    if (!boardObj.status.ok()) {
      log(kDebugError, "Couldn't create STK500 Board: " + boardObj.status.toString());
      return;
    }
    var board = boardObj.board;

    board.connect(deviceName, function(status) {
      if (status.ok()) {
        log(kDebugNormal, "STK500: connected.");
        board.writeFlash(0, pad(hexData, 128), function(status) {
          log(kDebugNormal, "STK programming status: " + status.toString());
        });
      } else {
        log(kDebugNormal, "STK: connection error: " + status.toString());
      }
    });
  } else if (protocol == "avr109") {
    var boardObj = avr109.NewAvr109Board(chrome.serial, 128);
    if (!boardObj.status.ok()) {
      log(kDebugError, "Couldn't create AVR109 Board: " + boardObj.status.toString());
      return;
    }
    var board = boardObj.board;
    board.connect(deviceName, function(status) {
      if (status.ok()) {
        log(kDebugNormal, "AVR109 Connected. Writing flash!");
        board.writeFlash(0, pad(hexData, 128), function(status) {
          log(kDebugNormal, "AVR programming status: " + status.toString());
        });
      } else {
        log(kDebugNormal, "AVR connection error: " + status.toString());
      }
    });

  } else {
    log(kDebugError, "Unknown protocol: "  + protocol);
  }
}

exports.pad = pad;
exports.Uploader = Uploader;
