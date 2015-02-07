var assert = require("assert")
var stk500 = require("../lib/stk500.js")
var FakeStk500 = require("./fakestk500.js").FakeStk500;

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
    // We pause 2s before twiddling the control lines, so the test timeout has to
    // be longer.
    // TODO(mrjones): make the twiddle pause configurable, and shorten it.
    this.timeout(5000);

    var fake = new FakeStk500();
    var result = stk500.NewStk500Board(fake, 1024);

    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      done();
    });
  });
});
