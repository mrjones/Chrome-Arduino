// Board API (in progress):
//
// Connect
// ReadFlash
// WriteFlash

// API
function Stk500Board() { };

Stk500Board.prototype.connect = function(deviceName, doneCb) {
  // TODO: Validate doneCb
  // TODO: Validate deviceName?
  if (this.state_ != Stk500Board.State.DISCONNECTED) {
    doneCb(Status.Error("Can't connect. Current state: " + this.state_));
    return;
  }

  this.state_ = Stk500Board.State.CONNECTING;

  var fs = this;
  chrome.serial.connect(deviceName, { bitrate: 57600 }, function(connectArg) {
    fs.serialConnected_(connectArg, doneCb);
  });
};

Stk500Board.prototype.writeFlash = function(boardAddress, data) {
  if (this.state_ != Stk500Board.CONNECTED) {
    return Status.Error("Not connected to board: " + this.state_);
  }
};

Stk500Board.prototype.readFlash = function(boardAddress) {
  if (this.state_ != Stk500Board.CONNECTED) {
    return Status.Error("Not connected to board: " + this.state_);
  }

  console.log(kDebugError, "Not implemented");
};

// IMPLEMENTATION
Stk500Board.State = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected"
};

Stk500Board.prototype.state_ = Stk500Board.State.DISCONNECTED;
Stk500Board.prototype.connectionId_ = -1;

Stk500Board.prototype.serialConnected_ = function(connectArg, doneCb) {
  if (typeof(connectArg) == "undefined" ||
      typeof(connectArg.connectionId) == "undefined" ||
      connectArg.connectionId == -1) {
    doneCb(Status.Error("Unable to connect to device!"));
    return;
  }

  this.connectionId_ = connectArg.connectionId;
  doneCb(Status.OK);
}

