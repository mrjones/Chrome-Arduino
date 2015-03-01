// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var assert = require("assert")
var avr109 = require("../src/avr109.js")
var logging = require("../src/logging.js")
var FakeAvr109 = require("./fakeavr109.js").FakeAvr109

var payloadPattern = [ 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09 ];

var genPayload = function(length) {
  var payload = new Array(length);
  for (var i = 0; i < length; i++) {
    payload[i] = payloadPattern[i % payloadPattern.length];
  }

  return payload;
}

describe("avr109", function() {
  var kPageSize = 128;
  var fake = null;

  beforeEach(function() {
    logging.setConsoleLogLevel(logging.kDebugError);
    fake = new FakeAvr109(kPageSize * 10);
  });

  it("doesn't write until connected", function(done) {
    var result = avr109.NewAvr109Board(fake, kPageSize);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.writeFlash(0, [0x00, 0x01, 0x02], function(status) {
      assert.equal(false, status.ok());
      done();
    });
  });

  it("connects", function(done) {
    var result = avr109.NewAvr109Board(fake, kPageSize);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());
      done();
    });
  });

  it("writes flash", function(done) {
    var result = avr109.NewAvr109Board(fake, kPageSize);
    var kPayloadSize = kPageSize * 4;

    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());

      result.board.writeFlash(0, genPayload(kPayloadSize), function(writeStatus) {
        assert.equal(true, writeStatus.ok(), writeStatus.toString());

        for (var i = 0; i < kPayloadSize; ++i) {
          assert.equal(
            payloadPattern[i % payloadPattern.length],
            fake.memory_[i],
            "Mismatched byte at offset: " + i + ". Expected:  " +
              payloadPattern[i % payloadPattern.length] + ", Actual: " + fake.memory_[i]);
        }

        done();
      });
    });
  });

});
