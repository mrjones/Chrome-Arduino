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
var STK_ENTER_PROGMODE = 0x50;
var STK_LEAVE_PROGMODE = 0x51;
var STK_READ_SIGN = 0x75;

var STK_HW_VER = 0x80;
var STK_SW_VER_MAJOR = 0x81;
var STK_SW_VER_MINOR = 0x82;

////


function testUploader() {
  console.log("UPLOADER");
  fetchProgram('/blink-example.hex');
}

function fetchProgram(url) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var programBytes = parseHexFile(xhr.responseText);
      uploadCompiledSketch(programBytes, "/dev/tty.usbserial-A800eJCe");
    }
  };
  xhr.open("GET", url, true);
  xhr.send();
}

// http://en.wikipedia.org/wiki/Intel_HEX
function parseHexFile(data) {
  var kStartcodeBytes = 1;
  var kSizeBytes = 2;
  var kAddressBytes = 4;
  var kRecordTypeBytes = 2;
  var kChecksumBytes = 2;

  var dataLines = data.split("\n");

  var dumbOut = "";
  var out = [];

  var nextAddress = 0;

  for (var i = 0; i < dataLines.length; ++i) {
    var line = dataLines[i];
    dumbOut += (line + "\n");

    console.log("considering line: " + line);

    //
    // Startcode
    //
    if (line[0] != ":") {
      console.log("Bad line [" + i + "]. Missing startcode: " + line);
      return "FAIL";
    }

    //
    // Data Size
    //
    var ptr = kStartcodeBytes;
    if (line.length < kStartcodeBytes + kSizeBytes) {
      console.log("Bad line [" + i + "]. Missing length bytes: " + line);
      return "FAIL";
    }
    var dataSizeHex = line.substring(ptr, ptr + kSizeBytes);
    ptr += kSizeBytes;
    var dataSize = hexToDecimal(dataSizeHex);
    console.log("Size h:" + dataSizeHex + ", d:" + dataSize);

    //
    // Address
    //
    if (line.length < ptr + kAddressBytes) {
      console.log("Bad line [" + i + "]. Missing address bytes: " + line);
      return "FAIL";
    }
    var addressHex = line.substring(ptr, ptr + kAddressBytes);
    ptr += kAddressBytes;
    var address = hexToDecimal(addressHex);
    console.log("Address h:" + addressHex + ", d:" + address);

    //
    // Record Type
    //
    if (line.length < ptr + kRecordTypeBytes) {
      console.log("Bad line [" + i + "]. Missing record type bytes: " + line);
      return "FAIL";
    }
    var recordTypeHex = line.substring(ptr, ptr + kRecordTypeBytes);
    ptr += kRecordTypeBytes;
    console.log("RecordType (hex): " + recordTypeHex);

    //
    // Data
    //
    var dataChars = 2 * dataSize;  // Each byte is two chars
    if (line.length < (ptr + dataChars)) {
      console.log("Bad line [" + i + "]. Too short for data: " + line);
      return "FAIL";
    }
    var dataHex = line.substring(ptr, ptr + dataChars);
    ptr += dataChars;
    console.log("Data (hex): " + dataHex);

    //
    // Checksum
    //
    if (line.length < (ptr + kChecksumBytes)) {
      console.log("Bad line [" + i + "]. Missing checksum: " + line);
      return "FAIL";
    }
    var checksumHex = line.substring(ptr, ptr + kChecksumBytes);
    console.log("checksum (hex): " + checksumHex);

    // TODO(mrjones): eliminate or ignore the whitespace at end of lines?
    if (line.length != ptr + kChecksumBytes + 1) {
      console.log("Bad line [" + i + "]. leftover bytes: " + line);
      console.log("Actual len: " + line.length + ", expected: " + (ptr + kChecksumBytes));
      return "FAIL";
    }

    var kDataRecord = "00";
    var kEndOfFileRecord = "01";

    if (recordTypeHex == kEndOfFileRecord) {
//      return dumbOut;
      return out;
    } else if (recordTypeHex == kDataRecord) {
      if (address != nextAddress) {
        console.log("I need contiguous addresses");
        return "FAIL";
      }
      nextAddress = address + dataSize;

      var bytes = hexCharsToByteArray(dataHex);
      if (bytes == -1) {
        console.log("Couldn't parse hex data: " + dataHex);
        return "FAIL";
      }
      out.push(bytes);
    } else {
      console.log("I can't handle records of type: " + recordTypeHex);
      return "FAIL";
    }
  }

  console.log("Never found EOF!");
  return "FAIL";
}

function hexToDecimal(h) {
  return parseInt(h, 16);
}

function hexCharsToByteArray(hc) {
  if (hc.length % 2 != 0) {
    console.log("Need 2-char hex bytes");
    return -1; // :(
  }

  var bytes = [];
  for (var i = 0; i < hc.length / 2; ++i) {
    var hexChars = hc.substring(i * 2, (i * 2) + 2);
    var byte = hexToDecimal(hexChars);
    bytes.push(byte);
  }
  return bytes;
}

var sketchData_;

function uploadCompiledSketch(hexData, serialPortName) {
  sketchData_ = hexData;
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
  READY_FOR_IN_SYNC: 0,
  READY_FOR_PAYLOAD: 1,
  READY_FOR_OK: 2,
  DONE: 3,
  ERROR: 4,
};

function consumeMessage(connectionId, payloadSize, callback) {
  var accum = [];
  var state = ReadState.READY_FOR_IN_SYNC;
  var kMaxReads = 100;
  var reads = 0;
  var payloadBytesConsumed = 0;

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
      if (state == ReadState.READY_FOR_IN_SYNC) {
        if (hexData[i] == STK_INSYNC) {
          if (payloadSize == 0) {
            state = ReadState.READY_FOR_OK;
          } else {
            state = ReadState.READY_FOR_PAYLOAD;
          }
        } else {
          console.log("Expected STK_INSYNC. Got: " + hexData[i]);
          state = ReadState.ERROR;
        }
      } else if (state == ReadState.READY_FOR_PAYLOAD) {
        accum.push(hexData[i]);
        payloadBytesConsumed++;
        if (payloadBytesConsumed == payloadSize) {
          state = ReadState.READY_FOR_OK;
        } else if (payloadBytesConsumed > payloadSize) {
          state = ReadState.ERROR;
          console.log("Read too many payload bytes!");
        }
      } else if (state == ReadState.READY_FOR_OK) {
        if (hexData[i] == STK_OK) {
          state = ReadState.DONE;
        } else {
          console.log("Expected STK_OK. Got: " + hexData[i]);
          state = ReadState.ERROR;
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
  setTimeout(function() { chrome.serial.read(connectionId, 1024, handleRead); }, 100);
//  chrome.serial.read(connectionId, 1024, handleRead);
}

function writeThenRead(connectionId, outgoingMsg, responsePayloadSize, callback) {
  console.log("[" + connectionId + "] Writing: " + outgoingMsg);
  var outgoingBinary = hexToBin(outgoingMsg);
  // schedule a read in 100ms
  chrome.serial.write(connectionId, outgoingBinary, function(writeArg) {
      consumeMessage(connectionId, responsePayloadSize, callback);
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

      writeThenRead(openArg.connectionId, [STK_GET_SYNC, STK_CRC_EOP], 0, inSyncWithBoard);
    });
}

function inSyncWithBoard(connectionId, ok, data) {
  console.log("InSyncWithBoard: " + ok + " / " + data);

  writeThenRead(connectionId, [STK_GET_PARAMETER, STK_HW_VER, STK_CRC_EOP], 1, readHardwareVersion);
}

function readHardwareVersion(connectionId, ok, data) {
  console.log("HardwareVersion: " + ok + " / " + data);
  writeThenRead(connectionId, [STK_GET_PARAMETER, STK_SW_VER_MAJOR, STK_CRC_EOP], 1, readSoftwareMajorVersion);
}

function readSoftwareMajorVersion(connectionId, ok, data) {
  console.log("Software major version: " + ok + " / " + data);
  writeThenRead(connectionId, [STK_GET_PARAMETER, STK_SW_VER_MINOR, STK_CRC_EOP], 1, readSoftwareMinorVersion);
}

function readSoftwareMinorVersion(connectionId, ok, data) {
  console.log("Software minor version: " + ok + " / " + data);
  writeThenRead(connectionId, [STK_ENTER_PROGMODE, STK_CRC_EOP], 0, enteredProgmode);
}

function enteredProgmode(connectionId, ok, data) {
  console.log("Entered progmode: " + ok + " / " + data);
  writeThenRead(connectionId, [STK_READ_SIGN, STK_CRC_EOP], 3, readSignature);  
}

function readSignature(connectionId, ok, data) {
  console.log("Device signature: " + ok + " / " + data);
  console.log("Now I should upload: " + sketchData_);
  writeThenRead(connectionId, [STK_LEAVE_PROGMODE, STK_CRC_EOP], 0, leftProgmode);
}

function leftProgmode(connectionId, ok, data) {
  console.log("Left progmode: " + ok + " / " + data);
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
