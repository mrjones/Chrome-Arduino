var BoardStates = {
  NO_SYNC: 0,
  GOT_SYNC: 1,
  IN_SYNC: 2
};

var FakeBoard = {
  connectionId_: -1,

  state_: BoardStates.NO_SYNC,
  nextResponse_: null,

  checkConnectionId: function(connectionId) {
    if (connectionId != this.connectionId_) {
      throw("Expected connection id (" + this.connectionId_ + ") does not match " +
            "actual connection id (" + connectionId + ")");
    }
  },

  open: function(connectionId, options, callback) {
    this.connectionId_ = 1234567;
    var arg = { connectionId: this.connectionId_ };
    callback(arg);
  },

  queueResponse: function(data) {
    if (this.nextResponse_ != null) {
      throw ("Too many responses queued!");
    }
    this.nextResponse_ = data;
  },

  write: function(connectionId, data, callback) {
    this.checkConnectionId(connectionId);

    if (this.state_ == BoardStates.NO_SYNC ||
        this.state_ == BoardStates.GOT_SYNC) {
      if (data[0] == STK_GET_SYNC && data[1] == STK_CRC_EOP) {
        this.state_ == BoardStates.GOT_SYNC;
      } else {
        this.state_ == BoardStates.NO_SYNC;
      }
    } else {
      // IN_SYNC
      if (data[0] == STK_HW_VER) {
        this.queueResponse([STK_INSYNC, 0x02, STK_OK]);
      } else {
        throw("Unknown command: " + data[0]);
      }
    }

    var writeArg = {};
    callback(writeArg);
  },

  read: function(connectionId, length, callback) {
    this.checkConnectionId(connectionId);

    var readArg = {};

    if (this.state_ == BoardStates.NO_SYNC) {
      // do nothing
    } else if (this.state_ == BoardStates.GOT_SYNC) {
      // send sync
      readArg.bytesRead = 2;
      readArg.data = [STK_INSYNC, STK_OK];
    } else {
      if (this.nextResponse_ == null) {
        throw("no response queued");
      }
      readArg.bytesRead = this.nextResponse_.length;
      readArg.data = this.nextResponse_;
      this.nextResponse_ = null;
    }

    callback(readArg);
  },

};

var chrome = { serial: FakeBoard };

var UploaderTest = {
  pass: function() { return { passed: true }; },

  foo: function() {
    uploadCompiledSketch([0x00, 0x01], "serialportname");
    setTimeout(1000, function() {
      if (FakeBoard.state_ != BoardStates.IN_SYNC) {
        Test.Fail("Never made it to IN_SYNC state");
      }
      Test.Fail("xxx");
    });
  }
};

Test.Run("UploaderTest", UploaderTest);
