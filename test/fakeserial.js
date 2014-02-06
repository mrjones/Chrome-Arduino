var FakeSerial = {
  open: function(portname, options, doneCb) {
    portname_ = portname;
    FakeSerial.execute_(doneCb, { connectionId: FakeSerial.connection_id_ });
  },

  read: function(connectionId, n, doneCb) {
    if (connectionId != FakeSerial.connection_id_) {
      FakeSerial.errors_.push("Mismatched connection ID. Expected: '" +
                              FakeSerial.connection_id_ + "'. Actual: '" +
                              connectionId + "'");
      return;
    }
    console.log("FakeSerial read of " + n + " bytes on connection " + connectionId);
    // TODO
  },

  portname_: null,
  connection_id_: 123456,
  errors_: [],

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

