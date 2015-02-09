var assert = require("assert")
var avr109 = require("../src/avr109.js")
var logging = require("../src/logging.js")
var FakeAvr109 = require("./fakeavr109.js").FakeAvr109


describe("avr109", function() {
  var kPageSize = 128;
  var fake = null;

  beforeEach(function() {
    logging.setConsoleLogLevel(logging.kDebugError);
    fake = new FakeAvr109(kPageSize * 10);
  });

  it("doesn't write until connected", function(done) {
    var result = avr109.NewAvr109Board(fake, 1024, null);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.writeFlash(0, [0x00, 0x01, 0x02], function(status) {
      assert.equal(false, status.ok());
      done();
    });
  });

});
