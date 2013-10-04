/* Reducers
-----------------------------------------------------------------------------

I'm taking a slightly different approach to this with my version. A reducible is
defined as:

* Any object with a reduce method
* That returns a value

Reduce can be used on any value.

futureReducible is provided to help manage future values. It returns a reducible
"future" object good for the value of the reduction.

Advantages:

* All methods are simply used as provided, including native array methods.
* No transformations on reducers that are used on native arrays (faster).
* Clearer program flow (I think).
* No need for a low-level accumulate function.
* End of reduction can be found via a second reduction, rather than wrapping
  the reducer.

Disadvantages:

* Not sure yet.
*/

// https://github.com/Gozala/reducers/
// https://github.com/Gozala/reducible

var create = Object.create;


function reducible(reduce) {
  /*
  Define a new reducible. A reducible is any object with a reduce method.
  The mechanics of _how_ the reduction happens are left up to the `reduce`
  method. */
  return { reduce: reduce };
}
export reducible;


function isEmpty(thing) {
  /* Check if a thing is nullish (undefined, null or void(0)).
  Returns a boolean. */
  return thing == null;
}
export isEmpty;


// End is our token representing the end of reduction for a future reducible.
// We use it to mark the end of a stream with future reducibles.
var end = "[Token for end of reduction]";
export end;


function enforceReducerEnd(reducer) {
  /*
  Transform a reducer function, handling and enforcing "end of source"
  scenarios.

  Returns a reducer function. */

  // Closure variable keeps track of whether reduction has already happened on
  // the source that is being reduced.
  var isEnded = false;

  function nextUntilEnd(accumulated, item) {
    // After a source has been ended, it should not send further items. Throw an
    // exception if further items are sent.
    if (isEnded) throw new Error('Source attempted to send item after it ended');

    // If item isn't end-of-source token, accumulate item with `next`.
    // If item is end-of-source token, keep accumulated value from last reduce
    // step.
    accumulated = (item === end) ? accumulated : reducer(accumulated, item);

    // If item is end token, source is ended.
    // Likewise, if reducer passed back end token, source is ended.
    isEnded = (item === end || accumulated === end);

    // Return reduction.
    return accumulated;
  }

  return nextUntilEnd;
}


/* Create a future object to be used as the prototype for future reducible
values. */
var __future__ = reducible(function reduceFuture(next, initial) {
  // Uses instance to keep track of things.
  var future = this;

  // If future has been delivered, return the final reduction of the true value.
  if (!isEmpty(future.value)) return reduce(future.value, next, initial);

  // @TODO this is where the issue is with append(). Append requires a reducer
  // on the future, but since the future returns itself, the reducer is stomped
  // by the reducer interested in the future value.
  if(future.next) throw new Error('Future was reduced twice.');

  // Otherwise, keep next and initial around so we can use them for the
  // eventual reduction.
  future.next = next;
  future.initial = initial;

  return future;
});


function deliver_(future, value) {
  /* Deliver a future, where future is any object with optional next and
  initial properties.

  Mutates the future and returns empty. */

  // Assign the value to the future.
  future.value = value;

  // Kick off accumulation of the value.
  return future.next ? reduce(value, future.next, future.initial) : future;
}


function futureReducible(reduce) {
  // Create a new reducible that delivers reducible future values.
  // It is not necessary that the reduce function return a value. A
  // future reducible will be returned from the transformed function.
  // Errors are used to mark the end of reduction.
  return reducible(function reduceFutureReducible(next, initial) {
    next = enforceReducerEnd(next);

    var f = create(__future__);

    function forward(accumulated, item) {
      // If source is exausted and sends error, or reducer returns an error,
      // deliver final accumulation. Otherwise, continue accumulation.
      var reduction = next(accumulated, item);
      var isEnded = item === end || reduction === end;
      return isEnded ? deliver_(f, accumulated) :
                       reduction;
    }

    reduce(forward, initial);

    return !isEmpty(f.value) ? f.value : f;
  });
}
export futureReducible;


function reduce(source, next, initial) {
  /* Any value is reducible with reduce function. */
  return source && source.reduce ? source.reduce(next, initial) : next(initial, source);
}
export reduce;


function reducer(xf) {
  /**
  Convenience function to simplify definitions of transformation function, to
  avoid manual definition of `reducible` results and currying transformation
  function.

  From a pure data `xf` function that is called on each value for a
  collection with following arguments:

  1. `additional` - Options passed to the resulting transformation function
  most commonly that's a function like in `map(source, f)`.
  2. `next` - Function which needs to be invoked with transformed value,
  or simply not called to skip the value.
  3. `accumulated` - Accumulate value.
  4. `item` - Last value emitted by a collection being reduced.

  Function is supposed to return new, accumulated `result`. It may either
  pass mapped transformed `value` and `result` to the `next` continuation
  or skip it.

  For example see `map` and `filter` functions.

  A riff on reducer in https://github.com/clojure/clojure/blob/master/src/clj/clojure/core/reducers.clj.
  **/
  function xformed(source, additional) {
    // Return a new reducible object who's reduce method transforms the `next`
    // reducing function.
    // 
    // `next` is the reducer function we are transforming. We are essentially
    // wrapping it with `xf` provided the value is not an error.
    return reducible(function reduceReducerTransform(next, initial) {
      return reduce(source, function sourceReducer(accumulated, item) {
        return xf(additional, next, accumulated, item);
      }, initial);
    });    
  }

  return xformed;
}
export reducer;


var map = reducer(function mapTransform(mapper, next, accumulated, item) {
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
  return reducible(function reduceAppend(next, initial) {
    // @TODO looks like reduceRight is never called by futureReducible.
    function reduceRight(_, accumulated) {
      return reduce(right, next, accumulated);
    }

    var accumulated = reduce(left, next, initial);

    // When accumulation of left is finished, reduce right.
    return reduce(accumulated, reduceRight);
  });
}
export append;


function appendReducer(a, b) {
  return a === null ? b : append(a, b);
}


function concat(source) {
  return reduce(source, appendReducer, null);
}
export concat;