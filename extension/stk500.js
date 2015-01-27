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
  GET_PARAMETER: 0x41,
  FLASH_MEMORY: 0x46,
  ENTER_PROGMODE: 0x50,
  LEAVE_PROGMODE: 0x51,
  LOAD_ADDRESS: 0x55,
  HW_VER: 0x80,
  SW_VER_MAJOR: 0x81,
  SW_VER_MINOR: 0x82,
};

// API
function NewStk500Board(serial, pageSize) {
  if (typeof(serial) === "undefined") {
    return { status: Status.Error("serial is undefined") }
  }

  if (typeof(pageSize) === "undefined") {
    return { status: Status.Error("pageSize is undefined") }
  }

  return { status: Status.OK, board: new Stk500Board(serial, pageSize) }
}

function Stk500Board(serial, pageSize) {
  this.serial_ = serial;
  this.pageSize_ = pageSize;
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
  // NOTE: 115200 turns out to be the magic number! It didn't work with
  // other values.
  this.serial_.connect(deviceName, { bitrate: 115200 }, function(connectArg) {
    board.serialConnected_(connectArg, doneCb);
  });
};

Stk500Board.prototype.writeFlash = function(boardAddress, data, doneCb) {
  this.writeFlashImpl_(boardAddress, data, doneCb);
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
Stk500Board.prototype.pageSize_ = -1;
Stk500Board.prototype.readHandler_ = null;
Stk500Board.prototype.serial_ = null;
Stk500Board.prototype.state_ = Stk500Board.State.DISCONNECTED;

Stk500Board.prototype.writeFlashImpl_ = function(boardAddress, data, doneCb) {
  if (this.state_ != Stk500Board.CONNECTED) {
    doneCb(Status.Error("Not connected to board: " + this.state_));
    return;
  }

  if (boardAddress % this.pageSize_ != 0) {
    doneCb(Status.Error(
      "boardAddress must be aligned to page size of " + this.pageSize_
        + " (" + boardAddress + " % " + this.pageSize_ + " == "
        + (boardAddress % this.pageSize_) + ")"));
    return;
  }

  if (data.length % this.pageSize_ != 0) {
    return doneCb(Status.Error(
      "data size must be aligned to page size of " + this.pageSize_
        + " (" + data.length + " % " + this.pageSize_ + " == "
        + (data.length % this.pageSize_) + ")"));
  }

  var board = this;
  this.writeAndGetReply_(
    [STK.ENTER_PROGMODE],
    function(readArg) {
      var hexResponse = binToHex(readAgr.data);
      if (hexResponse.length == 1 && hexResponse[0] == 0x0D) {
        board.writePage_(boardAddress, data, pageNo, doneCb)
      } else {
        return doneCb(Status.Error(
          "Error entering program mode: " + hexRep(response)));
      }
    });

}

Stk500Board.prototype.writePage_ = function(dataStart, data, pageNo, doneCb) {
  log(kDebugNormal, "STK500::WritePage: " + pageNo);
  this.writePageAddress_(dataStart, data, pageNo, doneCb);
}

Stk500Board.prototype.writePageAddress_ = function(dataStart, data, pageNo, doneCb) {
  var address = dataStart + (this.pageSize_ * pageNo);

  var addressLo = address & 0x00FF;
  var addressHi = (address & 0xFF00) >> 8;

  var board = this;
  this.writeAndGetReply_(
    [STK.LOAD_ADDRESS, addressLo, addressHi, STK.CRC_EOP],
    function(readArg) {
      var data = binToHex(readArg.data);
      if (data.length == 2 &&
          data[0] == STK.IN_SYNC && data[1] == STK.OK) {
        board.writePageData_(dataStart, data, pageNo, doneCb);
      } else {
        doneCb(Status.Error(
          "Error loading address for page #" + pageNo + ": " + data));
      }
    });
}

Stk500Board.prototype.writePageData_ = function(dataStart, data, pageNo, doneCb) {
  var relativeOffset = this.pageSize_ * pageNo;
  var payload = data.slice(relativeOffset, relativeOffset + this.pageSize_);

  var sizeHi = (this.pageSize_ & 0x00FF);
  var sizeLo = (this.pageSize_ & 0xFF00) >> 8;

  var message = [ STK.PROG_PAGE, sizeHi, sizeLo, STK.FLASH_MEMORY ];
  message = message.concat(payload);
  message.push(STK.CRC_EOP);

  log(kDebugNormal, "STK500::Writing.");

  var board = this;
  this.writeAndGetReply(
    message,
    function(readArg) {
      var data = binToHex(readArg.data);
      if (data.length == 1 &&
          data[0] == STK.IN_SYNC && data[1] == STK.OK) {
        if (relativeOffset + this.pageSize_ >= data.length) {
          doneCb(Status.OK);
          return;
        } else {
          return board.writePage_(dataStart, data, pageNo + 1, doneCb);
        }
      } else {
        doneCb(Status.Error(
          "Error flashing page #" + pageNo + ": " + data));
        return;
      }
    });
}

Stk500Board.prototype.serialConnected_ = function(connectArg, doneCb) {
  console.log(JSON.stringify(connectArg));
  if (typeof(connectArg) == "undefined" ||
      typeof(connectArg.connectionId) == "undefined" ||
      connectArg.connectionId == -1) {
    console.log("error");
    doneCb(Status.Error("Unable to connect to device!"));
    return;
  }

  log(kDebugFine, "STK500::SerialConnected " + connectArg.connectionId);

  this.connectionId_ = connectArg.connectionId;

  // TODO: be more careful about removing this listener
  this.serial_.onReceive.addListener(
    this.handleRead_.bind(this));
  
  log(kDebugFine, "STK500::ReadHandler set up");

  this.twiddleControlLines_(doneCb);
}

Stk500Board.prototype.writeAndGetReply_ = function(writePayload, readHandler) {  
  log(kDebugFine, "STK500::WriteAndGetReply");
  this.setReadHandler_(readHandler);
  this.write_(writePayload);
};

Stk500Board.prototype.setReadHandler_ = function(handler) {
  log(kDebugFine, "STK500::SetReadHandler");
  this.readHandler_ = handler;
};

Stk500Board.prototype.handleRead_ = function(readArg) {
  log(kDebugFine, "STK500::HandleRead: " + JSON.stringify(readArg));
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
      // log(kDebugNormal, "WRITE: " + JSON.stringify(writeArg));
      // TODO: veridy writeArg
    });
}


Stk500Board.prototype.twiddleControlLines_ = function(doneCb) {
  var cid = this.connectionId_;
  var serial = this.serial_;
  var board = this;
  log(kDebugFine, "STK500::WaitingToTwiddleControlLines");
  setTimeout(function() {
    log(kDebugFine, "STK500::TwiddlingControlLines");
    serial.setControlSignals(cid, {dtr: false, rts: false}, function(ok) {
      if (!ok) {
        doneCb(Status.Error("Couldn't set dtr/rts low"));
        return;
      }
      log(kDebugFine, "STK500::DTR is false");
      setTimeout(function() {
        serial.setControlSignals(cid, {dtr: true, rts: true}, function(ok) {
          if (!ok) {
            doneCb(Status.Error("Couldn't set dtr/rts high"));
            return;
          }
          log(kDebugFine, "STK500::DTR is true");
          console.log(doneCb);
          setTimeout(function() { board.getSync_(doneCb, 0); }, 250);
        });
      }, 250);
    });
  }, 2000);
}

Stk500Board.prototype.getSync_ = function(doneCb, attempts) {
  log(kDebugFine, "STK500::GetSync " + attempts);
  log(kDebugFine, doneCb);
  var board = this;
  this.writeAndGetReply_(
    [ STK.GET_SYNC, STK.CRC_EOP ],
    function(readArg) {
      var data = binToHex(readArg.data);
      if (data.length == 2 &&
          data[0] == STK.IN_SYNC && data[1] == STK.OK) {
        log(kDebugNormal, "In Sync.");
        board.validateVersion_(doneCb);
      } else {
        if (attempts < 10) {
          setTimeout(function() {
            board.getSync_(doneCb, attempts + 1);
          }, 50);
        } else {
          // todo: call doneCb with the error
          log(kDebugError, "Couldn't get sync");
        }
      }
    });
}

Stk500Board.prototype.validateVersion_ = function(doneCb) {
  var board = this;
  
  this.writeAndGetReply_(
    [STK.GET_PARAMETER, STK.HW_VER, STK.CRC_EOP],
    function(readArg) {
      log(kDebugNormal, "doneCb: " + doneCb + " / " + typeof(doneCb));
      log(kDebugNormal, "Hardware version: " + binToHex(readArg.data));
      board.state_ = Stk500Board.State.CONNECTED;
      doneCb(Status.OK);
    });
}
