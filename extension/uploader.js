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
  chrome.serial.open(serialPortName, { bitrate: 57600 }, uploadOpenDone);
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

function waitForSync(connectionId) {
  console.log("readying sync bit from: " + connectionId);
  var data = hexToBin([STK_GET_SYNC, STK_CRC_EOP]);
  console.log("writing: " + data);
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
    console.log("Read wrong length data: " + binToHex(arg.data));
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
