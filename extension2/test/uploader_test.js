var assert = require('assert');
var uploader = require('../lib/uploader');

describe("uploader", function() {

  it("pads data", function() {
    var padded = uploader.pad([1, 2], 4);
    assert.equal(padded.length, 4);
    assert.equal(padded[0], 1);
    assert.equal(padded[1], 2);
    assert.equal(padded[2], 0);
    assert.equal(padded[3], 0);
  });

});
