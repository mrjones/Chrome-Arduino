var VENDOR_ID = 0x0403;
var PRODUCT_ID = 0x6001;

console.log("-- BEGIN --");

document.getElementById("on").addEventListener('click', function() { serial(true); });
document.getElementById("off").addEventListener('click', function() { serial(false); });



var deviceOptions = {
//  onEvent: function(usbEvent) {
//    console.log("USB EVENT: " + usbEvent);
//  }
}


var usb;
if (chrome.experimental && chrome.experimental.usb) {
  console.log("chrome.experimental.usb: " + chrome.experimental.usb);
  usb = chrome.experimental.usb;
} else {
  usb = chrome.usb;
  console.log("chrome.usb: " + chrome.usb);
}

var device_;
var connectionId_;

function data() {
  var buffer = new ArrayBuffer(1);
  var bufferView = new Uint8Array(buffer);
//  for (var i = 0; i < str.length; i++) {
//    bufferView[i] = str.charCodeAt(i);
//  }

  bufferView[0] = val_;

  return buffer;
}

function onSerialClose(closeArg) {
  console.log("ON CLOSE: " + JSON.stringify(closeArg));
}

function onSerialFlush(flushArg) {
  console.log("ON FLUSH: " + JSON.stringify(flushArg));
//  chrome.serial.close(connectionId_, onSerialClose);
}

function onSerialWrite(writeArg) {
  console.log("ON WRITE:" + JSON.stringify(writeArg));
  chrome.serial.flush(connectionId_, onSerialFlush);
}

function onSerialOpen(openArg) {
  console.log("ON OPEN:" + JSON.stringify(openArg));

  connectionId_ = openArg.connectionId;
  console.log("CONNECTION ID: " + JSON.stringify(connectionId_));

  chrome.serial.write(connectionId_, data(), onSerialWrite);
}

function detectPorts() {
  var menu = document.getElementById("ports");
  menu.options.length = 0;
  chrome.serial.getPorts(function(ports) {
    for (var i = 0; i < ports.length; ++i) {
      console.log(ports[i]);
      var portOpt = document.createElement("option");
      portOpt.text = ports[i];
      menu.add(portOpt, null);
    }
  });
}

detectPorts();

var val_;
function serial(val) {
  val_ = val;
  var portMenu = document.getElementById("ports");
  var port = portMenu.options[portMenu.selectedIndex].text;
  console.log("Using port: " + port);
  chrome.serial.open(port, {bitrate: 9600}, onSerialOpen);
}

//serial(false);

/*
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
