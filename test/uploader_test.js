var FakeSerial = {
  open: function(portname, options, doneCb) {
    console.log("Setting portname_ to " + portname);
    portname_ = portname;
  },

  portname_: null,

  getPortname: function() {
    return portname_;
  }
};

var chrome = {
  serial: FakeSerial,
};

describe("Uploader", function() {
  it("opens serial port", function() {
    uploadCompiledSketch([0x01, 0x02, 0x03, 0x04], "portname", "stk500");
    expect(FakeSerial.getPortname()).toBe("portname");
  });
});
