describe("AVR109 board", function() {
  var board;
  var fakeserial;
  var notified;
  var status;
  var sawKickBitrate;

  var PAGE_SIZE = 8;

  var justRecordStatus = function(s) {
    console.log("justRecordStatus(" + JSON.stringify(s) + ")");
    notified = true;
    status = s;
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
    fakeserial.addMockReply(new ExactMatcher([0x56]),
                            [0x31, 0x30]);

    var r = NewAvr109Board(fakeserial, PAGE_SIZE);
    expect(r.status).toBeOk();
    board = r.board;
  });

  it("can't write until connected", function() {
    runs(function() {
      board.writeFlash(
        0,
        [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07],
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

        board.writeFlash(0, [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07], function(status2) {
          testStatus = status2;
          written = true;
        });
      });
    });

    waitsFor(function() { return written; }, "Should have written.", 1000);

    runs(function() {
      expect(written).toBe(true);
      expect(testStatus).toBeOk();
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
