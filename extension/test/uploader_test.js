// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var assert = require('assert');
var uploader = require('../src/uploader.js');

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
