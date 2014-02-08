var chrome = { };

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
    fakeserial = new FakeSerial();
    chrome.serial = fakeserial;
    notified = false;

    board = new Stk500Board;
  });

  it("can't write until connected", function() {
    expect(board.writeFlash(0, [0x00, 0x01]).ok()).toBe(false);
  });

  it("can't read until connected", function() {
    expect(board.readFlash(0).ok()).toBe(false);
  });

  it("connects", function() {
    runs(function() {
      board.connect("testDevice", justRecordStatus);
    });

    waitsFor(function() {
      return notified;
    }, "Callback should have been called.", 100);

    runs(function() {
      expect(status.ok()).toBe(true);
    });
  });

  it("reports connection failure", function() {
    runs(function() {
      fakeserial.setAllowConnections(false);
      board.connect("testDevice", justRecordStatus);
    });

    waitsFor(function() {
      return notified;
    }, "Callback should have been called.", 100);

    runs(function() {
      expect(status.ok()).toBe(false);

      var signals = fakeserial.controlSignalHistory_;
      expect(signals.length).toBe(2);
      expect(signals[0].signals["dtr"]).toBe(false);
      expect(signals[0].signals["rts"]).toBe(false);

      expect(signals[1].signals["dtr"]).toBe(true);
      expect(signals[1].signals["rts"]).toBe(true);

      // TODO: mrjones assert on timestamps of control signals?
    });
  });
});
