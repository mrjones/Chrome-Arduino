// Board API (in progress):
//
// Connect
// ReadFlash
// WriteFlash

function Stk500Board() {
  
};

Stk500Board.prototype.connected_ = false;

Stk500Board.prototype.connect = function() {
  // TODO: do connection stuff
  this.connected_ = true;
}

Stk500Board.prototype.writeFlash = function(boardAddress, data) {
  if (!this.connected_) {
    return Status.Error("Not connected to board");
  }
};

Stk500Board.prototype.readFlash = function(boardAddress) {
  if (!this.connected_) {
    return Status.Error("Not connected to board");
  }

  console.log(kDebugError, "Not implemented");
};
