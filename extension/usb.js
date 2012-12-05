var kDebugNone = 0;
var kDebugNormal = 1;
var kDebugFine = 2;
var debugLevel = kDebugNormal;

var kBitrate = 9600; // TODO(mrjones): make a UI option
var kUnconnected = -1;
var connectionId_ = kUnconnected;

function log(level, message) {
  if (level >= debugLevel) { console.log(message); }
}

log(kDebugFine, "-- BEGIN --");
document.getElementById("send_button").addEventListener('click', sendButtonClicked);

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
}

detectPorts();

function sendButtonClicked() {
  if (connectionId_ == kUnconnected) {
    connectToSelectedSerialPort(doSend);
  } else {
    doSend();
  }
}

function serialOpenDone(openArg, doneCallback) {
  log(kDebugFine, "ON OPEN:" + JSON.stringify(openArg));
  if (!openArg || openArg.connectionId == -1) {
    console.log("ERROR COULD NOT OPEN CONNECTION");
    return;
  }
  connectionId_ = openArg.connectionId;
  log(kDebugNormal, "CONNECTION ID: " + connectionId_);
  scheduleRepeatingRead();
  doneCallback();
}

function connectToSelectedSerialPort(doneCallback) {
  var portMenu = document.getElementById("ports_menu");
  var selectedPort = portMenu.options[portMenu.selectedIndex].text;
  log(kDebugNormal, "Using port: " + selectedPort);
  var callbackFn = function(openArg) { serialOpenDone(openArg, doneCallback); };
  chrome.serial.open(selectedPort, {bitrate: kBitrate}, callbackFn);
}

function doSend() {
  var input = document.getElementById("todevice_data");
  var data = input.value;
  input.value = "";

  log(kDebugNormal, "SENDING " + data + " ON CONNECTION: " + connectionId_);
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
  setTimeout(tryRead, 1000);
}

function tryRead() {
  chrome.serial.read(connectionId_, 1, readDone);
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
