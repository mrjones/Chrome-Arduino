var binary = require("../src/binary.js");
var logging = require("../src/logging.js")
var AVR = require("../src/avr109.js").AVR;

var log = logging.log;
var kDebugError = logging.kDebugError;
var kDebugNormal = logging.kDebugNormal;
var kDebugFine = logging.kDebugFine;
var kDebugVeryFine = logging.kDebugVeryFine;

var FakeAvr109 = function(memorySize) {
  this.onReceive.addListener = this.addListenerImpl_.bind(this);
  this.onReceive.removeListener = this.removeListenerImpl_.bind(this);

  this.reset_();
  this.memory_ = new Array(memorySize);
  for (var i = 0; i < memorySize; i++) {
    this.memory_[i] = 0;
  }
}

FakeAvr109.prototype.reset_ = function() {
  this.connectionId_ = -1;
  this.serialConnected_ = false;
}

// Chrome Serial API
FakeAvr109.prototype.connect = function(deviceName, options, done) {
  done(Status.Error("Not implemented"));
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

FakeAvr109.prototype.onReceive = {
  // Initialized in constructor.
  // TODO(mrjones): make this less ugly
  addListener: null,
  removeListener: null,
};

// Implementation

FakeAvr109.prototype.connectImpl_ = function(deviceName, options, done) {
  this.serialConnected_ = true;
  this.connectionId_ = this.nextConnectionId_++;

  done({connectionId: this.connectionId_});
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
