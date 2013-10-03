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


function isError(thing) {
  /* An error is any thing who's toString value is '[object Error]'.
  Returns boolean */
  return thing && thing instanceof Error;
}
export isError;


function isEmpty(thing) {
  /* Check if a thing is nullish (undefined, null or void(0)).
  Returns a boolean. */
  return thing == null;
}
export isEmpty;


function enforceReducerEnd(reducer) {
  /*
  Transform a reducer function, handling and enforcing "end of source"
  scenarios.

  Returns a reducer function. */

  // Closure variable keeps track of whether reduction has already happened on
  // the source that is being reduced.
  var isEnded = false;

  function nextUntilEnd(accumulated, item) {
    // After a source is ended, it should not send further items. Throw an
    // exception if further items are sent.
    if (isEnded) throw new Error('Source attempted to send item after it ended');

    // Accumulate item with `next`. Note that item may be error. This is
    // intentional since errors mark end of source, and some reducers may need
    // to react to end of stream.
    var reduction = reducer(accumulated, item);

    // If item is an error, source is ended.
    // Likewise, if reducer passed back a result that is an error, source is ended.
    isEnded = (isError(item) || isError(reduction));

    // If ended, return last accumulated value boxed, so we know it is finished.
    // 
    // Note that this means the final reduction step will happen twice, but since
    // the result of both steps is the same, it doesn't matter.
    // 
    // If neither source nor reducer passed an error, return result of reducer
    // and continue reduction.
    return reduction;
  }

  return nextUntilEnd;
}


function swallowReducerEnd(reducer) {
  function nextSwallowEnd(accumulated, item) {
    // A new reducer that will call original reducer as long as item is not
    // an error.
    return !isError(item) ? reducer(accumulated, item) : accumulated;
  }

  return nextSwallowEnd;
}


/* Create a future object to be used as the prototype for future reducible
values.

@TODO I should either handle multiple reductions on futures, or prevent
multiple reductions on pending futures. */
var __future__ = reducible(function futureReduce(next, initial) {
  // Uses instance to keep track of things.
  var future = this;

  // If future has been delivered, return the final reduction of the true value.
  if (!isEmpty(future.value)) return reduce(future.value, next, initial);

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
  return reducible(function futureReduce(next, initial) {
    next = enforceReducerEnd(swallowReducerEnd(next));

    var f = create(__future__);

    function forward(accumulated, item) {
      // If source is exausted and sends error, or reducer returns an error,
      // deliver final accumulation. Otherwise, continue accumulation.
      var reduction = next(accumulated, item);
      var isEnded = isError(item) || isError(reduction);
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


function merge(source) {
  /**
  Merges given collection of collections to a collection with items of
  all nested collections. Note that items in the resulting collection
  are ordered by the time rather then index, in other words if item from
  the second nested collection is deliver earlier then the item
  from first nested collection it will in appear earlier in the resulting
  collection.

  merge([ [1, 2], [3, 4] ])
  => < 1 2 3 4 >

  @TODO this implementation is wrong, but I think the idea is basically right.
  **/
  return reducible(function accumulateMerged(next, initial) {
    // Closure variables that `forward` has access to.
    var open = 1;
    var accumulated = initial;

    function forward(accumulated, item) {
      open = open - 1;
      return next(accumulated, item);
    }

    function accumulateMergedSource(accumulated, nested) {
      open = open + 1;
      return reduce(nested, forward, accumulated);
    }

    var acccumulated = reduce(source, accumulateMergedSource, initial);
    return reduce(accumulated, forward, initial)
  });
}
export merge;
