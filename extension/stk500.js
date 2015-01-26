// Board API (in progress):
//
// Connect
// ReadFlash
// WriteFlash

// API
function Stk500Board(serial, dispatcher) {
  if (typeof(serial) === "undefined") {
    console.log(kDebugError, "serial is undefined");
  }

  if (typeof(dispatcher) === "undefined") {
    console.log(kDebugError, "dispatcher is undefined");
  }

  this.serial_ = serial;
  this.dispatcher_ = dispatcher;
};

Stk500Board.prototype.connect = function(deviceName, doneCb) {
  // TODO: Validate doneCb
  // TODO: Validate deviceName?
  if (this.state_ != Stk500Board.State.DISCONNECTED) {
    doneCb(Status.Error("Can't connect. Current state: " + this.state_));
    return;
  }

  this.state_ = Stk500Board.State.CONNECTING;

  var board = this;
  this.serial_.connect(deviceName, { bitrate: 57600 }, function(connectArg) {
    board.serialConnected_(connectArg, doneCb);
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

Stk500Board.prototype.connectionId_ = -1;
Stk500Board.prototype.dispatcher_ = null;
Stk500Board.prototype.readHandler_ = null;
Stk500Board.prototype.serial_ = null;
Stk500Board.prototype.state_ = Stk500Board.State.DISCONNECTED;

Stk500Board.prototype.serialConnected_ = function(connectArg, doneCb) {
  if (typeof(connectArg) == "undefined" ||
      typeof(connectArg.connectionId) == "undefined" ||
      connectArg.connectionId == -1) {
    doneCb(Status.Error("Unable to connect to device!"));
    return;
  }

  this.connectionId_ = connectArg.connectionId;

  // TODO: be more careful about removing this listener
  this.dispatcher_.addListener(
    this.connectionId_, this.handleRead_.bind(this));

  this.twiddleControlLines(doneCb);
}

Stk500Board.prototype.handleRead_ = function(readArg) {
  if (this.readHandler_ != null) {
    this.readHandler_(readArg);
    return;
  }

  log(kDebugNormal, "No read handler for: " + JSON.stringify(readArg));
}

Stk500Board.prototype.twiddleControlLines = function(doneCb) {
  var cid = this.connectionId_;
  var serial = this.serial_;
  setTimeout(function() {
    serial.setControlSignals(cid, {dtr: false, rts: false}, function(ok) {
      if (!ok) {
        doneCb(Status.Error("Couldn't set dtr/rts low"));
        return;
      }
      serial.setControlSignals(cid, {dtr: true, rts: true}, function(ok) {
        if (!ok) {
          doneCb(Status.Error("Couldn't set dtr/rts high"));
          return;
        }
        // TODO: next setp

        doneCb(Status.OK);
      });
    });
  });
}

Stk500Board.prototype.drain = function(doneCb) {
    
}
