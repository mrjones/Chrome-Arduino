function Status(ok, errorMessage) {
  this.ok_ = ok;
  this.errorMessage_ = errorMessage;
};

Status.prototype.ok = function() { return this.ok_; }
Status.prototype.errorMessage = function() { return this.errorMessage_; }

Status.prototype.toString = function() {
  if (this.ok_) {
    return "OK";
  } else {
    return "ERROR: '" + this.errorMessage_ + "'";
  }
}

Status.OK = new Status(true, null);

Status.Error = function(message) {
  return new Status(false, message);
}

