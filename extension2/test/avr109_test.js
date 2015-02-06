var assert = require("assert")
var avr109 = require("../lib/avr109.js")

describe("avr109", function() {
  it("doesn't write until connected", function(done) {
    var result = avr109.NewAvr109Board(null, 1024, null);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.writeFlash(0, [0x00, 0x01, 0x02], function(status) {
      assert.equal(false, status.ok());
      done();
    });
  });
});
