describe("Uploader", function() {
  afterEach(function() {
    expect(FakeSerial.errors_).toEqual([]);    
  });

  it("opens serial port", function() {
    uploadCompiledSketch([0x01, 0x02, 0x03, 0x04], "portname", "stk500");
    expect(FakeSerial.getPortname()).toBe("portname");
  });

});
