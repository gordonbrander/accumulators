var r = require('../node/reducers.js');
var reduce = r.reduce;
var map = r.map;
var futureReducible = r.futureReducible;
var end = r.end;
var into = r.into;
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

function makeIntervalReducible(array) {
  array = array.slice();

  return futureReducible(function (next, initial) {
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
    }, 10);
  });
}

describe('reduce() arrays', function () {
  var a1 = [1, 1, 1];
  var a2 = reduce(a1, sum, 0);

  it('should return immediate results', makeAssertK(a2 === 3));
});

describe('reduce() primitive', function () {
  var a3 = reduce(3, function assertA2(_, sum) {
    return sum * 2;
  });

  it("should call next with value for reduction of primitive values.", makeAssertK(a3 === 6))
});

describe('futureReducible() reduction', function () {
  /* @TODO Mocha seems to be fing this up, as well as assert.async. It SHOULD
  throw, and I AM catching it. */
  it('should throw an exception if source ends and continues to send values', function(done) {
    try {
      var a = makeIntervalReducible([0, 1, end, 2, 3, 4, 5, 6, 7]);
      reduce(a, function(_, __) {});     
    } catch(error) {
      done();
    }
  });

  it('should throw an exception if reducer ends source early and source continues to send values', function(done) {
    try {
      var a = makeIntervalReducible([0, 1, 2, 3, 4, 5]);
      reduce(a, function (accumulated, item) {
        return accumulated === 3 ? end : item;
      }, 0);
    } catch (error) {
      done();
    }
  });

  var x = makeIntervalReducible([0, 1, 2]);

  var a = reduce(x, function (accumulated, num) {
    return accumulated + num;
  }, 0);

  it('should return a reducible for future values', makeAssertK(typeof a.reduce === 'function'));

  it('should reduce future values to reduced value', function (done) {
    reduce(a, function (_, sum) {
      assert(sum === 3);
      done();
    });
  });
});

describe('map()', function () {
  var a = map([0, 0], function () { return 1; });

  it('should return a reducible object', makeAssertK(typeof a.reduce === 'function'));

  it('should transform values per mapping function when reduced', function (done) {
    var b = reduce(a, sum, 0);

    // ...and a second reduce for the value...
    reduce(b, function (_, sum) {
      assert(sum === 2);
      done();
    });
  });
});


describe('into()', function () {
  it('should produce a new identical array for arrays', function () {
    var x = [1];
    var y = into(x);

    assert(y instanceof Array);
    assert(x !== y);
    assert(x[0] === y[0]);
  });
/*
  it('INTENTIONALLY FAILS should accumulate values of futureReducible, returning future for reduction', function (done) {
    var x = makeIntervalReducible([0, 1, 2]);

    var y = into(x);

    reduce(y, function (_, y) {
      @TODO 2013-10-03 this is failing because reducer is being hit with
      every value in y, instead of accumulated array. I think this is a bug 
      in futureReducible and the way it resolves futures.

      2013-10-03T11:49
      I think this may be a tradeoff of the approach... reduceFuture will reduce
      the value in order to resolve values that are themselves future values.
      The problem is, if the value is an array, that means you get ordinary
      array reduction. I think I'm ok with that.

      assert(y instanceof Array);
      assert(y[0] === 0);
      assert(y[1] === 1);
      assert(y[2] === 2);

      done();
    });
  });
*/
});

describe('append() arrays', function () {
  var a = [0, 1, 2];
  var b = [3, 4, 5];

  var c = append(a, b);

  it('should return a reducible', makeAssertK(typeof c.reduce === 'function'));

  it('should keep items in source order', function (done) {
    var x = reduce(c, function (accumulated, item) {
      assert(accumulated === item);
      return accumulated + 1;
    }, 0);

    reduce(x, function (_, i) {
      assert.strictEqual(i, 6);
      done();
    });
  });
});

describe('append() futureReducible()', function () {
  var a = makeIntervalReducible([0, 1, 2]);
  var b = makeIntervalReducible([3, 4, 5]);

  var c = append(a, b);

  it('should return a reducible', makeAssertK(typeof c.reduce === 'function'));

  it('should keep items in source order', function (done) {
    var x = reduce(c, function (accumulated, item) {
      assert(accumulated === item);
      return accumulated + 1;
    }, 0);

    reduce(x, function (_, i) {
      assert.strictEqual(i, 6);
      done();
    });
  });
});

describe('concat() arrays', function () {
  var a = [0, 1];
  var b = [2, 3];
  var c = [4, 5];

  var d = concat([a, b, c]);

  it('should return a reducible', makeAssertK(typeof d.reduce === 'function'));

  it('should keep items in source order', function (done) {
    var x = reduce(d, function (accumulated, item) {
      assert(accumulated === item);
      return accumulated + 1;
    }, 0);

    reduce(x, function(_, i) {
      assert.strictEqual(i, 6);
      done();
    });
  });
});

describe('concat() futureReducible()', function () {
  var a = makeIntervalReducible([0, 1]);
  var b = [2, 3];
  var c = makeIntervalReducible([4, 5]);

  var d = makeIntervalReducible([a, b, c]);

  var e = concat(d);

  it('should return a reducible', makeAssertK(typeof e.reduce === 'function'));

  it('should keep items in source order', function (done) {
    var x = reduce(e, function (accumulated, item) {
      assert(accumulated === item);
      return accumulated + 1;
    }, 0);

    reduce(x, function (_, i) {
      assert.strictEqual(i, 6);
      done();
    });
  });
});
