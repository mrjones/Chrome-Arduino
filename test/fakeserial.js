

function FakeSerial() {
  this.onReceive = new FakeSerialReadAdapter(this);
};

FakeSerial.prototype.connect = function(portname, options, doneCb) {
  if (!this.allowConnections_) {
    this.execute_(doneCb, { connectionId: -1 } );
    return;
  }

  portname_ = portname;
  var args = { connectionId: this.connection_id_ };
  this.execute_(doneCb, args);
};

FakeSerial.prototype.setControlSignals = function(connectionId, signals, doneCb) {
  this.controlSignalHistory_.push(
    { time: this.clock_.nowMillis(), signals: signals });

  this.execute_(doneCb, true);
}

FakeSerial.prototype.read = function(connectionId, n, doneCb) {
  if (connectionId != FakeSerial.connection_id_) {
    this.errors_.push(
      "Mismatched connection ID. Expected: '" +
        FakeSerial.connection_id_ + "'. Actual: '" +
        connectionId + "'");
    return;
  }
};

FakeSerial.prototype.portname_ = null;
FakeSerial.prototype.connection_id_ = 123456;
FakeSerial.prototype.errors_ = [];
FakeSerial.prototype.readListeners_ = [];
FakeSerial.prototype.allowConnections_ = true;
FakeSerial.prototype.clock_ = new RealClock();
FakeSerial.prototype.controlSignalHistory_ = [];

FakeSerial.prototype.setAllowConnections = function(allow) {
  this.allowConnections_ = allow;
}

FakeSerial.prototype.getPortname = function() {
  return portname_;
};

FakeSerial.prototype.execute_ = function(callback, args) {
//  log(kDebugFine, "Executing callback with args: " + JSON.stringify(args));
  callback(args);
};

function FakeSerialReadAdapter(fakeSerial) {
  this.fs_ = fakeSerial;
}

FakeSerialReadAdapter.prototype.addListener = function(listener) {
  this.fs_.readListeners_.push(listener);
  console.log("Num listeners: " + this.fs_.readListeners_.length);
}

FakeSerialReadAdapter.prototype.fs_ = null;
