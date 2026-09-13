// batch page: lots of addresses at once

(function (TG) {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var MAX = 500;
  var running = false;
  var lastRows = [];

  TG.fillCoinSelect($("coin"), true);

  function csvField(value) {
    return "\"" + String(value).replace(/"/g, "\"\"") + "\"";
  }

  function render() {
    var format = $("format").value;
    var text;
    if (format === "json") {
      text = JSON.stringify(lastRows, null, 2);
    } else if (format === "csv") {
      text = "coin,ticker,format,source,address\n" + lastRows.map(function (r) {
        return [r.coin, r.ticker, r.format, r.source, r.address].map(csvField).join(",");
      }).join("\n");
    } else {
      text = lastRows.map(function (r) { return r.address; }).join("\n");
    }
    $("out").value = text;
  }

  function run() {
    if (running) return;
    running = true;
    $("go").disabled = true;

    var n = Math.max(1, Math.min(MAX, parseInt($("count").value, 10) || 1));
    $("count").value = n;

    var started = performance.now();
    var rows = [];
    var real = 0;
    var skipped = 0;
    var gaveUp = {};
    var i = 0;

    function add(coin, address, source) {
      rows.push({ coin: coin.name, ticker: coin.ticker, format: coin.type, source: source, address: address });
    }

    function fetchReal(coin) {
      $("status").textContent = "digging real addresses out of the blockchains... " + i + "/" + n;
      return TG.makeReal(coin, 25).then(function (r) {
        add(coin, r.address, "real, from " + r.item.via);
        real++;
      }, function () {
        gaveUp[coin.id] = true;
        skipped++;
      });
    }

    function next() {
      while (i < n) {
        var coin = $("coin").value === "random" ? TG.pickCoin() : TG.findCoin($("coin").value);
        i++;
        if (!TG.chain.isLive(coin)) {
          add(coin, TG.make(coin), "made up (monero hides addresses)");
        } else if (gaveUp[coin.id]) {
          skipped++;
        } else {
          return fetchReal(coin).then(next);
        }
      }
      finish();
    }

    function finish() {
      lastRows = rows;
      render();
      var total = TG.bump(rows.length);
      $("status").textContent = "found " + rows.length + " addresses (" + real + " real) in " +
        ((performance.now() - started) / 1000).toFixed(1) + "s." +
        (skipped ? " skipped " + skipped + ": the api couldn't find enough of that kind, or said no." : "") +
        " lifetime total: " + total + ".";
      running = false;
      $("go").disabled = false;
    }

    next();
  }

  $("go").addEventListener("click", run);
  $("format").addEventListener("change", render);
  $("copy").addEventListener("click", function () {
    TG.copy($("out").value).then(
      function () { TG.flash($("copy"), "copied!"); },
      function () { TG.flash($("copy"), "couldn't copy"); }
    );
  });

  run();
})(window.TG);
