var assert = require("assert")
var stk500 = require("../lib/stk500.js")
var FakeStk500 = require("./fakestk500.js").FakeStk500;

var payloadPattern = [ 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09 ];

var genPayload = function(length) {
  var payload = new Array(length);
  for (var i = 0; i < length; i++) {
    payload[i] = payloadPattern[i % payloadPattern.length];
  }

  return payload;
}

describe("stk500", function() {
  it("doesn't write until connected", function(done) {
    var result = stk500.NewStk500Board(null, 1024);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.writeFlash(0, [0x00, 0x01, 0x02], function(status) {
      assert.equal(false, status.ok());
      done();
    });
  });

  it("connects", function(done) {
    var fake = new FakeStk500();
    var result = stk500.NewStk500Board(fake, 128, {connectDelayMs: 10});

    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());
      done();
    });
  });

  it("writesFlash", function(done) {
    var fake = new FakeStk500();
    var result = stk500.NewStk500Board(fake, 128, {connectDelayMs: 10});

    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());

      result.board.writeFlash(0, genPayload(256), function(writeStatus) {
        assert.equal(true, connectStatus.ok(), connectStatus.toString());

        // TODO(mrjones): verify the flash memory.
        // Ideally we'd do this with read flash, but for now maybe we just ask
        // the fake directly.
        done();
      });
    });
  });
});
