var r = require('../node/accumulators.js');
var accumulatable = r.accumulatable;
var isAccumulatable = r.isAccumulatable;
var accumulate = r.accumulate;
var map = r.map;
var end = r.end;
var append = r.append;
var concat = r.concat;

var assert = require("assert");

function sum(a, b) {
  return a + b;
}

function log(first) {
  console.log.apply(console, arguments);
  return first;
}

function makeAssertK(value) {
  return function assertK(done) {
    assert(value);
    done();
  }
}

function makeIntervalReducible(array, interval) {
  array = array.slice();

  return accumulatable(function (next, initial) {
    var accumulated = initial;
    var id;

    id = setInterval(function () {
      if (array.length === 0) {
        next(accumulated, end);
        clearInterval(id);
      }
      else {
        accumulated = next(accumulated, array.shift());
      }
    }, interval || 10);
  });
}

describe('isAccumulatable()', function () {
  var x = accumulatable(function () {});

  it('should return true for accumulatable objects', makeAssertK(isAccumulatable(x)));
  it('should return false for other values', makeAssertK(!isAccumulatable({}) && !isAccumulatable([])));
});

describe('accumulate()', function () {
  it("should call next with value for accumulation of primitive values, followed by end token.", function (done) {
    accumulate(3, function assertA2(accumulated, num) {
      return num === end ? (assert.strictEqual(accumulated, 3), done()) : num;
    });
  });

  it("should reduce with next (followed by end token) for accumulation of values with a reduce method.", function (done) {
    accumulate([0, 1, 2, 3], function assertA2(accumulated, item) {
      return (item === end) ? (assert.strictEqual(accumulated, 6), done()) : accumulated + item;
    }, 0);
  });

  it('should accumulate values over multiple turns', function (done) {
    var x = makeIntervalReducible([0, 1, 2, 3]);
    accumulate(x, function (accumulated, item) {
      return (item === end) ? (assert.strictEqual(accumulated, 6), done()) : accumulated + item;
    }, 0);
  });
});

describe('map()', function () {
  var x = makeIntervalReducible([0, 0, 0]);
  var a = map(x, function () { return 1; });

  it('should return an accumulatable object', makeAssertK(isAccumulatable(a)));

  it('should transform values per mapping function when reduced', function (done) {
    accumulate(a, function (accumulated, item) {
      return item === end ? (assert.strictEqual(accumulated, 3), done()) : accumulated + item;
    }, 0);
  });

  it('should never see end tokens', function (done) {
    var x = makeIntervalReducible([0, 0, 0, 0, 0]);

    var a = map(x, function (x) {
      assert(x !== end);
      return 1;
    });

    accumulate(a, function(accumulated, item) {
      return item === end ? (assert.strictEqual(accumulated, 5), done()) : accumulated + item;
    }, 0);
  });

  it('should map reducibles, too', function (done) {
    var a = map([0, 1, 2, 3], function (x) {
      return x + 1;
    });

    accumulate(a, function (accumulated, item) {
      return item === end ? (assert.strictEqual(accumulated, 10), done()) : accumulated + item;
    }, 0);    
  });
});

describe('append()', function () {
  var a = makeIntervalReducible([0, 1, 2]);
  var b = makeIntervalReducible([3, 4, 5]);

  var c = append(a, b);

  it('should return an accumulatable', makeAssertK(isAccumulatable(c)));

  it('should keep items in source order', function (done) {
    accumulate(c, function (accumulated, item) {
      if(item === end) {
        assert.strictEqual(accumulated, 6);
        done();
        return accumulated;
      }

      assert.strictEqual(accumulated, item);
      return accumulated + 1;
    }, 0);
  });
});

describe('concat()', function () {
  var a = makeIntervalReducible([0, 1, 2]);
  var b = makeIntervalReducible([3, 4, 5]);
  var c = makeIntervalReducible([a, b]);

  var d = concat(c);

  it('should return an accumulatable', makeAssertK(isAccumulatable(d)));

  it('should keep items in source order', function (done) {
    accumulate(d, function (accumulated, item) {
      if(item === end) {
        assert.strictEqual(accumulated, 6);
        done();
        return accumulated;
      }

      assert.strictEqual(accumulated, item);
      return accumulated + 1;
    }, 0);
  });
});
