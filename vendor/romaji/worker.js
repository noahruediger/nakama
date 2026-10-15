// Turns Japanese names into romaji off the main page, so loading the dictionary never freezes the app.
importScripts('kuroshiro.min.js', 'kuroshiro-analyzer-kuromoji.min.js');
var ready = (function () {
  var K = self.Kuroshiro.default || self.Kuroshiro, A = self.KuromojiAnalyzer.default || self.KuromojiAnalyzer;
  var dict = 'dict/'; // relative to this worker file (kuromoji mangles full URLs)
  var k = new K();
  return k.init(new A({ dictPath: dict })).then(function () { return k; });
})();
self.onmessage = function (e) {
  var names = e.data.names || [];
  ready.then(function (k) {
    return Promise.all(names.map(function (n) {
      return k.convert(n, { to: 'romaji', mode: 'spaced', romajiSystem: 'hepburn' }).then(function (v) { return [n, v]; }, function () { return [n, '']; });
    }));
  }).then(function (pairs) { self.postMessage({ id: e.data.id, pairs: pairs }); },
    function (err) { self.postMessage({ id: e.data.id, error: String(err && err.message || err) }); });
};
