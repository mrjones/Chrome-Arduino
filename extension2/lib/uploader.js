var SerialDispatcher = require("./serialdispatcher.js").SerialDispatcher;
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

var STK_OK = 0x10;
var STK_INSYNC = 0x14;

var STK_CRC_EOP = 0x20;

var STK_GET_SYNC = 0x30;
var STK_GET_PARAMETER = 0x41;
var STK_ENTER_PROGMODE = 0x50;
var STK_LEAVE_PROGMODE = 0x51;
var STK_LOAD_ADDRESS = 0x55;
var STK_PROG_PAGE = 0x64;
var STK_READ_SIGN = 0x75;

var STK_HW_VER = 0x80;
var STK_SW_VER_MAJOR = 0x81;
var STK_SW_VER_MINOR = 0x82;

////

var databuffer = { };

var globalDispatcher = new SerialDispatcher();
if (typeof(chrome) != "undefined" &&
    typeof(chrome.serial) != "undefined") {
  // Don't want to do this in unit tests
  // TODO: make this a little more elegant?
  log(kDebugNormal, "Initting global dispatcher");
  chrome.serial.onReceive.addListener(
    globalDispatcher.dispatch.bind(globalDispatcher));

  chrome.serial.onReceiveError.addListener(
    function(errorInfo) {
      console.log("ERROR: " + JSON.stringify(errorInfo));
    });

  chrome.serial.onReceive.addListener(
    function(errorInfo) {
      console.log("READ: " + JSON.stringify(errorInfo));
    });
}

function readToBuffer(readArg) {
  log(kDebugFine, "READ TO BUFFER:" + JSON.stringify(readArg));
  if (typeof(databuffer[readArg.connectionId]) == "undefined") {
    log(kDebugFine, "Constructed buffer for: " + readArg.connectionId);
    databuffer[readArg.connectionId] = [];
  }

  var hexData = binToHex(readArg.data);

  log(kDebugFine, "Pushing " + hexData.length + " bytes onto buffer for: " + readArg.connectionId + " " + hexData);
  for (var i = 0; i < hexData.length; ++i) {
//    log(kDebugFine, i);
    databuffer[readArg.connectionId].push(hexData[i]);
  }
  log(kDebugFine, "Buffer for " + readArg.connectionId + " now of size " + databuffer[readArg.connectionId].length);
}

function readFromBuffer(connectionId, maxBytes, callback) {
  if (typeof(databuffer[connectionId]) == "undefined") {
    log(kDebugFine, "No buffer for: " + connectionId);
    callback({bytesRead: 0, data: []});
    return;
  }

  var bytes = Math.min(maxBytes, databuffer[connectionId].length);
  log(kDebugFine, "Reading " + bytes + " from buffer for " + connectionId);

  var accum = [];
  for (var i = 0; i < bytes; ++i) {
    accum.push(databuffer[connectionId].shift());
  }

  log(kDebugFine, "readFromBuffer -> " + binToHex(accum));

  callback({bytesRead: bytes, data: accum});
}

// TODO: board and prototocol should be separate variables
function uploadSketch(deviceName, protocol, sketchUrl) {
  log(kDebugNormal, "Uploading blink sketch from: " + sketchUrl);
  var hexfile = sketchUrl;
  if (protocol == 'avr109' || protocol == 'avr109_beta') {
    //
    hexfile = 'http://linode.mrjon.es/blink-micro.hex?bustcache=' + (new Date().getTime());
  }

  fetchProgram(hexfile, function(programBytes) { 
    log(kDebugFine, "Fetched program. Uploading to: " + deviceName);
    log(kDebugFine, "Protocol: " + protocol);
    uploadCompiledSketch(programBytes, deviceName, protocol);
  });
}

function fetchProgram(url, handler) {
  log(kDebugFine, "Fetching: " + url)
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        var programBytes = ParseHexFile(xhr.responseText);
        log(kDebugFine, "Program Data: " + xhr.responseText.substring(0,25) + "...");
        handler(programBytes);
      } else {
        log(kDebugError, "Bad fetch: " + xhr.status);
      }
    }
  };
  xhr.open("GET", url, true);
  xhr.send();
}

var sketchData_;
var inSync_ = false;

function pad(data, pageSize) {
  while (data.length % pageSize != 0) {
    data.push(0);
  }
  return data;
}

function uploadCompiledSketch(hexData, deviceName, protocol) {
  sketchData_ = hexData;
  inSync_ = false;
  if (protocol != "avr109_beta" && protocol != "stk500_beta") {
    chrome.serial.onReceive.addListener(readToBuffer);
  }
  if (protocol == "stk500") {
    chrome.serial.connect(deviceName, { bitrate: 115200 }, stkConnectDone);
  } else if (protocol == "stk500_beta") {
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
    // actually want tocheck that board is leonardo / micro / whatever
    kickLeonardoBootloader(deviceName);
  } else if (protocol == "avr109_beta") {
    var boardObj = avr109.NewAvr109Board(chrome.serial, 128, globalDispatcher);
    if (!boardObj.status.ok()) {
      log(kDebugError, "Couldn't create AVR109 Board: " + boardObj.status.toString());
      return;
    }
    var board = boardObj.board;
    board.connect(deviceName, function(status) {
      if (status.ok()) {
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


//
// Internal/implementation
// TODO(mrjones): move into an object/namespace.
//

// Reads a pre-specified number of bytes on the serial port.
//
// The message format expected is:
// STK_INSYNC, <specified number of bytes>, STK_OK
//
// Params:
// - connectionId: the serial connection ID to attempt to read from
// - payloadSize: the number of bytes to read between INSYNC and OK
// - callback: will be called after a read with three arguments:
//   1. int connectionId: the connection that the read was attempted on
//      (this will be the same as the connectionId input param).
//   2. boolean success: true iff a well-formed message was read
//   3. int[] accum: if success is 'true' the payload data read (not
//      including STK_INSYNC or STK_OK.
function stkConsumeMessage(connectionId, payloadSize, callback) {
  log(kDebugNormal, "stkConsumeMessage(conn=" + connectionId + ", payload_size=" + payloadSize + " ...)");
  var ReadState = {
    READY_FOR_IN_SYNC: 0,
    READY_FOR_PAYLOAD: 1,
    READY_FOR_OK: 2,
    DONE: 3,
    ERROR: 4,
  };

  var accum = [];
  var state = ReadState.READY_FOR_IN_SYNC;
  var kMaxReads = 100;
  var reads = 0;
  var payloadBytesConsumed = 0;

  var handleRead = function(arg) {
    if (reads++ >= kMaxReads) {
      log(kDebugError, "Too many reads. Bailing.");
      return;
    }
    var hexData = binToHex(arg.data);
    if (arg.bytesRead > 0) {
      log(kDebugFine, "[" + connectionId + "] Read: " + hexData);
    } else {
      log(kDebugFine, "No data read.");
    }
    for (var i = 0; i < hexData.length; ++i) {
      log(kDebugFine, "Byte " + i + " of " + hexData.length + ": " + hexData[i]);
      if (state == ReadState.READY_FOR_IN_SYNC) {
        if (hexData[i] == STK_INSYNC) {
          if (payloadSize == 0) {
            log(kDebugFine, "Got IN_SYNC, no payload, now READY_FOR_OK");
            state = ReadState.READY_FOR_OK;
          } else {
            log(kDebugFine, "Got IN_SYNC, now READY_FOR_PAYLOAD");
            state = ReadState.READY_FOR_PAYLOAD;
          }
        } else {
          log(kDebugError, "Expected STK_INSYNC (" + STK_INSYNC + "). Got: " + hexData[i] + ". Ignoring.");
//          state = ReadState.ERROR;
        }
      } else if (state == ReadState.READY_FOR_PAYLOAD) {
        accum.push(hexData[i]);
        payloadBytesConsumed++;
        if (payloadBytesConsumed == payloadSize) {
          log(kDebugFine, "Got full payload, now READY_FOR_OK");
          state = ReadState.READY_FOR_OK;
        } else if (payloadBytesConsumed > payloadSize) {
          log(kDebugFine, "Got too many payload bytes, now ERROR")
          state = ReadState.ERROR;
          log(kDebugError, "Read too many payload bytes!");
        }
      } else if (state == ReadState.READY_FOR_OK) {
        if (hexData[i] == STK_OK) {
          log(kDebugFine, "Got OK now DONE");
          state = ReadState.DONE;
        } else {
          log(kDebugError, "Expected STK_OK. Got: " + hexData[i]);
          state = ReadState.ERROR;
        }
      } else if (state == ReadState.DONE) {
        log(kDebugError, "Out of sync (ignoring data)");
        state = ReadState.ERROR;
      } else if (state == ReadState.ERROR) {
        log(kDebugError, "In error state. Draining byte: " + hexData[i]);
        // Remains in state ERROR
      } else {
        log(kDebugError, "Unknown state: " + state);
        state = ReadState.ERROR;
      }
    }

    if (state == ReadState.ERROR || state == ReadState.DONE) {
      log(kDebugFine, "Finished in state: " + state);
      callback(connectionId, state == ReadState.DONE, accum);
    } else {
      log(kDebugFine, "Paused in state: " + state + ". Reading again.");

      if (!inSync_ && (reads % 3) == 0) {
        // Mega hack (temporary)
        log(kDebugFine, "Mega Hack: Writing: " + hexRep([STK_GET_SYNC, STK_CRC_EOP]));
        chrome.serial.send(connectionId, hexToBin([STK_GET_SYNC, STK_CRC_EOP]), function() {
            readFromBuffer(connectionId, 1024, handleRead);
          });
      } else {
        // Don't tight-loop waiting for the message.
        setTimeout(function() {
          readFromBuffer(connectionId, 1024, handleRead);
        }, 10);
      }

    }
  };

  log(kDebugFine, "Scheduling a read in .1s");
  setTimeout(function() { readFromBuffer(connectionId, 1024, handleRead); }, 10);
}

function hexRep(intArray) {
  var buf = "[";
  var sep = "";
  for (var i = 0; i < intArray.length; ++i) {
    buf += (sep + "0x" + intArray[i].toString(16));
    sep = ",";
  }
  buf += "]";
  return buf;
}

// Write a message, and then wait for a reply on a given serial port.
//
// Params:
// - int connectionId: the ID of the serial connection to read and write on
// - int[] outgoingMsg: the data to write on the serial connection. Each entry
//   represents one byte, so ints must be in the range [0-255]. This currently
//   does not append an STK_CRC_EOP at the end of a message, so callers must
//   be sure to include it.
// - int responsePayloadSize: The number of bytes expected in the response
//   message, not including STK_INSYNC or STK_OK (see 
//   'stkConsumeMessage()').
// - callback: See 'callback' in 'stkConsumeMessage()'.
//   
// TODO(mrjones): consider setting STK_CRC_EOP automatically?
function stkWriteThenRead(connectionId, outgoingMsg, responsePayloadSize, callback) {
  log(kDebugNormal, "[" + connectionId + "] Writing: " + hexRep(outgoingMsg));
  var outgoingBinary = hexToBin(outgoingMsg);
  // schedule a read in 100ms
  chrome.serial.send(connectionId, outgoingBinary, function(writeArg) {
      stkConsumeMessage(connectionId, responsePayloadSize, callback);
    });
}

function stkConnectDone(connectArg) {
  if (typeof(connectArg) == "undefined" ||
      typeof(connectArg.connectionId) == "undefined" ||
      connectArg.connectionId == -1) {
    log(kDebugError, "Bad connectionId / Couldn't connect to board");
    return;
  }

  log(kDebugFine, "Connected to board. ID: " + connectArg.connectionId);


  readFromBuffer(connectArg.connectionId, 1024, function(readArg) {
    stkDrainedBytes(readArg, connectArg.connectionId);
  });
};

function stkDtrSent(ok, connectionId) {
  if (!ok) {
    log(kDebugError, "Couldn't send DTR");
    return;
  }
  log(kDebugFine, "DTR sent (low) real good");

  readFromBuffer(connectionId, 1024, function(readArg) {
      stkDrainedAgain(readArg, connectionId);
    });
 
}

function stkDrainedAgain(readArg, connectionId) {
  log(kDebugError, "DRAINED " + readArg.bytesRead + " BYTES");
  if (readArg.bytesRead == 1024) {
    // keep draining
    readFromBuffer(connectionId, 1024, function(readArg) {
        stkDrainedBytes(readArg, connectionId);
      });
  } else {
    // Start the protocol
    setTimeout(function() { stkWriteThenRead(connectionId, [STK_GET_SYNC, STK_CRC_EOP], 0, stkInSyncWithBoard); }, 50);
  }

}

function stkDrainedBytes(readArg, connectionId) {
  log(kDebugError, "DRAINED " + readArg.bytesRead + " BYTES");
  if (readArg.bytesRead == 1024) {
    // keep draining
    readFromBuffer(connectionId, 1024, function(readArg) {
        stkDrainedBytes(readArg, connectionId);
      });
  } else {
    log(kDebugFine, "About to set DTR low");
    
    setTimeout(function() {
      chrome.serial.setControlSignals(connectionId, {dtr: false, rts: false}, function(ok) {
        log(kDebugNormal, "sent dtr false, done: " + ok);
        setTimeout(function() {
          chrome.serial.setControlSignals(connectionId, {dtr: true, rts: true}, function(ok) {
            log(kDebugNormal, "sent dtr true, done: " + ok);
            setTimeout(function() { stkDtrSent(ok, connectionId); }, 10);
          });
        }, 250);
      });
    }, 250);
  }
}

function stkInSyncWithBoard(connectionId, ok, data) {
  if (!ok) {
    log(kDebugError, "InSyncWithBoard: NOT OK");
  }
  log(kDebugNormal, "InSyncWithBoard: " + ok + " / " + data);
  inSync_ = true;
  stkWriteThenRead(connectionId, [STK_GET_PARAMETER, STK_HW_VER, STK_CRC_EOP], 1, stkReadHardwareVersion);
}

function stkReadHardwareVersion(connectionId, ok, data) {
  log(kDebugFine, "HardwareVersion: " + ok + " / " + data);
  stkWriteThenRead(connectionId, [STK_GET_PARAMETER, STK_SW_VER_MAJOR, STK_CRC_EOP], 1, stkReadSoftwareMajorVersion);
}

function stkReadSoftwareMajorVersion(connectionId, ok, data) {
  log(kDebugFine, "Software major version: " + ok + " / " + data);
  stkWriteThenRead(connectionId, [STK_GET_PARAMETER, STK_SW_VER_MINOR, STK_CRC_EOP], 1, stkReadSoftwareMinorVersion);
}

function stkReadSoftwareMinorVersion(connectionId, ok, data) {
  log(kDebugFine, "Software minor version: " + ok + " / " + data);
  stkWriteThenRead(connectionId, [STK_ENTER_PROGMODE, STK_CRC_EOP], 0, stkEnteredProgmode);
}

function stkEnteredProgmode(connectionId, ok, data) {
  log(kDebugNormal, "Entered progmode: " + ok + " / " + data);
  stkWriteThenRead(connectionId, [STK_READ_SIGN, STK_CRC_EOP], 3, stkReadSignature);  
}

function stkReadSignature(connectionId, ok, data) {
  log(kDebugFine, "Device signature: " + ok + " / " + data);

  stkProgramFlash(connectionId, sketchData_, 0, 128, stkDoneProgramming);
}

function stkDoneProgramming(connectionId) { 
  stkWriteThenRead(connectionId, [STK_LEAVE_PROGMODE, STK_CRC_EOP], 0, stkLeftProgmode); 
}

function stkLeftProgmode(connectionId, ok, data) {
  log(kDebugNormal, "Left progmode: " + ok + " / " + data);
}

function stkProgramFlash(connectionId, data, offset, length, doneCallback) {
  log(kDebugFine, "program flash: data.length: " + data.length + ", offset: " + offset + ", length: " + length);
  var payload;

  if (offset >= data.length) {
    log(kDebugNormal, "Done programming flash: " + offset + " vs. " + data.length);
    doneCallback(connectionId);
    return;
  }

  if (offset + length > data.length) {
    log(kDebugFine, "Grabbing " + length + " bytes would go past the end.");
    log(kDebugFine, "Grabbing bytes " + offset + " to " + data.length + " bytes would go past the end.");
    payload = data.slice(offset, data.length);
    var padSize = length - payload.length;
    log(kDebugFine, "Padding " + padSize + " 0 byte at the end");
    for (var i = 0; i < padSize; ++i) {
      payload.push(0);
    }
  } else {
    log(kDebugFine, "Grabbing bytes: " + offset + " until " + (offset + length));
    payload = data.slice(offset, offset + length);
  }

  var addressBytes = storeAsTwoBytes(offset / 2); // Word address, verify this
  var sizeBytes = storeAsTwoBytes(length);
  var kFlashMemoryType = 0x46;

  var loadAddressMessage = [
    STK_LOAD_ADDRESS, addressBytes[1], addressBytes[0], STK_CRC_EOP];
  var programMessage = [
    STK_PROG_PAGE, sizeBytes[0], sizeBytes[1], kFlashMemoryType];
  programMessage = programMessage.concat(payload);
  programMessage.push(STK_CRC_EOP);

  stkWriteThenRead(connectionId, loadAddressMessage, 0, function(connectionId, ok, reponse) {
      if (!ok) { log(kDebugError, "Error programming the flash (load address)"); return; }
      stkWriteThenRead(connectionId, programMessage, 0, function(connectionId, ok, response) {
          if (!ok) { log(kDebugError, "Error programming the flash (send data)"); return }
          // Program the next section
          stkProgramFlash(connectionId, data, offset + length, length, doneCallback);
        });
    });
}

function storeAsTwoBytes(n) {
  var lo = (n & 0x00FF);
  var hi = (n & 0xFF00) >> 8;
  return [hi, lo];
}

function stkWaitForSync(connectionId) {
  log(kDebugFine, "readying sync bit from: " + connectionId);
  var hex = [STK_GET_SYNC, STK_CRC_EOP];
  var data = hexToBin(hex);
  log(kDebugFine, "writing: " + hex + " -> " + data);
  chrome.serial.send(connectionId, data, function(arg) { checkSync(connectionId, arg) } );
}

function findMissingNeedlesInHaystack(needles, haystack) {
  var haystack2 = [];
  for (var i = 0; i < haystack.length; ++i) {
    haystack2.push(haystack[i].path);
  }

  var r = [];
  for (var i = 0; i < needles.length; ++i) {
    if (haystack2.indexOf(needles[i].path) == -1) {
      r.push(needles[i].path);
    }
  }

  return r;
}

function waitForNewDevice(oldDevices, deadline) {
  log(kDebugFine, "Waiting for new device...");
  if (new Date().getTime() > deadline) {
    log(kDebugError, "Exceeded deadline");
    return;
  }

  var found = false;
  chrome.serial.getDevices(function(newDevices) {
    var appeared = findMissingNeedlesInHaystack(newDevices, oldDevices);
    var disappeared = findMissingNeedlesInHaystack(oldDevices, newDevices);
 
    for (var i = 0; i < disappeared.length; ++i) {
      log(kDebugNormal, "Disappeared: " + disappeared[i]);
    }
    for (var i = 0; i < appeared.length; ++i) {
      log(kDebugNormal, "Appeared: " + appeared[i]);
    }

    if (appeared.length == 0) {
      setTimeout(function() { waitForNewDevice(newDevices, deadline); }, 100);
    } else {
      log(kDebugNormal, "Aha! Connecting to: " + appeared[0]);
      setTimeout(function() {
        chrome.serial.connect(appeared[0], { bitrate: 57600 }, avrConnectDone)}, 500);
    }
  });
}

function kickLeonardoBootloader(originalDeviceName) {
  log(kDebugNormal, "kickLeonardoBootloader(" + originalDeviceName + ")");
  var kMagicBaudRate = 1200;
  var oldDevices = [];
  chrome.serial.getDevices(function(devicesArg) {
    oldDevices = devicesArg;
    chrome.serial.connect(originalDeviceName, { bitrate: kMagicBaudRate }, function(connectArg) {
      log(kDebugNormal, "Made sentinel connection to " + originalDeviceName);
      chrome.serial.disconnect(connectArg.connectionId, function(disconnectArg) {
        log(kDebugNormal, "Disconnected from " + originalDeviceName);
        waitForNewDevice(oldDevices, (new Date().getTime()) + 10000);
//        setTimeout(function() {
//          chrome.serial.connect(originalDeviceName, { bitrate: 57600 }, avrConnectDone);
//        }, 300);
      });
    });
  });
}


function avrConnectDone(connectArg) {
  if (typeof(connectArg) == "undefined" ||
      typeof(connectArg.connectionId) == "undefined" ||
      connectArg.connectionId == -1) {
    log(kDebugError, "(AVR) Bad connectionId / Couldn't connect to board");
    return;
  }

  log(kDebugFine, "Connected to board. ID: " + connectArg.connectionId);

  readFromBuffer(connectArg.connectionId, 1024, function(readArg) {
    avrDrainedBytes(readArg, connectArg.connectionId);
  });
};

function avrWaitForBytes(connectionId, n, accum, deadline, callback) {
  if (new Date().getTime() > deadline) {
    log(kDebugError, "Deadline passed while waiting for " + n + " bytes");
    return;
  }
  log(kDebugNormal, "Waiting for " + n + " bytes");

  var handler = function(readArg) {
    var hexData = binToHex(readArg.data);
    for (var i = 0; i < hexData.length; ++i) {
      accum.push(hexData[i]);
      n--;
    }

    if (n < 0) {
      log(kDebugError, "Read too many bytes !?");
    } else if (n == 0) {
      log(kDebugFine, "Response: " + hexRep(accum));
      callback(connectionId, accum);
    } else { // still want more data 
      setTimeout(function() {
        avrWaitForBytes(connectionId, n, accum, deadline, callback);
      }, 50);
      // TODO: deadline?
    }
  }

  readFromBuffer(connectionId, n, handler);
}

var AVR = {
  SOFTWARE_VERSION: 0x56,
  ENTER_PROGRAM_MODE: 0x50,
  LEAVE_PROGRAM_MODE: 0x4c,
  SET_ADDRESS: 0x41,
  WRITE: 0x42, // TODO: WRITE_PAGE
  TYPE_FLASH: 0x46,
  EXIT_BOOTLOADER: 0x45,
  CR: 0x0D,
  READ_PAGE: 0x67,
};

function avrWriteThenRead(connectionId, writePayload, readSize, callback) {
  log(kDebugFine, "Writing: " + hexRep(writePayload) + " to " + connectionId);
  chrome.serial.send(connectionId, hexToBin(writePayload), function(writeARg) {
    avrWaitForBytes(connectionId, readSize, [], (new Date().getTime()) + 1000, callback);
  });
}

function avrGotVersion(connectionId, version) {
  log(kDebugNormal, "Got version: " + version);
  avrPrepareToProgramFlash(connectionId, sketchData_, avrProgrammingDone);
}

function avrEnterProgramMode(connectionId) {
  avrWriteThenRead(
    connectionId, [ AVR.ENTER_PROGRAM_MODE ], 1,
    function(connectionId, payload) {
      avrProgramFlash(connectionId, sketch_data_, 0, 128, avrProgrammingDone);
    });
}


function avrProgrammingDone(connectionId) {
  log(kDebugNormal, "avrProgrammingDone");
  avrWriteThenRead(connectionId, [ AVR.LEAVE_PROGRAM_MODE ], 1, function(connectionId, payload) {
    avrWriteThenRead(connectionId, [ AVR.EXIT_BOOTLOADER ], 1, function(connection, payload) {
      log(kDebugNormal, "ALL DONE");
    });
  });
}

function avrDrainedAgain(readArg, connectionId) {
  log(kDebugFine, "avrDrainedAgain({readarg}, " + connectionId);
  log(kDebugError, "DRAINED " + readArg.bytesRead + " BYTES");
  if (readArg.bytesRead == 1024) {
    // keep draining
    readFromBuffer(connectionId, 1024, function(readArg) {
        avrDrainedBytes(readArg, connectionId);
      });
  } else {
    // Start the protocol

    avrWriteThenRead(connectionId, [ AVR.SOFTWARE_VERSION ], 2, avrGotVersion);
  }
}

function avrDrainedBytes(readArg, connectionId) {
  log(kDebugError, "DRAINED " + readArg.bytesRead + " BYTES on " + connectionId);
  if (readArg.bytesRead == 1024) {
    // keep draining
    readFromBuffer(connectionId, 1024, function(readArg) {
      avrDrainedBytes(readArg, connectionId);
    });
  } else {
    setTimeout(function() { avrDtrSent(true, connectionId); }, 1000);
  }
}

function avrDtrSent(ok, connectionId) {
  if (!ok) {
    log(kDebugError, "Couldn't send DTR");
    return;
  }
  log(kDebugFine, "DTR sent (low) real good on connection: " + connectionId);
  
  readFromBuffer(connectionId, 1024, function(readArg) {
    avrDrainedAgain(readArg, connectionId);
  }); 
}
  
function avrPrepareToProgramFlash(connectionId, data, doneCallback) {
  var addressBytes = storeAsTwoBytes(0);

  var loadAddressMessage = [
    AVR.SET_ADDRESS, addressBytes[1], addressBytes[0] ];

  avrWriteThenRead(connectionId, loadAddressMessage, 1, function(connectionId, response) {
    avrProgramFlash(connectionId, data, 0, 128, avrProgrammingDone);
  });
}
    
function avrProgramFlash(connectionId, data, offset, length, doneCallback) {
  log(kDebugFine, "program flash: data.length: " + data.length + ", offset: " + offset + ", length: " + length);
  var payload;
 
  if (offset >= data.length) {
    log(kDebugNormal, "Done programming flash");
    doneCallback(connectionId);
    return;
  }

  if (offset + length > data.length) {
    log(kDebugFine, "Grabbing bytes " + offset + " to " +
        data.length + " bytes would go past the end.");
    payload = data.slice(offset, data.length);
    var padSize = length - payload.length;
    log(kDebugFine, "Padding " + padSize + " 0 byte at the end");
    for (var i = 0; i < padSize; ++i) {
      payload.push(0);
    }
  } else {
    log(kDebugFine, "Grabbing bytes: " + offset + " until " + (offset + length));
    payload = data.slice(offset, offset + length);
  }

  var sizeBytes = storeAsTwoBytes(length);
  var kFlashMemoryType = 0x46;

  

  var programMessage = [
    AVR.WRITE, sizeBytes[0], sizeBytes[1], AVR.TYPE_FLASH ];
  programMessage = programMessage.concat(payload);

  avrWriteThenRead(connectionId, programMessage, 1, function(connectionId, response) {
    avrProgramFlash(connectionId, data, offset + length, length, doneCallback);
  });

//  log(kDebugNormal, "Want to write: " + hexRep(loadAddressMessage));
//  log(kDebugNormal, "Then: " + hexRep(programMessage));

//  avrProgramFlash(connectionId, data, offset + length, length, doneCallback);
}

exports.pad = pad;
exports.uploadSketch = uploadSketch;
