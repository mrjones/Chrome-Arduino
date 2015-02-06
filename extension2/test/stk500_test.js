var assert = require("assert")
var stk500 = require("../lib/stk500.js")

describe("stk500", function() {
  it("doesn't write until connected", function(done) {
    var result = stk500.NewStk500Board(null, 1024, null);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.writeFlash(0, [0x00, 0x01, 0x02], function(status) {
      assert.equal(false, status.ok());
      done();
    });
  });
});
