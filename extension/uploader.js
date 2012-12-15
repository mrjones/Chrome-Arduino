// API
//
// uploadCompiledSketch(parseHexfile(filename), serialportname) ??

function consumeByteAnd(connectionId, callback) {
  chrome.serial.read(connectionId, 1, callback);
}

var STK_OK = 0x10;
var STK_INSYNC = 0x14;

var STK_CRC_EOP = 0x20;

var STK_GET_SYNC = 0x30;
var STK_GET_PARAMETER = 0x41;

var STK_HW_VER = 0x80;

////


function testUploader() {
  console.log("UPLOADER");
  parseHexfile('/blink-example.hex');
}

function parseHexfile(url) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      console.log(xhr.responseText);
      uploadCompiledSketch(xhr.responseText, "/dev/tty.usbserial-A800eJCe");
    }
  };
  xhr.open("GET", url, true);
  xhr.send();
}

function uploadCompiledSketch(hexData, serialPortName) {
  console.log("Uploading to: " + serialPortName);
  chrome.serial.open(serialPortName, { bitrate: 57600 }, uploadOpenDone2);
}

function uploadOpenDone(openArg) {
  if (openArg.connectionId == -1) {
    console.log("Couldn't connect to board");
    return;
  }
  drain(openArg.connectionId);
}

function drain(connectionId) {
  chrome.serial.read(connectionId, 1024, function(readArg) {
      console.log("DRAINED " + readArg.bytesRead + " BYTES");
      waitForSync(connectionId);
    });
}

////////////

// Consume from STK_INSYNC, until STK_OK

var ReadState = {
  WAITING_FOR_IN_SYNC: 0,
  CONSUMING_PAYLOAD: 1,
  DONE: 2,
  ERROR: 3,
};

function consumeMessage(connectionId, callback) {
  var accum = [];
  var state = ReadState.WAITING_FOR_IN_SYNC;
  var kMaxReads = 100;
  var reads = 0;

  var handleRead = function(arg) {
    if (reads++ >= kMaxReads) {
      console.log("Too many reads. Bailing.");
      return;
    }
    var hexData = binToHex(arg.data);
    if (arg.bytesRead > 0) {
      console.log("[" + connectionId + "] Read: " + hexData);
    }
    for (var i = 0; i < hexData.length; ++i) {
      if (state == ReadState.WAITING_FOR_IN_SYNC) {
        if (hexData[i] == STK_INSYNC) {
          state = ReadState.CONSUMING_PAYLOAD;
        } else {
          console.log("Expected STK_INSYNC. Got: " + hexData[i]);
          state = ReadState.ERROR;
        }
      } else if (state == ReadState.CONSUMING_PAYLOAD) {
        if (hexData[i] == STK_OK) {
          state = ReadState.DONE;
        } else {
          accum.push(hexData[i]);
          // Remains in state CONSUMING_PAYLOAD
        }
      } else if (state == ReadState.DONE) {
        console.log("Out of sync");
        state = ReadState.ERROR;
      } else if (state == ReadState.ERROR) {
        console.log("In error state. Draining byte: " + hexData[i]);
        // Remains in state ERROR
      } else {
        console.log("Unknown state: " + state);
        state = ReadState.ERROR;
      }
    }

    if (state == ReadState.ERROR || state == ReadState.DONE) {
      console.log("Finished in state: " + state);
      callback(connectionId, state == ReadState.DONE, accum);
    } else {
      console.log("Paused in state: " + state + ". Reading again.");

      // Mega hack (temporary)
      chrome.serial.write(connectionId, hexToBin([STK_GET_SYNC, STK_CRC_EOP]), function() { });

      // Don't tight-loop waiting for the message.
      setTimeout(function() { chrome.serial.read(connectionId, 1024, handleRead); }, 100);
    }
  };

  console.log("Scheduling a read in 1s");
  setTimeout(function() { chrome.serial.read(connectionId, 1024, handleRead); }, 1000);
//  chrome.serial.read(connectionId, 1024, handleRead);
}

function writeThenRead(connectionId, outgoingMsg, callback) {
  console.log("[" + connectionId + "] Writing: " + outgoingMsg);
  var outgoingBinary = hexToBin(outgoingMsg);
  // schedule a read in 100ms
  chrome.serial.write(connectionId, outgoingBinary, function(writeArg) {
      consumeMessage(connectionId, callback);
    });
}

function uploadOpenDone2(openArg) {
  if (openArg.connectionId == -1) {
    console.log("Couldn't connect to board");
    return;
  }

  chrome.serial.read(openArg.connectionId, 1024, function(readArg) {
      // Drain the connection
      console.log("DRAINED " + readArg.bytesRead + " BYTES");

      writeThenRead(openArg.connectionId, [STK_GET_SYNC, STK_CRC_EOP], inSyncWithBoard);
    });
}

function inSyncWithBoard(connectionId, ok, data) {
  console.log("InSyncWithBoard: " + ok + " / " + data);

  writeThenRead(connectionId, [STK_GET_PARAMETER, STK_HW_VER, STK_CRC_EOP], readHardwareVersion);
}

function readHardwareVersion(connectionId, ok, data) {
  console.log("ReadHardwareVersion: " + ok + " / " + data);
}

function waitForSync(connectionId) {
  console.log("readying sync bit from: " + connectionId);
  var hex = [STK_GET_SYNC, STK_CRC_EOP];
  var data = hexToBin(hex)
  console.log("writing: " + hex + " -> " + data);
  chrome.serial.write(connectionId, data, function(arg) { checkSync(connectionId, arg) } );
}

function checkSync(connectionId, sendArg) {
  setTimeout(function() {
      chrome.serial.read(connectionId, 1024, function(arg) {
          checkSyncReadDone(connectionId, arg);
        });
    }, 1000);
}

function checkSyncReadDone(connectionId, arg) {
  console.log(JSON.stringify(arg));
  if (arg.bytesRead != 2) {
    console.log("Read wrong length data. Expected 2 got: " + arg.bytesRead + " -- " + binToHex(arg.data));
    setTimeout(function() { drain(connectionId) }, 100);
    return;
  }

  var data = binToHex(arg.data);
  console.log("READ: " + data + "/" + data.length);
  if (data[0] != STK_INSYNC) {
    console.log("Didn't get right response");
    return waitForSync(connectionId);
  }

  if (data[1] != STK_OK) {
    console.log("Didn't get STK_OK");
    return;
  }

  console.log("CONNECTED");
  getProtocolVersion(connectionId);
}

//////////////

function getProtocolVersion(connectionId) {
  
  chrome.serial.write(connectionId, hexToBin([STK_GET_PARAMETER, STK_HW_VER, STK_CRC_EOP]), function(wArg) {
      setTimeout(function() {
          chrome.serial.read(connectionId, 1024, function(rArg) {
              parseProtocolVersion(connectionId, rArg);
            });
        }, 1000);
    });
}

function parseProtocolVersion(connectionId, readArg) {
  console.log("Parsing protocol version. Read: " + readArg.bytesRead + " bytes .");
  if (readArg.bytesRead != 3) {
    console.log("Wrong number of bytes in response");
    return;
  }

  var data = binToHex(readArg.data);
  if (data[0] != STK_INSYNC) {
    console.log("Data not in sync. Consumed: " + data[0] + " as byte 0 of " + data);
    return;
  }

  console.log("Hardware version: " + data[1]);

  if (data[2] != STK_OK) {
    console.log("didn't get STK_OK. Consumed " + data[2] + " as byte 2 of " + data);
    return;
  }
}


// Implementation

function hexToBin(hex) {
  var buffer = new ArrayBuffer(hex.length);
  var bufferView = new Uint8Array(buffer);
  for (var i = 0; i < hex.length; i++) {
    bufferView[i] = hex[i];
  }

  return buffer;
}

function binToHex(bin) {
  var bufferView = new Uint8Array(bin);
  var hexes = [];
  for (var i = 0; i < bufferView.length; ++i) {
    hexes.push(bufferView[i]);
  }
  return hexes;
}
