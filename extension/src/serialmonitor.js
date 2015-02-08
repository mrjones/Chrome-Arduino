var uploader = require("./uploader.js");
var logging = require("./logging.js");

var log = logging.log;
var kDebugError = logging.kDebugError;
var kDebugNormal = logging.kDebugNormal;
var kDebugFine = logging.kDebugFine;

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
  uploaderButton: "uploader_button",
  logLevelMenu: "log_level_picker"
};

logging.configureVisibleLogging(ids.statusText);

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
  .addEventListener('click', uploadButtonPressed);

document.getElementById(ids.logLevelMenu)
  .addEventListener('change', logLevelChanged);

//document.getElementById("test_fetch")
//  .addEventListener('click', testFetch);

document.getElementById(ids.disconnectButton).disabled = true;
document.getElementById(ids.sendButton).disabled = true;

//function testFetch() {
//    fetchProgram("http://linode.mrjon.es/blink.hex", function(data) {
//        log(kDebugFine, "Got data!");
//    });
//}

function logLevelChanged() {
  var logLevelMenu = document.getElementById(ids.logLevelMenu);
  var logLevel = logLevelMenu.options[logLevelMenu.selectedIndex].value;

  logging.setVisibleLogLevel(logLevel);
}

function uploadButtonPressed() {
  var portMenu = document.getElementById("devices_menu");
  var selectedPort = portMenu.options[portMenu.selectedIndex].text;

  var protocolMenu = document.getElementById("protocol");
  var protocol = protocolMenu.options[protocolMenu.selectedIndex].value;

  var urlBox = document.getElementById("sketch_url");
  var url = urlBox.value;

  uploader.uploadSketch(selectedPort, protocol, url);
}

function doOnEnter(targetFunction) {
  return function(event) {
    if (event.keyCode == 13) {
      targetFunction();
    }
  }
}

function detectDevices() {
  var foundUsb = false;
  var menu = document.getElementById("devices_menu");
  menu.options.length = 0;
  chrome.serial.getDevices(function(devices) {
    for (var i = 0; i < devices.length; ++i) {
      log(kDebugFine, devices[i].path);
      var portOpt = document.createElement("option");
      portOpt.text = devices[i].path;
      if (!foundUsb && devices[i].path.indexOf("tty.usb") > -1) {
        foundUsb = true;
        portOpt.selected = true;
      }
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
