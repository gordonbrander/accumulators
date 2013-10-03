import { reducible, map } from "reducers";

function preload(src) {
  return reducible(function preloadReduce(next, initial) {
    function handler(event) {
      next(next(initial, event), new Error("Image loaded."));
    }

    var img = new Image();
    img.onload = handler;
    img.src = src;
  });
}
export preload;

function preloadAll(srcs) {
  return map(srcs, preload);
}
export preloadAll;