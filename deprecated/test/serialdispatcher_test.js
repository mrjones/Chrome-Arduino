describe("SerialDispatcher", function() {
  var notifications;
  var dispatcher;

  beforeEach(function() {
    dispatcher = new SerialDispatcher();
    notifications = [];
  });

  it("dispatches to multiple listeners", function() {
    runs(function() {
      dispatcher.addListener(0, function(readArg) {
        notifications[0] = true;
      });

      dispatcher.addListener(1, function(readArg) {
        notifications[1] = true;
      });

      dispatcher.dispatch({data: "bar"});
    });

    waitsFor(function() {
      return notifications.length == 2 &&
        notifications[0] == true &&
        notifications[1] == true;
    }, "should have notified two notifications.", 100);

    runs(function() {
      expect(notifications).toEqual([true, true]);
    });

  });

  it("doesn't dispatches to removed listeners", function() {
    runs(function() {
      dispatcher.addListener(0, function(readArg) {
        notifications[0] = true;
      });

      dispatcher.addListener(1, function(readArg) {
        notifications[1] = true;
      });

      dispatcher.addListener(2, function(readArg) {
        notifications[2] = true;
      });

      dispatcher.removeListener(1);

      dispatcher.dispatch({data: "bar"});
    });

    waitsFor(function() {
      return notifications.length == 3 &&
        notifications[0] == true &&
        notifications[1] == undefined &&
        notifications[2] == true;
    }, "should have notified only two notifications.", 100);

    runs(function() {
      expect(notifications).toEqual([true, undefined, true]);
    });
  });

  it("doesn't support duplicates", function() {
    var originalDispatcherCalled = false;
    var duplicateDispatcherCalled = false;

    runs(function() {
      dispatcher.addListener(0, function(readArg) {
        originalDispatcherCalled = true;
      });

      dispatcher.addListener(0, function(readArg) {
        duplicateDispatcherCalled = true;
      });

      dispatcher.dispatch({data: "foo"});
    });

    waitsFor(function() {
      return originalDispatcherCalled
    }, "should have called the original dispatcher", 100);

    runs(function() {
      expect(originalDispatcherCalled).toBe(true);
      expect(duplicateDispatcherCalled).toBe(false);
    });
  });
});
