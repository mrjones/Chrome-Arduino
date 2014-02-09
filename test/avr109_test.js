var MemBlock = function(size) {
  this.size_ = size;
  this.cursor_ = -1;
  this.data_ = new Array(size);
}

MemBlock.prototype.seek = function(address) {
  this.cursor_ = address;
}

MemBlock.prototype.write = function(data) {
  for (var i = 0; i < data.length; ++i) {
    this.data_[this.cursor_++] = data[i];
  }
}

var genData = function(length) {
  var a = [];
  for (var i = 0; i < length; ++i) {
    a.push(i);
  }
  return a;
}

describe("AVR109 board", function() {
  var board;
  var fakeserial;
  var notified;
  var status;
  var sawKickBitrate;
  var memBlock;

  var PAGE_SIZE = 8;

  var justRecordStatus = function(s) {
    console.log("justRecordStatus(" + JSON.stringify(s) + ")");
    notified = true;
    status = s;
  }

  var ExactReply = function(reply) {
    this.reply_ = reply;
  }
  ExactReply.prototype.handle = function(unusedPayload) {
    return this.reply_;
  }


  var ExactMatcher = function(target) {
    this.target_ = target;
  }
  ExactMatcher.prototype.matches = function(candidate) {
    var hexCandidate = binToHex(candidate);
    log(kDebugFine, "Target: " + hexRep(this.target_) + " vs. candidate: " +
        hexRep(hexCandidate));
    if (hexCandidate.length != this.target_.length) {
      return false;
    }

    for (var i = 0; i < this.target_.length; ++i) {
      if (this.target_[i] != hexCandidate[i]) {
        return false;
      }
    }

    return true;
  }

  var PrefixMatcher = function(target) {
    this.target_ = target;
  }
  PrefixMatcher.prototype.matches = function(candidate) {
    var hexCandidate = binToHex(candidate);
    log(kDebugFine, "Prefix target: " + hexRep(this.target_)
        + " vs. candidate: " + hexRep(hexCandidate));

    if (hexCandidate.length <= this.target_.length) {
      return false;
    }

    for (var i = 0; i < this.target_.length; ++i) {
      if (this.target_[i] != hexCandidate[i]) {
        return false;
      }
    }

    return true;
  };

  var disconnectListener = function(cid) {
    // magic leonardo bitrate
    sawKickBitrate = (fakeserial.latestBitrate_ == Avr109Board.MAGIC_BITRATE);
    if (sawKickBitrate) {
      setTimeout(function() {
        var popped = fakeserial.deviceList_.pop();
        setTimeout(function() {
          fakeserial.deviceList_.push(popped);
        });
      }, 100);
    }
  };

  beforeEach(function() {
    this.addMatchers({
      toBeOk: function() {
        this.message = function() {
          return "Status not OK. Message: '" + 
            this.actual.errorMessage() + "'";
        }

        return this.actual.ok() &&
          this.actual.errorMessage() == null;
      },

      toBeError: function() {
        this.message = function() {
          return "Expected status to be error, but was OK.";
        };
        return !this.actual.ok();
      },
    });

    
    fakeserial = new FakeSerial();
    notified = false;

    // Enable simulation of kicking into the bootloader:
    fakeserial.addDisconnectListener(disconnectListener);

    // Enable checking of the software version for all tests
    // TODO: factor out these constants
    fakeserial.addHook(new ExactMatcher([AVR.SOFTWARE_VERSION]),
                       new ExactReply([0x31, AVR.CR]));

    fakeserial.addHook(new ExactMatcher([AVR.ENTER_PROGRAM_MODE]),
                       new ExactReply([AVR.CR]));

    fakeserial.addHook(new PrefixMatcher([AVR.SET_ADDRESS]),
                       { handle: function(payload) {
                         var hexData = binToHex(payload);
                         if (hexData.length != 3) {
                           log(kDebugError, "Malformed SET_ADDRESS");
                         } else {
                           var address = hexData[2] + (hexData[1] << 16);
                           memBlock.seek(address);
                           return [AVR.CR];
                         }
                       }});

    fakeserial.addHook(new PrefixMatcher([AVR.WRITE]),
                       { handle: function(payload) {
                         var hexData = binToHex(payload);
                         if (hexData.length < 4) {
                           log(kDebugError, "Malformed WRITE (too short)");
                         } else if (hexData[3] != 0x46) { // F
                           log(kDebugError, "Malformed WRITE (no 'F')");
                         } else {
                           var length = hexData[2] + (hexData[1] << 16);
                           var payload = hexData.slice(4);
                           if (payload.length != length) {
                             log(kDebugError, "Malformed WRITE (bad length. " +
                                "Declared: " + length + ", Actual: " +
                                payload.length + ")");
                           } else {
                             memBlock.write(payload);
                             return [AVR.CR];
                           }
                         }
                       }});

    fakeserial.addHook(new ExactMatcher([AVR.LEAVE_PROGRAM_MODE]),
                       new ExactReply([AVR.CR]));

    memBlock = new MemBlock(PAGE_SIZE * 10);

    var r = NewAvr109Board(fakeserial, PAGE_SIZE);
    expect(r.status).toBeOk();
    board = r.board;
  });

  it("can't write until connected", function() {
    runs(function() {
      board.writeFlash(
        0,
        genData(8),
        justRecordStatus);
    });

    waitsFor(function() { return notified; },
             "Callback should have been called", 1000);

    runs(function() { expect(status).toBeError(); } );
  });

  it("can't read until connected", function() {
    expect(board.readFlash(0)).toBeError();
  });

  it("connects", function() {
    runs(function() {
      board.connect("testDevice", justRecordStatus);
    });

    waitsFor(function() {
      return notified;
    }, "Callback should have been called.", 1000);

    runs(function() {
      expect(sawKickBitrate).toBe(true);
      expect(status).toBeOk();
    });
  });

  it("writes to flash", function() {
    var testStatus;
    var written;

    runs(function() {
      written = false;
      board.connect("testDevice", function(status1) {
        if (!status1) {
          testStatus = status1;
          return;
        }

        board.writeFlash(0, genData(16), function(status2) {
          testStatus = status2;
          written = true;
        });
      });
    });

    waitsFor(function() { return written; }, "Should have written.", 1000);

    runs(function() {
      expect(written).toBe(true);
      expect(testStatus).toBeOk();

      for (var i = 0; i < 16; ++i) {
        expect(memBlock.data_[i]).toBe(i);
      }
    });
  });

  xit("reports connection failure", function() {
    runs(function() {
      fakeserial.setAllowConnections(false);
      board.connect("testDevice", justRecordStatus);
    });

    waitsFor(function() {
      return notified;
    }, "Callback should have been called.", 100);

    runs(function() {
      expect(status).toBeError();
    });
  });
});
