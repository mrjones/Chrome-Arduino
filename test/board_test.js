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
    });
  });
});
