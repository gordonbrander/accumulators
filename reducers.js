// Reducers
// -----------------------------------------------------------------------------
// Ok, I'm starting to see how reducers and continuation passing style are
// similar. Reducers moves the mechanics out into a reducible's reduce method.
// That way you're authoring functions with return values.
// 
// And I'm starting to run into map-reduce like problems with my image loader.
// It stands to reason that you would handle this type of deep asyncronicity
// with a flatten method.

// https://github.com/Gozala/reducers/
// https://github.com/Gozala/reducible

function partial(lambda) {
  /**
  Function composes new function out of given `lambda` with rest of the
  arguments curried.

  ## Example

  function sum(x, y) { return x + y }
  var inc = partial(sum, 1)

  inc(5) // => 6
  **/
  var slicer = Array.prototype.slice;
  var curried = slicer.call(arguments, 1);

  function partiallyApplied() {
    var args = slicer.call(arguments);
    args.unshift.apply(args, curried);
    return lambda.apply(this, args);
  }

  return partiallyApplied;
}
export partial;


function reducible(reduce) {
  /*
  Define a new reducible. A reducible is any object with a reduce method.
  The mechanics of _how_ the reduction happens are left up to the `reduce`
  method.
  */
  return { reduce: reduce };
}
export reducible;


function reduced(value) {
  /* Box value to mark it reduced (finished reducing).
  Returns a box object containing value. */
  return {
    value: value,
    is: reduced
  }
}


function isReduced(value) {
  /* Check if a value has been boxed with `reduced()`.
  Returns boolean. */
  return value && value.is === reduced;
}
export isReduced;


function isError(thing) {
  /* An error is any thing who's toString value is '[object Error]'.
  Returns boolean */
  return thing && thing.toString() === '[object Error]';
}
export isError;


function isEmpty(thing) {
  /* Check if a thing is nullish (undefined, null or void(0)).
  Returns a boolean. */
  return thing == null;
}
export isEmpty;


function wrapReducerEnforceEnded(reducer) {
  /*
  Transform a reducer function, handling and enforcing "end of source"
  scenarios.

  Returns a reducer function.
  */

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
    return isEnded ? reduced(accumulated) : reduction;
  }

  return nextUntilEnd;
}


function accumulate(source, next, initial) {
  /*
  Accumulate is a lower-level continuation passing style reducing function.
  In keeping with continuation passing style, `accumulate` does not return
  a value.
  
  For most cases, you will want to use `reduce`, unless you want to handle
  errors and stream ends manually.
  */

  // If source has a reduce method, reduce with that. Otherwise, simply call
  // next with initial value and source (reduction for non-reducible values).
  return source.reduce ? source.reduce(wrapReducerEnforceEnded(next), initial) :
                         next(initial, source);
}
export accumulate;


function deliver_(future, value) {
  /* Deliver a future, where future is any object with optional next and
  initial properties.

  Mutates the future and returns empty. */

  // Assign the value to the future.
  future.value = value;

  // Mark delivered.
  future.delivered = true;

  // Kick off accumulation of the value.
  if (future.next) accumulate(value, future.next, future.initial);
}


/* Define a reducible factory to be used as a futures mechanism. */
var future = partial(Object.create, reducible(function futureReduce(next, initial) {
  // Uses instance to keep track of things.
  var future = this;

  // If future has been delivered, return the final reduction of the true value.
  if (future.delivered) return accumulate(future.value, next, initial);

  // Otherwise, keep next and initial around so we can use them for the
  // eventual reduction.
  future.next = next;
  future.initial = initial;
}));


function reduce(source, next, initial) {
  /*
  `reduce` reduces a source and returns the value or another reducible 
  good for the accumulated value when ready.
  
  To access the contents of the return value, simply reduce it. It's a bit
  like a Promise in that sense.
  
  Returns a value or reducible.
  */
  var f = future();

  function forward(accumulated, item) {
    // If source is exausted and sends error, deliver accumulation.
    // Otherwise, continue accumulation.

    // @TODO this is not working with arrays that are mapped because they never
    // send an error, and map transforms them into a reducible that requires
    // an end-of-stream mark.
    return isError(item) ? deliver_(f, accumulated) :
           next(accumulated, item);
  }
  
  var accumulated = accumulate(source, forward, initial);

  if(!isEmpty(accumulated)) deliver_(f, accumulated);

  return f.delivered ? f.value : f;
}
export reduce;


function reducer(xlambda, source, additional) {
  /**
  Convenience function to simplify definitions of transformation function, to
  avoid manual definition of `reducible` results and currying transformation
  function.

  From a pure data `xlambda` function that is called on each value for a
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

  // Return a new reducible object who's reduce method transforms the `next`
  // reducing function.
  // 
  // `next` is the reducer function we are transforming. We are essentially
  // wrapping it with `xlambda` provided the value is not an error.
  return reducible(function reduceReducerTransform(next, initial) {
    accumulate(source, function sourceReducer(accumulated, item) {
      // If value is an error just propagate through to reducing function,
      // otherwise call `lambda` with all the curried `additional` and `next`
      // continuation function.
      return isError(item) ? next(accumulated, item) :
             xlambda(additional, next, accumulated, item);
    });
  });
}


var map = partial(reducer, function mapTransform(mapper, next, accumulated, item) {
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
  **/
  return reducible(function accumulateMerged(next, initial) {
    // Closure variables that `forward` has access to.
    var open = 1;
    var accumulated = initial;

    function forward(_, item) {
      if (isError(item)) {
        open = open - 1;
        if (open === 0) return next(accumulated, item);
      }
      else {
        accumulated = next(accumulated, item);
      }
      return accumulated;
    }

    accumulate(source, function accumulateMergeSource(_, nested) {
      // If there is an error or end of `source` collection just pass it
      // to `forward` it will take care of detecting whether it's error
      // or `end`. In later case it will also figure out if it's `end` of
      // result to and act appropriately.
      if (isError(nested)) return forward(null, nested);
      // If `nested` item is not end nor error just `accumulate` it via
      // `forward` that keeps track of all collections that are bing forwarded
      // to it.
      open = open + 1
      accumulate(nested, forward, null)
    })
  });
}
export merge;


function add_(array, item) {
  array.push(item);
  return array;
}


function into(source, array) {
  return reduce(source, add_, array || []);
}
