var assert = require("assert")
var stk500 = require("../src/stk500.js")
var FakeStk500 = require("./fakestk500.js").FakeStk500;
var logging = require("../src/logging.js")

var payloadPattern = [ 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09 ];

var genPayload = function(length) {
  var payload = new Array(length);
  for (var i = 0; i < length; i++) {
    payload[i] = payloadPattern[i % payloadPattern.length];
  }

  return payload;
}

describe("stk500", function() {
  var kPageSize = 128;
  var fake = null;

  before(function() {
  });

  beforeEach(function() {
    logging.setConsoleLogLevel(logging.kDebugError);
    fake = new FakeStk500(kPageSize * 10);
  });

  it("doesn't write until connected", function(done) {
    var result = stk500.NewStk500Board(null, 1024);
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.writeFlash(0, [0x00, 0x01, 0x02], function(status) {
      assert.equal(false, status.ok());
      done();
    });
  });

  it("connects", function(done) {
    var result = stk500.NewStk500Board(fake, kPageSize, {connectDelayMs: 10});
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());
      done();
    });
  });

  it("writes and reads back flash", function(done) {
    var result = stk500.NewStk500Board(fake, kPageSize, {connectDelayMs: 10});
    var kPayloadSize = kPageSize * 4;
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());

      result.board.writeFlash(0, genPayload(kPayloadSize), function(writeStatus) {
        assert.equal(true, writeStatus.ok(), writeStatus.toString());

        // TODO(mrjones): Ideally we'd do this via readFlash.
        for (var i = 0; i < kPayloadSize; ++i) {
          assert.equal(
            payloadPattern[i % payloadPattern.length],
            fake.memory_[i],
            "Mismatched byte at offset: " + i + ". Expected:  " +
              payloadPattern[i % payloadPattern.length] + ", Actual: " + fake.memory_[i]);
        }

        result.board.connect("devicename", function(connectStatus) {
          assert.equal(true, connectStatus.ok(), connectStatus.toString());
          result.board.readFlash(0, kPayloadSize, function(readResult) {
            assert.equal(true, readResult.status.ok(), readResult.status.toString());

            for (var i = 0; i < kPayloadSize; ++i) {
              assert.equal(
                payloadPattern[i % payloadPattern.length],
                readResult.data[i],
                "Mismatched byte at offset: " + i + ". Expected:  " +
                  payloadPattern[i % payloadPattern.length] + ", Actual: " + readResult.data[i]);
            }
            done();
          })
        });
      });
    });
  });

  it("writesMustBeAligned_start", function(done) {
    var result = stk500.NewStk500Board(fake, kPageSize, {connectDelayMs: 10});
    var kPayloadSize = kPageSize;
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());

      result.board.writeFlash(1, genPayload(kPayloadSize), function(writeStatus) {
        assert.equal(false, writeStatus.ok(), writeStatus.toString());

        done();
      });
    });
  });

  it("writesMustBeAligned_length", function(done) {
    var result = stk500.NewStk500Board(fake, kPageSize, {connectDelayMs: 10});
    var kPayloadSize = kPageSize + 1;
    assert.equal(true, result.status.ok(), result.status.toString());

    result.board.connect("devicename", function(connectStatus) {
      assert.equal(true, connectStatus.ok(), connectStatus.toString());

      result.board.writeFlash(0, genPayload(kPayloadSize), function(writeStatus) {
        assert.equal(false, writeStatus.ok(), writeStatus.toString());

        done();
      });
    });
  });

});
