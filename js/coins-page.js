// coins page: one fresh example of every format

(function (TG) {
  "use strict";

  function cell(row, content) {
    var td = document.createElement("td");
    if (typeof content === "string") td.textContent = content;
    else td.appendChild(content);
    row.appendChild(td);
  }

  function build() {
    var tbody = document.getElementById("rows");
    tbody.textContent = "";
    TG.coins.forEach(function (coin) {
      var address = TG.make(coin);
      var tr = document.createElement("tr");

      var link = document.createElement("a");
      link.href = "index.html?coin=" + encodeURIComponent(coin.id);
      link.textContent = coin.name;

      var code = document.createElement("code");
      code.textContent = address;

      cell(tr, link);
      cell(tr, coin.ticker);
      cell(tr, coin.type);
      cell(tr, code);
      cell(tr, String(address.length));
      tbody.appendChild(tr);
    });
    TG.bump(TG.coins.length);
  }

  document.getElementById("total").textContent =
    TG.coins.length + " formats across " + TG.networkCount() + " networks";
  document.getElementById("reroll").addEventListener("click", build);
  build();
})(window.TG);
