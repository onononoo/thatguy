// batch page: lots of addresses at once

(function (TG) {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var MAX = 500;

  TG.fillCoinSelect($("coin"), true);

  function csvField(value) {
    return "\"" + String(value).replace(/"/g, "\"\"") + "\"";
  }

  function run() {
    var n = Math.max(1, Math.min(MAX, parseInt($("count").value, 10) || 1));
    $("count").value = n;

    var started = performance.now();
    var rows = [];
    for (var i = 0; i < n; i++) {
      var coin = $("coin").value === "random" ? TG.pickCoin() : TG.findCoin($("coin").value);
      rows.push({ network: coin.name, ticker: coin.ticker, format: coin.type, address: TG.make(coin) });
    }
    var ms = performance.now() - started;

    var text;
    if ($("format").value === "json") {
      text = JSON.stringify(rows, null, 2);
    } else if ($("format").value === "csv") {
      text = "network,ticker,format,address\n" + rows.map(function (r) {
        return [r.network, r.ticker, r.format, r.address].map(csvField).join(",");
      }).join("\n");
    } else {
      text = rows.map(function (r) { return r.address; }).join("\n");
    }

    $("out").value = text;
    var total = TG.bump(n);
    $("status").textContent = "made " + n + " addresses in " + ms.toFixed(0) + " ms. lifetime total: " +
      total + ". combined balance: 0.";
  }

  $("go").addEventListener("click", run);
  $("format").addEventListener("change", run);
  $("copy").addEventListener("click", function () {
    TG.copy($("out").value).then(
      function () { TG.flash($("copy"), "copied!"); },
      function () { TG.flash($("copy"), "couldn't copy"); }
    );
  });

  run();
})(window.TG);
