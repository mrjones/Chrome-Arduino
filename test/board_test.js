describe("STK500 board", function() {
  var board;

  beforeEach(function() {
    board = new Stk500Board;
  });

  it("can't write until connected", function() {
    expect(board.writeFlash(0, [0x00, 0x01]).ok()).toBe(false);
  });

  it("can't read until connected", function() {
    expect(board.readFlash(0).ok()).toBe(false);
  });

});
