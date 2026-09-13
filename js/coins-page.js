// coins page: one fresh example of every format

(function (TG) {
  "use strict";

  var round = 0;

  function cell(row, content) {
    var td = document.createElement("td");
    if (typeof content === "string") td.textContent = content;
    else td.appendChild(content);
    row.appendChild(td);
    return td;
  }

  function build() {
    var mine = ++round;
    var tbody = document.getElementById("rows");
    tbody.textContent = "";

    TG.coins.forEach(function (coin) {
      var tr = document.createElement("tr");

      var link = document.createElement("a");
      link.href = "index.html?coin=" + encodeURIComponent(coin.id);
      link.textContent = coin.name;

      var code = document.createElement("code");
      code.style.wordBreak = "break-all";

      cell(tr, link);
      cell(tr, coin.ticker);
      cell(tr, coin.type);
      cell(tr, code);
      var length = cell(tr, "");
      var source = cell(tr, "");
      tbody.appendChild(tr);

      function fill(address, label) {
        code.textContent = address;
        length.textContent = String(address.length);
        source.textContent = label;
      }

      if (!TG.chain.isLive(coin)) {
        fill(TG.make(coin), "made up (monero hides addresses)");
        return;
      }

      code.textContent = "digging...";
      TG.makeReal(coin).then(function (r) {
        if (mine === round) fill(r.address, "real, from " + r.item.via);
      }, function () {
        if (mine === round) fill(TG.make(coin), "made up (the api said no)");
      });
    });

    TG.bump(TG.coins.length);
  }

  document.getElementById("total").textContent =
    TG.coins.length + " formats across " + TG.networkCount() + " coins. every one is real except monero.";
  document.getElementById("reroll").addEventListener("click", build);
  build();
})(window.TG);
