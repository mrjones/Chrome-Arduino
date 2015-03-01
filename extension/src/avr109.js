var clock = require("./clock.js");
var Status = require("./status.js").Status;
var logging = require("./logging.js");
var binary = require("./binary.js");

var hexToBin = binary.hexToBin;
var binToHex = binary.binToHex;
var hexRep = binary.hexRep;
var storeAsTwoBytes = binary.storeAsTwoBytes;

var log = logging.log;
var kDebugError = logging.kDebugError;
var kDebugNormal = logging.kDebugNormal;
var kDebugFine = logging.kDebugFine;
var kDebugVeryFine = logging.kDebugVeryFine;

// Board API (in progress):
//
// Connect
// ReadFlash
// WriteFlash

// API
function NewAvr109Board(serial, pageSize) {
  if (typeof(serial) === "undefined") {
    return { status: Status.Error("serial is undefined") }
  }

  if (typeof(pageSize) === "undefined") {
    return { status: Status.Error("pageSize is undefined") }
  }

  return { status: Status.OK,
           board: new Avr109Board(serial, pageSize) };
};

Avr109Board.prototype.connect = function(deviceName, doneCb) {
  this.connectImpl_(deviceName, doneCb);
}

Avr109Board.prototype.writeFlash = function(boardAddress, data, doneCb) {
  this.writeFlashImpl_(boardAddress, data, doneCb);
}

Avr109Board.prototype.readFlash = function(boardAddress, length, doneCb) {
  this.readFlashImpl_(boardAddress, length, doneCb);
}

// IMPLEMENTATION

Avr109Board.State = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected"
};

var AVR = {
  SOFTWARE_VERSION: 0x56,
  ENTER_PROGRAM_MODE: 0x50,
  LEAVE_PROGRAM_MODE: 0x4c,
  SET_ADDRESS: 0x41,
  WRITE: 0x42, // TODO: WRITE_PAGE
  TYPE_FLASH: 0x46,
  EXIT_BOOTLOADER: 0x45,
  CR: 0x0D,
  READ_PAGE: 0x67,

  MAGIC_BITRATE: 1200,
};

function Avr109Board(serial, pageSize) {
  this.init_();

  this.serial_ = serial;
  this.pageSize_ = pageSize;
};

Avr109Board.prototype.init_ = function() {
  this.serialListener_ = null;
  this.pageSize_ = -1;
  this.serial_ = null;
  this.state_ = Avr109Board.State.DISCONNECTED;
  this.connectionId_ = -1;
  this.clock_ = new clock.RealClock;
  this.readHandler_ = null;
}

Avr109Board.prototype.connectImpl_ = function(deviceName, doneCb) {
  // TODO: Validate doneCb
  // TODO: Validate deviceName?

  if (this.state_ != Avr109Board.State.DISCONNECTED) {
    doneCb(Status.Error("Can't connect. Current state: " + this.state_));
    return;
  }

  this.readHandler_ = null;
  this.state_ = Avr109Board.State.CONNECTING;
  this.kickBootloader_(deviceName, doneCb);
};

Avr109Board.prototype.writeFlashImpl_ = function(boardAddress, data, doneCb) {
  if (this.state_ != Avr109Board.State.CONNECTED) {
    return doneCb(Status.Error("Not connected to board: " + this.state_));
  };

  if (boardAddress % this.pageSize_ != 0) {
    return doneCb(Status.Error(
      "boardAddress must be alligned to page size of " + this.pageSize_
        + " (" + boardAddress + " % " + this.pageSize_ + " == "
        + (boardAddress % this.pageSize_) + ")"));
  }

  if (data.length % this.pageSize_ != 0) {
    return doneCb(Status.Error(
      "data size must be alligned to page size of " + this.pageSize_
        + " (" + data.length + " % " + this.pageSize_ + " == "
        + (data.length % this.pageSize_) + ")"));
  }

  var board = this;
  this.writeAndGetReply_(
    [AVR.ENTER_PROGRAM_MODE],
    function(response) {
      var hexResponse = binToHex(response.data);
      if (hexResponse.length == 1 && hexResponse[0] == 0x0D) {
        board.beginProgramming_(boardAddress, data, doneCb)
      } else {
        return doneCb(Status.Error(
          "Error entering program mode: " + hexRep(hexResponse)));
      }
    });
};

Avr109Board.prototype.readFlashImpl_ = function(boardAddress, length, doneCb) {
  if (this.state_ != Avr109Board.State.CONNECTED) {
    doneCb({
      status: Status.Error("Not connected to board: " + this.state_) });
  } else {
    doneCb({
      status: Status.Error("Not implemented")});
  }
};

Avr109Board.prototype.readDispatcher_ = function(readArg) {
  if (this.readHandler_ != null) {
    log(kDebugFine, "Dispatching read...");
    this.readHandler_(readArg);
    return;
  }

  log(kDebugNormal, "No read handler for: " + JSON.stringify(readArg));
}

Avr109Board.prototype.kickBootloader_ = function(originalDeviceName, doneCb) {
  var oldDevices = [];
  var serial = this.serial_;
  var board = this;

  serial.getDevices(function(devicesArg) {
    oldDevices = devicesArg;
    serial.connect(originalDeviceName, {bitrate: AVR.MAGIC_BITRATE }, function(connectArg) {
      log(kDebugFine, "CONNECT: " + JSON.stringify(connectArg));
      serial.disconnect(connectArg.connectionId, function(disconnectArg) {
        log(kDebugFine, "DISCONNECT: " + JSON.stringify(disconnectArg));
        board.waitForNewDevice_(
          oldDevices, doneCb, board.clock_.nowMillis() + 1000);
      });
    });
  });
}

function findMissingIn(needles, haystack) {
  var haystack2 = [];
  for (var i = 0; i < haystack.length; ++i) {
    haystack2.push(haystack[i].path);
  }

  var r = [];
  for (var i = 0; i < needles.length; ++i) {
    if (haystack2.indexOf(needles[i].path) == -1) {
      r.push(needles[i].path);
    }
  }

  return r;
}

Avr109Board.prototype.waitForNewDevice_ = function(oldDevices, doneCb, deadline) {
  var serial = this.serial_;
  var board = this;

  if (this.clock_.nowMillis() > deadline) {
    doneCb(Status.Error("Deadline exceeded while waiting for new devices"));
    return;
  }

  var found = false;
  serial.getDevices(function(newDevices) {
    log(kDebugFine, "WND: " + JSON.stringify(newDevices));
    var appeared = findMissingIn(newDevices, oldDevices);
    var disappeared = findMissingIn(oldDevices, newDevices);
 
    for (var i = 0; i < disappeared.length; ++i) {
      log(kDebugFine, "Disappeared: " + disappeared[i]);
    }
    for (var i = 0; i < appeared.length; ++i) {
      log(kDebugFine, "Appeared: " + appeared[i]);
    }

    if (appeared.length == 0 && disappeared.length == 0 ) {
      setTimeout(function() {
        board.waitForNewDevice_(newDevices, doneCb, deadline);
      }, 100);
    } else {
      var device = appeared[0] ? appeared[0] : disappeared[0];
      log(kDebugNormal, "Aha! Connecting to: " + device);
      // I'm not 100% sure why we need this setTimeout
      setTimeout(function() {
        log(kDebugFine, "Reconnecting...");
        serial.connect(device, { bitrate: 57600 }, function(connectArg) {
          
          board.serialConnected_(connectArg, doneCb);
        });
      }, 3000);
    }
  });
}

Avr109Board.prototype.serialConnected_ = function(connectArg, doneCb) {
  log(kDebugFine, "serialConnected");
  // TODO: test this?
  if (typeof(connectArg) == "undefined" ||
      typeof(connectArg.connectionId) == "undefined" ||
      connectArg.connectionId == -1) {
    doneCb(Status.Error("Couldn't connect to board. " + connectArg + " / " + connectArg.connectionId));
    return;
  }

  this.connectionId_ = connectArg.connectionId;
  // TODO: be more careful about removing this listener
  this.serialListener_ = this.readDispatcher_.bind(this);
  this.serial_.onReceive.addListener(this.serialListener_);

  this.startCheckSoftwareVersion_(doneCb);
}

Avr109Board.prototype.writeAndGetReply_ = function(payload, handler) {  
  log(kDebugFine, "writeAndGetReply");
  this.setReadHandler_(handler);
  this.write_(payload);
};

Avr109Board.prototype.write_ = function(payload) {
  this.serial_.send(
    this.connectionId_, hexToBin(payload), function(writeArg) {
      log(kDebugFine, "did write: " + JSON.stringify(writeArg));
      // TODO: verify writeArg
    });
}


Avr109Board.prototype.setReadHandler_ = function(handler) {
  log(kDebugFine, "setReadHandler");
  this.readHandler_ = handler;
};

Avr109Board.prototype.startCheckSoftwareVersion_ = function(doneCb) {
  log(kDebugFine, "startCheckSoftwareVersion");
  var board = this;
  this.writeAndGetReply_(
    [ AVR.SOFTWARE_VERSION ],
    function(readArg) {
      board.finishCheckSoftwareVersion_(readArg, doneCb);
    });
}

Avr109Board.prototype.finishCheckSoftwareVersion_ = function(readArg, doneCb) {
  log(kDebugFine, "finishCheckSoftwareVersion");
  var hexData = binToHex(readArg.data);
  // TODO: actually examine response
  if (hexData.length == 2) {
    this.state_ = Avr109Board.State.CONNECTED;
    log(kDebugNormal, "Connected");
    doneCb(Status.OK);
  } else {
    log(kDebugError, "Connection error.");
    doneCb(Status.Error("Unexpected software version response: " + hexRep(hexData)));
  }

  // TODO: Deadline?
};


Avr109Board.prototype.beginProgramming_ = function(boardAddress, data, doneCb) {
  log(kDebugFine, "Begin programming.");
  var board = this;
  var addressBytes = storeAsTwoBytes(boardAddress);
  this.writeAndGetReply_(
    // TODO: endianness
    [AVR.SET_ADDRESS, addressBytes[1], addressBytes[0]],
    function(readArg) {
      var hexData = binToHex(readArg.data);
      if (hexData.length == 1 && hexData[0] == 0x0D) {
        board.writePage_(0, data, doneCb);
      } else {
        return doneCb(Status.Error("Error setting address for programming."));
      }
    });
}

Avr109Board.prototype.writePage_ = function(pageNo, data, doneCb) {
  log(kDebugFine, "Write page");
  var numPages = data.length / this.pageSize_;
  if (pageNo == 0 || pageNo == numPages - 1 || (pageNo + 1) % 5 == 0) {
    log(kDebugFine, "Writing page " + (pageNo + 1) + " of " + numPages);
  }

  var board = this;
  var pageSize = this.pageSize_;

  var payload = data.slice(pageNo * this.pageSize_,
                           (pageNo + 1) * this.pageSize_);

  var sizeBytes = storeAsTwoBytes(this.pageSize_);

  // TODO: endianness
  var writeMessage = [AVR.WRITE, sizeBytes[0], sizeBytes[1], AVR.TYPE_FLASH];
  writeMessage = writeMessage.concat(payload);

  this.writeAndGetReply_(
    writeMessage,
    function(readArg) {
      var hexData = binToHex(readArg.data);
      if (hexData.length == 1 && hexData[0] == 0x0D) {
        if (pageSize * (pageNo + 1) >= data.length) {
          // TODO(mrjones): get board address from beginProgramming
          var boardAddress = 0;
          return board.beginVerification_(boardAddress, data, doneCb);
//          return board.exitProgramMode_(doneCb);
        }
        board.writePage_(pageNo + 1, data, doneCb);
      } else {
        return doneCb(Status.Error("Error writing page " + pageNo + ": " +
                                   hexRep(hexData)));
      }
    });
}

Avr109Board.prototype.beginVerification_ = function(boardAddress, data, doneCb) {
  var board = this;
  var addressBytes = storeAsTwoBytes(boardAddress);
  this.writeAndGetReply_(
    [AVR.SET_ADDRESS, addressBytes[1], addressBytes[0]],
    function(readArg) {
      var hexData = binToHex(readArg.data);
      if (hexData.length == 1 && hexData[0] == 0x0D) {
        board.verifyPage_(0, data, doneCb);
      } else {
        return doneCb(Status.Error("Error setting address for verification."));
      }

    });
}

Avr109Board.prototype.verifyPage_ = function(pageNo, data, doneCb) {
  var numPages = data.length / this.pageSize_;
//  if (pageNo == 0 || pageNo == numPages - 1 || (pageNo + 1) % 5 == 0) {
    log(kDebugFine, "Verifying page " + (pageNo + 1) + " of " + numPages);
//  }

  var board = this;
  var pageSize = this.pageSize_;
  var expected = data.slice(pageNo * this.pageSize_,
                            (pageNo + 1) * this.pageSize_);
  var sizeBytes = storeAsTwoBytes(this.pageSize_);

  var pageOffset = 0;
  this.writeAndGetReply_(
    [AVR.READ_PAGE, sizeBytes[0], sizeBytes[1], AVR.TYPE_FLASH],
    // TODO(mrjones): test for handling fragmented response payloads
    function(readArg) {
      var hexData = binToHex(readArg.data);
//      log(kDebugFine, "Got " + hexData.length + " bytes to verify");
      if (pageOffset + hexData.length > pageSize) {
        doneCb(Status.Error("Error verifying. Page #" + pageNo + ". Read too long (" + hexData.length + " vs. page size: " + pageSize));
        return;
      }
      for (var i = 0; i < hexData.length; i++) {
        if (hexData[i] != data[pageSize * pageNo + pageOffset]) {
          doneCb(Status.Error("Error verifying. Page #" + pageNo + ". Data mismatch at offset " + pageOffset + "(expected: " + data[pageSize * pageNo + pageOffset] + ", actual:" + hexData[i] + ")"));
          return;
        }
        pageOffset++;
      }

      if (pageOffset == pageSize) {
        if (pageSize * (pageNo + 1) >= data.length) {
          return board.exitProgramMode_(doneCb);
        }
        board.verifyPage_(pageNo + 1, data, doneCb);
      } else {
//        log(kDebugFine, "Waiting for " + (pageSize - pageOffset) + " more bytes...");
      }
    });
}

Avr109Board.prototype.exitProgramMode_ = function(doneCb) {
  var board = this;
  this.writeAndGetReply_(
    [AVR.LEAVE_PROGRAM_MODE],
    function(readArg) {
      var hexData = binToHex(readArg.data);
      if (hexData.length == 1 && hexData[0] == AVR.CR) {
        board.exitBootloader_(doneCb);
      } else {
        doneCb(Status.Error("Error leaving program mode: " + hexRep(hexData)));
      }
    });
};

Avr109Board.prototype.exitBootloader_ = function(doneCb) {
  this.writeAndGetReply_(
    [AVR.EXIT_BOOTLOADER],
    function(readArg) {
      var hexData = binToHex(readArg.data);
      if (hexData.length == 1 && hexData[0] == AVR.CR) {
        // TODO: add a "disconnect" method, and call it everywhere
        this.serial_.onReceive.removeListener(this.serialListener_);

        // TODO: don't forget to disconnect in all the error cases (yuck)
        this.serial_.disconnect(this.connectionId_, function(disconnectArg) {
          doneCb(Status.OK);
        });
      } else {
        doneCb(Status.Error("Error leaving bootloader: " + hexRep(hexData)));
      }
    });
}

exports.NewAvr109Board = NewAvr109Board;
exports.AVR = AVR;
