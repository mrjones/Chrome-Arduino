// Board API (in progress):
//
// Connect
// ReadFlash
// WriteFlash

var STK = {
  OK: 0x10,
  IN_SYNC: 0x14,
  CRC_EOP: 0x20,
  GET_SYNC: 0x30,
};

// API
function NewStk500Board(serial, dispatcher) {
  if (typeof(serial) === "undefined") {
    return { status: Status.Error("serial is undefined") }
  }

  if (typeof(dispatcher) === "undefined") {
    return { status: Status.Error("dispatcher is undefined") }
  }

  return { status: Status.OK,
           board: new Stk500Board(serial, dispatcher) }
}

function Stk500Board(serial, dispatcher) {
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

  log(kDebugFine, "STK500::Connect");
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

  log(kDebugError, "Not implemented");
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
  log(kDebugFine, "STK500::SerialConnected " + connectArg.connectionId);

  this.connectionId_ = connectArg.connectionId;

  // TODO: be more careful about removing this listener
  this.dispatcher_.addListener(
    this.connectionId_, this.handleRead_.bind(this));
  
  this.twiddleControlLines(doneCb);
}

Stk500Board.prototype.writeAndGetReply_ = function(writePayload, readHandler) {  
  log(kDebugFine, "STK500::WriteAndGetReply");
  this.setReadHandler_(readHandler);
  this.write_(writePayload);
};

Stk500Board.prototype.setReadHandler_ = function(handler) {
  this.readHandler_ = handler;
};

Stk500Board.prototype.handleRead_ = function(readArg) {
  log(kDebugFine, "STK500::HandleRead")
  if (this.readHandler_ != null) {
    this.readHandler_(readArg);
    return;
  }

  log(kDebugNormal, "No read handler for: " + JSON.stringify(readArg));
}

Stk500Board.prototype.write_ = function(payload) {
  log(kDebugFine, "STK500::Writing::" + payload + " -> " + this.connectionId_);
  this.serial_.send(
    this.connectionId_, hexToBin(payload), function(writeArg) {
      log(kDebugNormal, "WRITE: " + JSON.stringify(writeArg));
      // TODO: veridy writeArg
    });

  this.serial_.flush(this.connectionId_, function(flushArg) {
    log(kDebugNormal, "FLUSH: " + JSON.stringify(flushArg));
  })
}


Stk500Board.prototype.twiddleControlLines = function(doneCb) {
  var cid = this.connectionId_;
  var serial = this.serial_;
  var board = this;
  log(kDebugFine, "STK500::TwiddlingControlLines");
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
        //        doneCb(Status.OK);
        setTimeout(function() { board.getSync_(doneCb); }, 500);
      });
    });
  });
}

Stk500Board.prototype.getSync_ = function(doneCb) {
  log(kDebugFine, "STK500::GetSync");
  var board = this;
  this.write_
  this.writeAndGetReply_(
    [ STK.GET_SYNC, STK.CRC_EOP ],
    function(readArg) {
      var data = binToHex(readArg.data);
      if (data.length == 2 &&
          data[0] == STK.IN_SYNC && data[1] == STK.OK) {
        log(kDebugNormal, "In Sync.");
        board.validateVersion_(readArg, doneCb);
      } else {
        log(kDebugError, "Couldn't get sync");
      }
    });
}

Stk500Board.prototype.validateVersion_ = function(doneCb) {
  doneCb(Status.OK);
}
