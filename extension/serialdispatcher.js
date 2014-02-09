function SerialDispatcher() {
  this.listeners_ = [];
};

SerialDispatcher.prototype.listeners_ = [];

SerialDispatcher.prototype.dispatch = function(readArg) {
  for (var i = 0; i < this.listeners_.length; ++i) {
    this.listeners_[i].listener(readArg);
  }
}

SerialDispatcher.prototype.addListener = function(id, listener) {
  for (var i = 0; i < this.listeners_.length; ++i) {
    if (this.listeners_[i].id == id) {
      log(kDebugError, "Already has a listener with id '" + id + "'");
      return;
    }
  }
  this.listeners_.push({id: id, listener: listener});
}

SerialDispatcher.prototype.removeListener = function(id) {
  for (var i = 0; i < this.listeners_.length; ++i) {
    if (this.listeners_[i].id == id) {
      this.listeners_.splice(i, 1);
    }
  }
}
