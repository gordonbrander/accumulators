// Accumulators
// =============================================================================
// 
// A tiny library that offers blazing fast generic collection manipulation,
// asyncronous flow control and infinitely large streams through transformation
// of reducing functions.
// 
// Background:
// 
// * http://clojure.com/blog/2012/05/08/reducers-a-library-and-model-for-collection-processing.html
// * http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html
// 
// Prior art:
// 
// * https://github.com/Gozala/reducers/
// * https://github.com/Gozala/reducible/


// Create namespaced key for accumulatable objects.
// This namespaced key has the specific meaning of being accumulatable with
// accumulate function.
var __accumulate__ = 'accumulate@accumulators';


// Defines a new accumulatable. Am accumulatable is any object with an
// accumulate method at the correct namespace.
// 
// The mechanics of _how_ the accumulation happens are left up to the
// `accumulate` method.
// 
// Accumulate methods take the same arguments as reduce, but they are not
// expected to return a value. Because accumulate is not expected to return a
// value, items yielded by accumulate may come during multiple turns of the
// event loop, allowing accumulation of async sources to happen.
function accumulatable(accumulate) {
  // Create new object, assign accumulate function to the accumulate field.
  var x = {};
  x[__accumulate__] = accumulate;
  return x;
}
export accumulatable;


// Determine if `thing` has a function at `key`.
// Returns boolean.
function isMethodAt(thing, key) {
  return thing && typeof thing[key] === 'function';
}
export isMethodAt;


// Check if a thing is accumulatable. Returns boolean.
// Convenience wrapper for isMethodAt.
function isAccumulatable(thing) {
  return isMethodAt(thing, __accumulate__);
}
export isAccumulatable;


// End is our token representing the end of reduction for a future accumulatable.
// We use it to mark the end of a stream with future accumulatables.
// @TODO perhaps it would make sense to do accumulation CPS instead of with an
// end token. However, this would make falling back to `reduce` harder.
var end = "[Token for end of accumulation]";
export end;


// Accumulate a source with a `next` reducer function and `initial` value.
// 
// Accumulate does not return any value, meaning sources may yield values at
// any turn of the event loop.
// 
// Any value type can be accumulated with `accumulate` function.
// This means async sources, arrays and primitive values can all be mixed.
function accumulate(source, next, initial) {
  // If source is accumulatable, call accumulate method.
  isAccumulatable(source) ?
    source[__accumulate__](next, initial) :
    // If source has a reduce method, fall back to accumulation with reduce,
    // then call `next` with `end` token and result of reduction.
    isMethodAt(source, 'reduce') ?
      next(source.reduce(next, initial), end) :
      // Otherwise, call `next` with value of source, then `end`.
      next(next(initial, source), end);
}
export accumulate;


// Convenience function to simplify definitions of transformation function, to
// avoid manual definition of `accumulatable` results and currying transformation
// function.
// 
// From a pure data `xf` function that is called on each value for a
// collection with following arguments:
// 
// 1. `additional` - Options passed to the resulting transformation function
// most commonly that's a function like in `map(source, f)`.
// 2. `next` - Function which needs to be invoked with transformed value,
// or simply not called to skip the value.
// 3. `accumulated` - Accumulate value.
// 4. `item` - Last value emitted by a collection being accumulated.
// 
// Function is supposed to return new, accumulated `result`. It may either
// pass mapped transformed `value` and `result` to the `next` continuation
// or skip it.
// 
// For example see `map` and `filter` functions.
// 
// A riff on reducer in https://github.com/clojure/clojure/blob/master/src/clj/clojure/core/reducers.clj.
function accumulator(xf) {
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


// Returns transformed version of given `source` where each item of it
// is mapped using `f`.
// 
// Example:
// 
//     var data = [{ name: "foo" }, { name: "bar" }]
//     var names = map(data, function(item) { return item.name })
//     => < "foo" "bar" >
var map = accumulator(function mapTransform(mapper, next, accumulated, item) {
  return next(accumulated, mapper(item));
});
export map;


// Composes filtered version of given `source`, such that only items contained
// will be once on which `f(item)` was `true`.
// 
// Example:
// 
//     var digits = filter([ 10, 23, 2, 7, 17 ], function(value) {
//       return value >= 0 && value <= 9
//     })
//     => < 2 7 >
var filter = accumulator(function filterTransform(predicate, next, accumulated, item) {
  return predicate(item) ? next(accumulated, item) : accumulated;
});
export filter;


// Transform an accumulator function, handling and enforcing "end of source"
// scenarios. Returns an accumulator function.
function enforceEnd(next) {
  // Closure variable keeps track of whether source has already ended.
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


function append(left, right) {
  return accumulatable(function accumulateAppend(next, initial) {
    function accumulatorLeft(accumulated, item) {
      return item === end ? accumulate(right, next, accumulated) : next(accumulated, item);
    }

    accumulate(left, accumulatorLeft, initial);
  });
}
export append;


// Concatenate a 2D source of sources, returning a new accumulatable 1D source
// with resolved items in source order.
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


// Merge a 2D source of sources, returning a new accumulatable 1D source,
// where items are ordered by time.
function merge(source) {
  return accumulatable(function accumulateMerge(next, initial) {
    var accumulated = initial;
    var open = 1;

    function forward(_, item) {
      if (item === end) {
        open = open - 1;
        if (open === 0) return next(accumulated, end);
      }
      else {
        accumulated = next(accumulated, item);
      }
      return accumulated;
    }

    accumulate(source, function accumuateMergeSource(_, nested) {
      // If there is an error or end of `source` collection just pass it
      // to `forward` it will take care of detecting weather it's error
      // or `end`. In later case it will also figure out if it's `end` of
      // result to and act appropriately.
      if (nested === end) return forward(_, end);
      // If `nested` item is not end, accumulate it via `forward`.
      open = open + 1;
      accumulate(nested, forward, null);
    }, null);
  });
}
export merge;
