function FakeSerial() {

};

FakeSerial.prototype.connect = function(portname, options, doneCb) {
  portname_ = portname;
  this.execute_(doneCb, { connectionId: FakeSerial.connection_id_ });
};

FakeSerial.prototype.read = function(connectionId, n, doneCb) {
  if (connectionId != FakeSerial.connection_id_) {
    this.errors_.push(
      "Mismatched connection ID. Expected: '" +
        FakeSerial.connection_id_ + "'. Actual: '" +
        connectionId + "'");
    return;
  }

//  this.execute(doneCb, 
};

FakeSerial.prototype.onReceive = {
  addListener: function(l) {
    console.log("Added listener");
  }
};

FakeSerial.prototype.portname_ = null;
FakeSerial.prototype.connection_id_ = 123456;
FakeSerial.prototype.errors_ = [];

FakeSerial.prototype.getPortname = function() {
  return portname_;
};

FakeSerial.prototype.execute_ = function(callback, args) {
  callback(args);
};
