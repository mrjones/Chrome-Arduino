describe("AVR109 board", function() {
  var board;
  var fakeserial;
  var notified;
  var status;
  var sawKickBitrate;
  var memBlock;

  var PAGE_SIZE = 8;

  var justRecordStatus = function(s) {
    notified = true;
    status = s;
  }

  var disconnectListener = function(cid) {
    // magic leonardo bitrate
    sawKickBitrate = (fakeserial.latestBitrate_ == Avr109Board.MAGIC_BITRATE);
    if (sawKickBitrate) {
      setTimeout(function() {
        var popped = fakeserial.deviceList_.pop();
        setTimeout(function() {
          fakeserial.deviceList_.push(popped);
        }, 100);
      }, 100);
    }
  };

  beforeEach(function() {
    this.addMatchers(commonMatchers);

    fakeserial = new FakeSerial();
    notified = false;

    memBlock = new MemBlock(PAGE_SIZE * 10);

    // Enable simulation of kicking into the bootloader:
    fakeserial.addDisconnectListener(disconnectListener);

    // TODO: verify that we transition to each state, and do
    // so in the correct order.
    fakeserial.addHook(
      new ExactMatcher([AVR.SOFTWARE_VERSION]),
      new ExactReply([0x31, AVR.CR]));

    fakeserial.addHook(
      new ExactMatcher([AVR.ENTER_PROGRAM_MODE]),
      new ExactReply([AVR.CR]));

    fakeserial.addHook(
      new PrefixMatcher([AVR.SET_ADDRESS]),
      { handle: function(payload) {
        var hexData = binToHex(payload);
        if (hexData.length != 3) {
          log(kDebugError, "Malformed SET_ADDRESS (wrong length)");
        } else {
          var address = hexData[2] + (hexData[1] << 16);
          memBlock.seek(address);
          return [AVR.CR];
        }
      }});

    fakeserial.addHook(
      new PrefixMatcher([AVR.WRITE]),
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

    fakeserial.addHook(
      new PrefixMatcher([AVR.READ_PAGE]),
      { handle: function(payload) {
        var hexData = binToHex(payload);
        if (hexData.length < 4) {
          log(kDebugError, "Malformed READ (too short)");
        } else if (hexData[3] != 0x46) { // F
          log(kDebugError, "Malformed READ (no 'F')");
        } else {
          var length = hexData[2] + (hexData[1] << 16);
          return memBlock.read(length)
        }
      }});

    fakeserial.addHook(
      new ExactMatcher([AVR.LEAVE_PROGRAM_MODE]),
      new ExactReply([AVR.CR]));

    fakeserial.addHook(
      new ExactMatcher([AVR.EXIT_BOOTLOADER]),
      new ExactReply([AVR.CR]));

    var globalDispatcher = new SerialDispatcher();
    fakeserial.onReceive.addListener(
      globalDispatcher.dispatch.bind(globalDispatcher));
    var r = NewAvr109Board(fakeserial, PAGE_SIZE, globalDispatcher);
    expect(r.status).toBeOk();
    board = r.board;
  });

  xit("can't write until connected", function() {
    runs(function() { board.writeFlash(
      0, genData(PAGE_SIZE), justRecordStatus); } );

    waitsFor(function() { return notified; },
             "Callback should have been called", 1000);

    runs(function() { expect(status).toBeError(); } );
  });

  xit("can't read until connected", function() {
    var data;

    var recordStatusAndData = function(arg) {
      notified = true;
      status = arg.status;
      data = arg.data;
    }

    runs(function() { board.readFlash(0, PAGE_SIZE, recordStatusAndData); } );

    waitsFor(function() { return notified; },
             "Callback should have been called", 1000);

    runs(function() { expect(status).toBeError(); } );
  });

  xit("connects", function() {
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
});
