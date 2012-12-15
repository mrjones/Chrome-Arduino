var kDebugError = 0;
var kDebugNormal = 1;
var kDebugFine = 2;
var debugLevel = kDebugNormal;

var kBitrate = 9600; // TODO(mrjones): make a UI option
var kUnconnected = -1;

// Current State
var connectionId_ = kUnconnected;

var ids = {
  connectButton: "connect",
  disconnectButton: "disconnect",
  refreshPortsButton: "ports_refresh",
  refreshPortsMenu: "ports_menu",
  sendText: "todevice_data",
  sendButton: "todevice_send",
  statusText: "status",
  uploaderButton: "uploader_button"
};

function timestampString() {
  var now = new Date();
  var pad = function(n) {
    if (n < 10) { return "0" + n; }
    return n;
  }
  return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
}

function log(level, message) {
  if (level >= debugLevel) { console.log(message); }
  if (level == kDebugError) {  // Log all errors visibly
    document.getElementById(ids.statusText).innerHTML =
      "[" + timestampString() + "] " + message + 
      "<br/>" + document.getElementById(ids.statusText).innerHTML;
  }
}


log(kDebugFine, "-- BEGIN --");
document.getElementById("todevice_send")
  .addEventListener('click', sendDataToDevice);

document.getElementById(ids.refreshPortsButton)
  .addEventListener('click', detectPorts);

document.getElementById(ids.connectButton)
  .addEventListener('click', connectToSelectedSerialPort);

document.getElementById(ids.disconnectButton)
  .addEventListener('click', disconnect);

document.getElementById(ids.sendText)
  .addEventListener('keydown', doOnEnter(sendDataToDevice));

document.getElementById(ids.uploaderButton)
  .addEventListener('click', testUploader);
log(kDebugFine, "Listeners attached.");

document.getElementById(ids.disconnectButton).disabled = true;
document.getElementById(ids.sendButton).disabled = true;

function doOnEnter(targetFunction) {
  return function(event) {
    if (event.keyCode == 13) {
      targetFunction();
    }
  }
}

function detectPorts() {
  var menu = document.getElementById("ports_menu");
  menu.options.length = 0;
  chrome.serial.getPorts(function(ports) {
    for (var i = 0; i < ports.length; ++i) {
      log(kDebugFine, ports[i]);
      var portOpt = document.createElement("option");
      portOpt.text = ports[i];
      menu.add(portOpt, null);
    }
  });
  return false; // Don't submit the form
}

detectPorts();

function sendDataToDevice() {
  if (connectionId_ == kUnconnected) {
    log(kDebugError, "ERROR: Not connected");
  } else {
    doSend();
  }
}

function serialOpenDone(openArg) {
  log(kDebugFine, "ON OPEN:" + JSON.stringify(openArg));
  if (!openArg || openArg.connectionId == -1) {
    log(kDebugError, "Error. Could not open connection.");
    return;
  }
  connectionId_ = openArg.connectionId;
  document.getElementById(ids.connectButton).disabled = true;
  document.getElementById(ids.refreshPortsButton).disabled = true;
  document.getElementById(ids.refreshPortsMenu).disabled = true;

  document.getElementById(ids.disconnectButton).disabled = false;
  document.getElementById(ids.sendButton).disabled = false;
  log(kDebugNormal, "CONNECTION ID: " + connectionId_);
  scheduleRepeatingRead();
}

function connectToSelectedSerialPort() {
  var portMenu = document.getElementById("ports_menu");
  var selectedPort = portMenu.options[portMenu.selectedIndex].text;
  log(kDebugNormal, "Using port: " + selectedPort);
  chrome.serial.open(selectedPort, {bitrate: kBitrate}, serialOpenDone);
}

function disconnectDone(disconnectArg) {
  connectionId_ = kUnconnected;
  document.getElementById(ids.connectButton).disabled = false;
  document.getElementById(ids.refreshPortsButton).disabled = false;
  document.getElementById(ids.refreshPortsMenu).disabled = false;

  document.getElementById(ids.disconnectButton).disabled = true;
  document.getElementById(ids.sendButton).disabled = true;
  log(kDebugFine, "disconnectArg: " + JSON.stringify(disconnectArg));
}

function disconnect() {
  if (connectionId_ == kUnconnected) {
    log(kDebugNormal, "Can't disconnect: Already disconnected!");
    return;
  }
  chrome.serial.close(connectionId_, disconnectDone);
}

function doSend() {
  var input = document.getElementById("todevice_data");
  var data = input.value;
  input.value = "";

  log(kDebugFine, "SENDING " + data + " ON CONNECTION: " + connectionId_);
  chrome.serial.write(connectionId_, stringToBinary(data), sendDone);
}

function sendDone(sendArg) {
  log(kDebugFine, "SENT " + sendArg.bytesWritten + " BYTES ON CONN: " + connectionId_);
}

function stringToBinary(str) {
  var buffer = new ArrayBuffer(str.length);
  var bufferView = new Uint8Array(buffer);
  for (var i = 0; i < str.length; i++) {
    bufferView[i] = str.charCodeAt(i);
  }

  return buffer;
}

function binaryToString(buffer) {
  var bufferView = new Uint8Array(buffer);
  var chars = [];
  for (var i = 0; i < bufferView.length; ++i) {
    chars.push(bufferView[i]);
  }

  return String.fromCharCode.apply(null, chars);
}

function scheduleRepeatingRead() {
  setTimeout(tryRead, 100);
}

function tryRead() {
  chrome.serial.read(connectionId_, 1024, readDone);
}

function readDone(readArg) {
  if (readArg && readArg.bytesRead > 0 && readArg.data) {
    var str = binaryToString(readArg.data);
    str.replace("\n", "<br/>");
    // XSS like woah, but who cares.
    document.getElementById("fromdevice_data").innerHTML += str;
    tryRead();
  } else {
    scheduleRepeatingRead();
  }
}


// UNUSED RIGHT NOW//

function onSerialClose(closeArg) {
  log(kDebugFine, "ON CLOSE: " + JSON.stringify(closeArg));
}

function onSerialFlush(flushArg) {
  log(kDebugFine, "ON FLUSH: " + JSON.stringify(flushArg));
}

/*

Code for talking over USB, the chrome.serial seems to be working better for now
but maybe come back to this.

var usb;
if (chrome.experimental && chrome.experimental.usb) {
  console.log("chrome.experimental.usb: " + chrome.experimental.usb);
  usb = chrome.experimental.usb;
} else {
  usb = chrome.usb;
  console.log("chrome.usb: " + chrome.usb);
}

var device_;


// Info is for Arduino Duemilanove
// TODO(mrjones): Make this work with other boards
var VENDOR_ID = 0x0403;
var PRODUCT_ID = 0x6001;


var deviceOptions = {
//  onEvent: function(usbEvent) {
//    console.log("USB EVENT: " + usbEvent);
//  }
}


usb.findDevice(
  VENDOR_ID,
  PRODUCT_ID,
  deviceOptions,
  function(device) {
    if (!device) {
      alert("Couldn't load device (V:" + VENDOR_ID + ", P:" + PRODUCT_ID + ")");
      return;
    }
    device_ = device;
    console.log("FOUND DEVICE: " + JSON.stringify(device));
  });


function fire() {
  console.log("FIRE");

  var buf = new ArrayBuffer(1);
  console.log(buf);
  var bufView = new Uint8Array(buf);
  console.log(bufView);
 
  bufView[0] = 89;
  console.log(bufView[0]);

  var payload = {
    direction: 'out',
    endpoint: 0,
    data: buf
  };

  var doneFn = function() { console.log("SEND DONE"); };

  console.log("[PAYLOAD: " + JSON.stringify(payload) + "]\n[DEVICE: " + JSON.stringify(device_) + "]\n[DONEFN: " + doneFn + "]\n[USBFN: " + usb.interruptTransfer + "]");

  usb.interruptTransfer(device_, payload, doneFn);
  console.log("interrupt kicked off: " + buf + " | " + buf[0]);
}
*/
