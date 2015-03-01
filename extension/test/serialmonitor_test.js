// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var assert = require('assert');
var uploader = require('../src/serialmonitor.js');

describe("serialmonitor", function() {

  it("addsBrTagsForNewlines", function() {
    assert.equal("a<br/>b<br/>c", uploader.serialDataToHtml_forTest("a\nb\nc"));
  });

});
