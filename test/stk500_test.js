describe("STK500 board", function() {
  var board;
  var fakeserial;
  var notified;
  var status;

  var justRecordStatus = function(s) {
    console.log("justRecordStatus(" + JSON.stringify(s) + ")");
    notified = true;
    status = s;
  }

  beforeEach(function() {
    this.addMatchers(commonMatchers);
//    console.log("=== " + currentSpec.getFullName() + " ===");


    fakeserial = new FakeSerial();
    notified = false;

    fakeserial.addHook(
      new ExactMatcher([STK.GET_SYNC, STK.CRC_EOP]),
      new ExactReply([STK.IN_SYNC, STK.OK]));

    fakeserial.addHook(
      new ExactMatcher([STK.GET_PARAMETER, STK.HW_VER, STK.CRC_EOP]),
      new ExactReply([STK.IN_SYNC, 2, STK.OK]));

    board = new Stk500Board(fakeserial, 128);
  });

  it("can't write until connected", function() {
    runs(function() {
      board.writeFlash(0, [0x00, 0x01], justRecordStatus);
    });

    waitsFor(function() {
      return notified;
    }, "Callback should have been called.", 1000);

    runs(function() {
      expect(status).toBeError();
    });
  });

  it("can't read until connected", function() {
    expect(board.readFlash(0)).toBeOk);
  });

  it("connects", function() {
    runs(function() {
      console.log("=== CONNECTS ===");
      board.connect("testDevice", justRecordStatus);
    });

    waitsFor(function() {
      return notified;
    }, "Callback should have been called.", 5000);

    runs(function() {
      expect(status).toBeOk();

      var signals = fakeserial.controlSignalHistory_;
      expect(signals.length).toBe(2);
      expect(signals[0].signals["dtr"]).toBe(false);
      expect(signals[0].signals["rts"]).toBe(false);

      expect(signals[1].signals["dtr"]).toBe(true);
      expect(signals[1].signals["rts"]).toBe(true);

      
      // TODO: mrjones assert on timestamps of control signals?
    });
  });

  it("reports connection failure", function() {
    runs(function() {
      console.log("=== CONNECTION FAILURE ===");
      fakeserial.setAllowConnections(false);
      board.connect("testDevice", justRecordStatus);
    });

    waitsFor(function() {
      console.log("n: " + notified);
      return notified;
    }, "Callback should have been called.", 5000);

    runs(function() {
      console.log("pstlatch");
      expect(status).toBeOk());
    });
  });
});
