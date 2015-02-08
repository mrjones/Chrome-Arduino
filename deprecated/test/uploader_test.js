var chrome = { };

describe("Uploader", function() {
  var fakeserial;

  beforeEach(function() {
    fakeserial = new FakeSerial();
    chrome.serial = fakeserial;
  });

  afterEach(function() {
    expect(fakeserial.errors_).toEqual([]);    
  });

  it("opens serial port", function() {
    uploadCompiledSketch([0x01, 0x02, 0x03, 0x04], "portname", "stk500");
    expect(fakeserial.getPortname()).toBe("portname");
  });

});
