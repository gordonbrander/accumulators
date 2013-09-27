function preload(src) {
  return reducible(function preloadReduce(next, initial) {
    function handler(event) {
      next(initial, event);
    }

    var img = new Image();
    img.onload = handler;
    img.src = src;
  });
}

function preloadAll(srcs) {
  return into(map(srcs, preload));
}