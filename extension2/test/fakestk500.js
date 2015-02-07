var binary = require("../lib/binary.js");
var STK = require("../lib/stk500.js").STK;

var FakeStk500 = function() {
  this.onReceive.addListener = this.addListenerImpl_.bind(this);
  this.onReceive.removeListener = this.removeListenerImpl_.bind(this);
}

// Chrome Serial API
FakeStk500.prototype.connect = function(deviceName, options, done) {
  this.connectImpl_(deviceName, options, done);
}

FakeStk500.prototype.disconnect = function(connectionId, done) {
  this.disconnectImpl_(deviceName, options, done);
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

FakeStk500.prototype.connectionId_ = -1;
FakeStk500.prototype.nextConnectionId_ = 10;
FakeStk500.prototype.serialConnected_ = false;
FakeStk500.prototype.bootloaderState_ = FakeStk500.BootloaderState.NOT_IN_BOOTLOADER;
FakeStk500.prototype.listeners_ = [];

FakeStk500.prototype.connectImpl_ = function(deviceName, options, done) {
  this.serialConnected_ = true;
  this.connectionId_ = this.nextConnectionId_++;

  done({connectionId: this.connectionId_});
}

FakeStk500.prototype.disconnectImpl_ = function(connectionId, done) {

}

var arraysEqual = function(a1, a2) {
  if (a1.length != a2.length) {
    return false;
  }

  for (var i = 0; i < a1.length; i++) {
    if (a1[i] != a2[i]) {
      return false;
    }
  }

  return true;
}

FakeStk500.prototype.sendImpl_ = function(connectionId, binaryPayload, done) {
  if (!this.serialConnected_) {
    done({error: "disconnected", bytesSent: 0});
    return;
  }

  if (this.bootloaderState_ != FakeStk500.BootloaderState.IN_BOOTLOADER) {
    // Not in the bootloader, just pretend we sent the data to the app, but
    // don't change our state.
    done({bytesSent: binaryPayload.length});
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
    done({bytesSend: payload.length});
    this.sendReply_([STK.IN_SYNC, 3, STK.OK]);
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
