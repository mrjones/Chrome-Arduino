var kBitrate = 9600; // TODO(mrjones): make a UI option
var kUnconnected = -1;

// Current State
var connectionId_ = kUnconnected;

var ids = {
  connectButton: "connect",
  disconnectButton: "disconnect",
  refreshDevicesButton: "devices_refresh",
  refreshDevicesMenu: "devices_menu",
  sendText: "todevice_data",
  sendButton: "todevice_send",
  statusText: "status",
  uploaderButton: "uploader_button"
};

configureVisibleLogging(ids.statusText);

log(kDebugFine, "-- BEGIN --");
document.getElementById("todevice_send")
  .addEventListener('click', sendDataToDevice);

document.getElementById(ids.refreshDevicesButton)
  .addEventListener('click', detectDevices);

document.getElementById(ids.connectButton)
  .addEventListener('click', connectToSelectedSerialPort);

document.getElementById(ids.disconnectButton)
  .addEventListener('click', disconnect);

document.getElementById(ids.sendText)
  .addEventListener('keydown', doOnEnter(sendDataToDevice));

document.getElementById(ids.uploaderButton)
  .addEventListener('click', testUploader);

document.getElementById("test_fetch")
  .addEventListener('click', testFetch);

document.getElementById(ids.disconnectButton).disabled = true;
document.getElementById(ids.sendButton).disabled = true;

function testFetch() {
    fetchProgram("http://linode.mrjon.es/blink.hex", function(data) {
        log(kDebugFine, "Got data!");
    });
}

function testUploader() {
  var portMenu = document.getElementById("devices_menu");
  var selectedPort = portMenu.options[portMenu.selectedIndex].text;

  var protocolMenu = document.getElementById("protocol");
  var protocol = protocolMenu.options[protocolMenu.selectedIndex].value;
  uploadBlinkSketch(selectedPort, protocol);
}

function doOnEnter(targetFunction) {
  return function(event) {
    if (event.keyCode == 13) {
      targetFunction();
    }
  }
}

function detectDevices() {
  var menu = document.getElementById("devices_menu");
  menu.options.length = 0;
  chrome.serial.getDevices(function(devices) {
    for (var i = 0; i < devices.length; ++i) {
      log(kDebugFine, devices[i].path);
      var portOpt = document.createElement("option");
      portOpt.text = devices[i].path;
      menu.add(portOpt, null);
    }
  });
  return false; // Don't submit the form
}

detectDevices();

function sendDataToDevice() {
  if (connectionId_ == kUnconnected) {
    log(kDebugError, "ERROR: Not connected");
  } else {
    doSend();
  }
}

function serialConnectDone(connectArg) {
  log(kDebugFine, "ON CONNECT:" + JSON.stringify(connectArg));
  if (!connectArg || connectArg.connectionId == -1) {
    log(kDebugError, "Error. Could not connect.");
    return;
  }
  connectionId_ = connectArg.connectionId;
  document.getElementById(ids.connectButton).disabled = true;
  document.getElementById(ids.refreshDevicesButton).disabled = true;
  document.getElementById(ids.refreshDevicesMenu).disabled = true;

  document.getElementById(ids.disconnectButton).disabled = false;
  document.getElementById(ids.sendButton).disabled = false;
  log(kDebugNormal, "CONNECTION ID: " + connectionId_);

  chrome.serial.onReceive.addListener(readHandler);
}

function connectToSelectedSerialPort() {
  var portMenu = document.getElementById("devices_menu");
  var selectedPort = portMenu.options[portMenu.selectedIndex].text;
  log(kDebugNormal, "Using port: " + selectedPort);
  chrome.serial.connect(selectedPort, {bitrate: kBitrate}, serialConnectDone);
}

function disconnectDone(disconnectArg) {
  connectionId_ = kUnconnected;
  document.getElementById(ids.connectButton).disabled = false;
  document.getElementById(ids.refreshDevicesButton).disabled = false;
  document.getElementById(ids.refreshDevicesMenu).disabled = false;

  document.getElementById(ids.disconnectButton).disabled = true;
  document.getElementById(ids.sendButton).disabled = true;
  log(kDebugFine, "disconnectArg: " + JSON.stringify(disconnectArg));
}

function disconnect() {
  if (connectionId_ == kUnconnected) {
    log(kDebugNormal, "Can't disconnect: Already disconnected!");
    return;
  }
  chrome.serial.disconnect(connectionId_, disconnectDone);
}

function doSend() {
  var input = document.getElementById("todevice_data");
  var data = input.value;
  input.value = "";

  log(kDebugFine, "SENDING " + data + " ON CONNECTION: " + connectionId_);
  chrome.serial.send(connectionId_, stringToBinary(data), sendDone);
}

function sendDone(sendArg) {
  log(kDebugFine, "ON SEND:" + JSON.stringify(sendArg));
  log(kDebugFine, "SENT " + sendArg.bytesSent + " BYTES ON CONN: " + connectionId_);
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

function readHandler(readArg) {
  log(kDebugFine, "ON READ:" + JSON.stringify(readArg));
  // TODO: check connection id
  var str = binaryToString(readArg.data);
  str.replace("\n", "<br/>");
  // XSS like woah, but who cares.
  document.getElementById("fromdevice_data").innerHTML += str;
}


// UNUSED RIGHT NOW//

function onSerialDisconnect(disconnectArg) {
  log(kDebugFine, "ON DISCONNECT: " + JSON.stringify(disconnectArg));
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
