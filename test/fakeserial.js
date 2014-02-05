var FakeSerial = {
  open: function(portname, options, doneCb) {
    portname_ = portname;
    FakeSerial.execute_(doneCb, { connectionId: FakeSerial.connection_id_++ });
  },

  read: function(connectionId, n, doneCb) {
    console.log("FakeSerial read of " + n + " bytes on connection " + connectionId);
    // TODO
  },

  portname_: null,
  connection_id_: 0,

  getPortname: function() {
    return portname_;
  },


  execute_: function(callback, args) {
    callback(args);
  },

};

var chrome = {
  serial: FakeSerial,
};

