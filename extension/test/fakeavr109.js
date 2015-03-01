// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var arrays = require("../src/arrays.js")
var binary = require("../src/binary.js");
var logging = require("../src/logging.js")
var AVR = require("../src/avr109.js").AVR;

var arraysEqual = arrays.arraysEqual;
var hasPrefix = arrays.hasPrefix;
var log = logging.log;
var kDebugError = logging.kDebugError;
var kDebugNormal = logging.kDebugNormal;
var kDebugFine = logging.kDebugFine;
var kDebugVeryFine = logging.kDebugVeryFine;

var FakeAvr109 = function(memorySize) {
  this.onReceive.addListener = this.addListenerImpl_.bind(this);
  this.onReceive.removeListener = this.removeListenerImpl_.bind(this);

  this.reset_();
  this.nextConnectionId_ = 57;
  this.memory_ = new Array(memorySize);
  for (var i = 0; i < memorySize; i++) {
    this.memory_[i] = 0;
  }
}

FakeAvr109.prototype.reset_ = function() {
  this.addressPtr_ = -1;
  this.bootloaderRunning_ = false;
  this.bootloaderPortName_ = "bootloader-port";
  this.connectionId_ = -1;
  this.inProgmode_ = false;
  this.serialConnected_ = false;
  this.listeners_ = [];
}

// Chrome Serial API
FakeAvr109.prototype.connect = function(deviceName, options, done) {
  this.connectImpl_(deviceName, options, done);
}

FakeAvr109.prototype.disconnect = function(connectionId, done) {
  this.disconnectImpl_(connectionId, done);
}

FakeAvr109.prototype.send = function(connectionId, payload, done) {
  this.sendImpl_(connectionId, payload, done);
}

FakeAvr109.prototype.setControlSignals = function(connectionId, signals, done) {
  this.setControlSignalsImpl_(connectionId, signals, done);
}

FakeAvr109.prototype.getDevices = function(done) {
  this.getDevicesImpl_(done);
}

FakeAvr109.prototype.onReceive = {
  // Initialized in constructor.
  // TODO(mrjones): make this less ugly
  addListener: null,
  removeListener: null,
};

// Implementation

FakeAvr109.prototype.getDevicesImpl_ = function(done) {
  var ports = [ { path: "foo" }, { path: "bar" } ];
  
  if (this.bootloaderRunning_) {
    ports.push({path: this.bootloaderPortName_});
  }

  done(ports);
}

FakeAvr109.prototype.connectImpl_ = function(deviceName, options, done) {
  this.serialConnected_ = true;
  this.connectionId_ = this.nextConnectionId_++;

  if (this.bootloaderRunning_ && deviceName == this.bootloaderPortName_) {
    // Connected to the bootloader
    done({connectionId: this.connectionId_});
  } else {
    // Just a normal connection
    done({connectionId: this.connectionId_});

    if (typeof(options.bitrate) != "undefined" && options.bitrate == AVR.MAGIC_BITRATE) {
      log(kDebugFine, "FakeA109: Launching bootloader");
      this.bootloaderRunning_ = true;
    }
  }
}

FakeAvr109.prototype.disconnectImpl_ = function(connectionId, done) {
  if (this.connectionId_ == connectionId) {
    this.reset_();
    done(true);
  } else {
    done(false); 
  }
}

FakeAvr109.prototype.sendImpl_ = function(connectionId, binaryPayload, done) {
  if (!this.serialConnected_) {
    done({error: "disconnected", bytesSent: 0});
    return;
  }

  if (!this.bootloaderRunning_) {
    // Not in the bootloader, just pretend we sent the data to the app, but
    // don't change our state.
    done({bytesSent: binaryPayload.byteLength});

    log(kDebugError, "FakeAvr109: No bootloader running to handle: " + binary.hexRep(payload));
    return;
  }

  // We're in the bootloader! What should we do with this command:
  var payload = binary.binToHex(binaryPayload);

  if (arraysEqual(payload, [AVR.SOFTWARE_VERSION])) {
    done({bytesSent: payload.length});
    this.sendReply_(['1', '0']);
    return;
  }

  if (arraysEqual(payload, [AVR.ENTER_PROGRAM_MODE])) {
    done({bytesSent: payload.length});
    this.inProgmode_ = true;
    this.sendReply_([AVR.CR]);
    return;
  }

  if (arraysEqual(payload, [AVR.LEAVE_PROGRAM_MODE])) {
    done({bytesSent: payload.length});
    this.inProgmode_ = false;
    this.sendReply_([AVR.CR]);
    return;
  }

  if (arraysEqual(payload, [AVR.EXIT_BOOTLOADER])) {
    done({bytesSent: payload.length});
    this.bootloaderRunning_ = false;
    this.sendReply_([AVR.CR]);
    return;
  }

  if (hasPrefix(payload, [AVR.SET_ADDRESS]) && payload.length == 3) {
    done({bytesSent: payload.length});

    this.addressPtr_ = (payload[1] << 8) + payload[2];
    this.sendReply_([AVR.CR]);
    return;
  }

  if (hasPrefix(payload, [AVR.WRITE]) && payload.length > 4) {
    var length = (payload[1] << 8) + payload[2];

    if (payload.length != length + 4) {
      log(kDebugError, "Payload length (" + payload.length + ") does not match " +
          "encoded length (" + length + " + 4): " + binary.hexRep(payload));
      return;
    }

    if (this.addressPtr_ + length >= this.memory_.length) {
      log(kDebugError, "Tried to read past end of board!");
      return;
    }

    done({bytesSent: payload.length});

    // TODO(mrjones): verify that payload[3] == 'E'
    for (var i = 0; i < length; i++) {
      this.memory_[this.addressPtr_++] = payload[i + 4];
    }

    this.sendReply_([AVR.CR]);
    return;
  }

  if (hasPrefix(payload, [AVR.READ_PAGE]) && payload.length == 4) {
    // TODO(mrjones): verify that payload[3] == 'E'
    var length = (payload[1] << 8) + payload[2];

    if (this.addressPtr_ + length >= this.memory_.length) {
      log(kDebugError, "Tried to read past end of board!");
      return;
    }

    done({bytesSent: payload.length});

    var result = new Array(length);
    for (var i = 0; i < length; i++) {
      result[i] = this.memory_[this.addressPtr_++];
    }

    this.sendReply_(result);

    return;
  };

  log(kDebugError, "FakeAvr109: No handler for: " + binary.hexRep(payload));
}

// TODO(mrjones): implement modes where replies are sent in various, weird ways:
// - After a delay
// - Broken up into multiple packets
FakeAvr109.prototype.sendReply_ = function(payload) {
  var binaryPayload = binary.hexToBin(payload);
  for (var i = 0; i < this.listeners_.length; i++) {
    this.listeners_[i]({data: binaryPayload});
  }
}

FakeAvr109.prototype.addListenerImpl_ = function(listener) {
  this.listeners_.push(listener);
}

FakeAvr109.prototype.removeListenerImpl_ = function(listener) {
  for (var i = 0; i < this.listeners_.length; i++) {
    if (this.listeners_[i] == listener) {
      this.listeners_ = this.listeners_.splice(i, 1);
      return;
    }
  }
}

FakeAvr109.prototype.setControlSignalsImpl_ = function(connectionId, signals, done) {
}


exports.FakeAvr109 = FakeAvr109;
