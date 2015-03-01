// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var arrays = require("../src/arrays.js")
var binary = require("../src/binary.js");
var logging = require("../src/logging.js")
var STK = require("../src/stk500.js").STK;

var arraysEqual = arrays.arraysEqual;
var hasPrefix = arrays.hasPrefix;
var log = logging.log;
var kDebugError = logging.kDebugError;
var kDebugNormal = logging.kDebugNormal;
var kDebugFine = logging.kDebugFine;
var kDebugVeryFine = logging.kDebugVeryFine;

var FakeStk500 = function(memorySize) {
  this.onReceive.addListener = this.addListenerImpl_.bind(this);
  this.onReceive.removeListener = this.removeListenerImpl_.bind(this);

  this.reset_();

  this.nextConnectionId_ = 10;
  this.memory_ = new Array(memorySize);
  for (var i = 0; i < memorySize; i++) {
    // Write random data to the board
    // this.memory_[i] = Math.floor(Math.random() * 256);
    this.memory_[i] = 0;
  }
}

FakeStk500.prototype.reset_ = function() {
  this.addressPtr_ = -1;
  this.bootloaderState_ = FakeStk500.BootloaderState.NOT_IN_BOOTLOADER;
  this.connectionId_ = -1;
  this.inProgmode_ = false;
  this.listeners_ = [];
  this.serialConnected_ = false;
}

// Chrome Serial API
FakeStk500.prototype.connect = function(deviceName, options, done) {
  this.connectImpl_(deviceName, options, done);
}

FakeStk500.prototype.disconnect = function(connectionId, done) {
  this.disconnectImpl_(connectionId, done);
}

FakeStk500.prototype.send = function(connectionId, payload, done) {
  this.sendImpl_(connectionId, payload, done);
}

FakeStk500.prototype.setControlSignals = function(connectionId, signals, done) {
  this.setControlSignalsImpl_(connectionId, signals, done);
}

FakeStk500.prototype.onReceive = {
  // Initialized in constructor.
  // TODO(mrjones): make this less ugly
  addListener: null,
  removeListener: null,
};

// Implementation

FakeStk500.BootloaderState = {
  NOT_IN_BOOTLOADER: 0,
  ENTERING_BOOTLOADER: 1,  // Got dtr=false, but not dtr=true yet
  IN_BOOTLOADER: 2,
};

FakeStk500.prototype.connectImpl_ = function(deviceName, options, done) {
  this.serialConnected_ = true;
  this.connectionId_ = this.nextConnectionId_++;

  done({connectionId: this.connectionId_});
}

FakeStk500.prototype.disconnectImpl_ = function(connectionId, done) {
  if (this.connectionId_ == connectionId) {
    this.reset_();
    done(true);
  } else {
    done(false); 
  }
}

FakeStk500.prototype.sendImpl_ = function(connectionId, binaryPayload, done) {
  if (!this.serialConnected_) {
    done({error: "disconnected", bytesSent: 0});
    return;
  }

  if (this.bootloaderState_ != FakeStk500.BootloaderState.IN_BOOTLOADER) {
    // Not in the bootloader, just pretend we sent the data to the app, but
    // don't change our state.
    done({bytesSent: binaryPayload.byteLength});
    return;
  }

  var payload = binary.binToHex(binaryPayload);

  // We're in the bootloader! What should we do with this command:

  if (arraysEqual(payload, [STK.GET_SYNC, STK.CRC_EOP])) {
    done({bytesSent: payload.length});
    this.sendReply_([STK.IN_SYNC, STK.OK]);
    return;
  }

  // TODO(mrjones): We could make GET_PARAMETER more general.
  if (arraysEqual(payload, [STK.GET_PARAMETER, STK.HW_VER, STK.CRC_EOP])) {
    done({bytesSent: payload.length});
    this.sendReply_([STK.IN_SYNC, 3, STK.OK]);
    return;
  }

  if (arraysEqual(payload, [STK.ENTER_PROGMODE, STK.CRC_EOP])) {
    done({bytesSent: payload.length});
    this.inProgmode_ = true;
    this.sendReply_([STK.IN_SYNC, STK.OK]);
    return;
  }

  if (arraysEqual(payload, [STK.LEAVE_PROGMODE, STK.CRC_EOP])) {
    done({bytesSent: payload.length});
    this.inProgmode_ = false;
    this.sendReply_([STK.IN_SYNC, STK.OK]);
    return;
  }

  if (hasPrefix(payload, [STK.LOAD_ADDRESS]) && payload.length == 4 &&
      payload[3] == STK.CRC_EOP) {
    done({bytesSent: payload.length});
    var wordAddress = (payload[2] << 8) + payload[1];
    var byteAddress = wordAddress * STK.BYTES_PER_WORD;
    this.addressPtr_ = byteAddress;
    log(kDebugFine, "Address PTR now: " + this.addressPtr_);
    this.sendReply_([STK.IN_SYNC, STK.OK]);
    return;
  }

  if (hasPrefix(payload, [STK.READ_PAGE]) && payload.length >= 5) {
    var length = (payload[1] << 8) + payload[2];
    // TODO(mrjones): verify addressPtr != -1
    // TODO(mrjones): Support different kinds of memory??
    // TODO(mrjones): verify that payload[3] == STK.FLASH_MEMORY
    // TODO(mrjones): verify that payload[<last>] == STK.CRC_EOP

    if (this.addressPtr_ + length >= this.memory_.length) {
      log(kDebugError, "Tried to read past end of board!");
      return;
    }

    done({bytesSent: payload.length});

    var reply = new Array(length + 2);
    reply[0] = STK.IN_SYNC;
    reply[length + 1] = STK.OK;

    for (var i = 0; i < length; i++) {
      reply[i + 1] = this.memory_[this.addressPtr_ + i];
    }

    this.sendReply_(reply);
  }

  if (hasPrefix(payload, [STK.PROGRAM_PAGE]) && payload.length >= 5) {
    var length = (payload[1] << 8) + payload[2];
    // TODO(mrjones): verify in PROG_MODE
    // TODO(mrjones): verify addressPtr != -1
    // TODO(mrjones): Support different kinds of memory??
    // TODO(mrjones): verify that payload[3] == STK.FLASH_MEMORY
    // TODO(mrjones): verify that payload[<last>] == STK.CRC_EOP
    if (length + 5 != payload.length) {
      log(kDebugError, "Bad PROG_PAGE command. " + length + " + 5 != " + payload.length);
      return;
    }

    if (this.addressPtr_ + length >= this.memory_.length) {
      log(kDebugError, "Tried to write past end of board!");
      return;
    }

    done({bytesSent: payload.length});

    for (var i = 0; i < length; i++) {
      this.memory_[i + this.addressPtr_] = payload[i + 4];
    }

    this.sendReply_([STK.IN_SYNC, STK.OK]);
    return;
  }
}

// TODO(mrjones): implement modes where replies are sent in various, weird ways:
// - After a delay
// - Broken up into multiple packets
FakeStk500.prototype.sendReply_ = function(payload) {
  var binaryPayload = binary.hexToBin(payload);
  for (var i = 0; i < this.listeners_.length; i++) {
    this.listeners_[i]({data: binaryPayload});
  }
}

FakeStk500.prototype.addListenerImpl_ = function(listener) {
  this.listeners_.push(listener);
}

FakeStk500.prototype.removeListenerImpl_ = function(listener) {
  for (var i = 0; i < this.listeners_.length; i++) {
    if (this.listeners_[i] == listener) {
      this.listeners_ = this.listeners_.splice(i, 1);
      return;
    }
  }
}

FakeStk500.prototype.setControlSignalsImpl_ = function(connectionId, signals, done) {
  if (!this.serialConnected_) {
    done(false);
    return;
  }

  if (this.bootloaderState_ == FakeStk500.BootloaderState.NOT_IN_BOOTLOADER &&
      (typeof(signals.dtr) != "undefined" && signals.dtr == false) &&
      (typeof(signals.rts) != "undefined" && signals.rts == false)) {
    this.bootloaderState_ = FakeStk500.BootloaderState.ENTERING_BOOTLOADER;
    done(true);
    return;
  }

  if (this.bootloaderState_ == FakeStk500.BootloaderState.ENTERING_BOOTLOADER &&
      (typeof(signals.dtr) != "undefined" && signals.dtr == true) &&
      (typeof(signals.rts) != "undefined" && signals.rts == true)) {
    this.bootloaderState_ = FakeStk500.BootloaderState.IN_BOOTLOADER;
    done(true);
    return;
  }

  // Nothing changed, but no problem
  done(true);
  return;
}


exports.FakeStk500 = FakeStk500;
