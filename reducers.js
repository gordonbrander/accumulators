/* Accumulators
-----------------------------------------------------------------------------

Because I'm dealing with issues of multiple consumers of futures in futureReduce
approach, going to try a judo move and get rid of the concept of return values
altogether. Only accumulate. The magic of reducers is after all async, not arrays.


* https://github.com/Gozala/reducers/
* https://github.com/Gozala/reducible/
* http://clojure.com/blog/2012/05/08/reducers-a-library-and-model-for-collection-processing.html
* http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html

*/


function ns(key) {
  return key + '@accumulators';
}


function set_(object, key, value) {
  object[key] = value;
  return object;
}


function accumulatable(accumulate) {
  /*
  Define a new accumulatable. A accumulatable is any object with a accumulate
  method at the correct namespace.

  The mechanics of _how_ the accumulation happens are left up to the `accumulate`
  method. 

  Accumulate methods take the same arguments as reduce, but they are not expected
  to return a value.
  */
  return set_({}, ns('accumulate'), accumulate);
}
export accumulatable;


function isEmpty(thing) {
  /* Check if a thing is nullish (undefined, null or void(0)).
  Returns a boolean. */
  return thing == null;
}
export isEmpty;


function isAccumulatable(thing) {
  return thing && typeof thing[ns('accumulate')] === 'function';
}
export isAccumulatable;


// End is our token representing the end of reduction for a future accumulatable.
// We use it to mark the end of a stream with future accumulatables.
var end = "[Token for end of accumulation]";
export end;


function enforceEnd(next) {
  /*
  Transform a accumulator function, handling and enforcing "end of source"
  scenarios.

  Returns an accumulator function. */

  // Closure variable keeps track of whether reduction has already happened on
  // the source that is being accumulated.
  var isEnded = false;

  function nextUntilEnd(accumulated, item) {
    // After a source has been ended, it should not send further items. Throw an
    // exception if further items are sent.
    if (isEnded) throw new Error('Source attempted to send item after it ended');

    // If item isn't end-of-source token, accumulate item with `next`.
    // If item is end-of-source token, keep accumulated value from last accumulate
    // step.
    accumulated = (item === end) ? accumulated : next(accumulated, item);

    // If item is end token, source is ended.
    // Likewise, if accumulator passed back end token, source is ended.
    isEnded = (item === end || accumulated === end);

    // Return reduction.
    return accumulated;
  }

  return nextUntilEnd;
}
export enforceEnd;


function accumulate(source, next, initial) {
  /* Any value is accumulatable with accumulate function. */
  isAccumulatable(source) ? source[ns('accumulate')](next, initial) : next(next(initial, source), end);
}
export accumulate;


function accumulator(xf) {
  /**
  Convenience function to simplify definitions of transformation function, to
  avoid manual definition of `accumulatable` results and currying transformation
  function.

  From a pure data `xf` function that is called on each value for a
  collection with following arguments:

  1. `additional` - Options passed to the resulting transformation function
  most commonly that's a function like in `map(source, f)`.
  2. `next` - Function which needs to be invoked with transformed value,
  or simply not called to skip the value.
  3. `accumulated` - Accumulate value.
  4. `item` - Last value emitted by a collection being accumulated.

  Function is supposed to return new, accumulated `result`. It may either
  pass mapped transformed `value` and `result` to the `next` continuation
  or skip it.

  For example see `map` and `filter` functions.

  A riff on reducer in https://github.com/clojure/clojure/blob/master/src/clj/clojure/core/reducers.clj.
  **/
  function xformed(source, additional) {
    // Return a new accumulatable object who's accumulate method transforms the `next`
    // accumulating function.
    return accumulatable(function accumulateAccumulatorTransform(next, initial) {
      // `next` is the accumulating function we are transforming. 
      accumulate(source, function sourceAccumulator(accumulated, item) {
        // We are essentially wrapping next with `xf` provided the `item` is
        // not `end`.
        return item === end ? next(accumulated, item) :
                              xf(additional, next, accumulated, item);
      }, initial);
    });    
  }

  return xformed;
}
export accumulator;


var map = accumulator(function mapTransform(mapper, next, accumulated, item) {
  /**
  Returns transformed version of given `source` where each item of it
  is mapped using `f`.

  ## Example

  var data = [{ name: "foo" }, { name: "bar" }]
  var names = map(data, function(item) { return item.name })
  print(names) // => < "foo" "bar" >
  **/
  return next(accumulated, mapper(item));
});
export map;


function append(left, right) {
  return accumulatable(function accumulateAppend(next, initial) {
    function accumulatorLeft(accumulated, item) {
      return item === end ? accumulate(right, next, accumulated) : next(accumulated, item);
    }

    accumulate(left, accumulatorLeft, initial);
  });
}
export append;


function concat(source) {
  return accumulatable(function accumulateConcat(next, initial) {
    function appendAccumulator(a, b) {
      if(b === end) return accumulate(a, next, initial);

      return a === null ? b : append(a, b);
    }

    accumulate(source, appendAccumulator, null);
  });
}
export concat;