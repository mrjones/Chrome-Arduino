var assert = require("assert");
var logic = require("../lib/logic");

describe("add", function() {
  it("adds 2 and 2", function() {
    assert.equal(logic.add(2, 2), 4);
  });
});
