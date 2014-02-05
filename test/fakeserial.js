var FakeSerial = {
  open: function(portname, options, doneCb) {
    console.log("Setting portname_ to '" + portname + "'");
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

