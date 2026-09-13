// index page

(function (TG) {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var coinSelect = $("coin");
  var viewSelect = $("view");
  var startedAt = Date.now();
  var current = null;

  TG.fillCoinSelect(coinSelect, true);
  TG.viewNames.forEach(function (name) { viewSelect.add(new Option(name, name)); });

  var wanted = new URLSearchParams(location.search).get("coin") || TG.store.get("tg-coin", "random");
  coinSelect.value = TG.findCoin(wanted) ? wanted : "random";
  viewSelect.value = TG.views[TG.store.get("tg-view")] ? TG.store.get("tg-view") : "normal";

  function showAddress() {
    $("address").textContent = TG.views[viewSelect.value](current.address);
  }

  function generate() {
    var coin = coinSelect.value === "random" ? TG.pickCoin() : TG.findCoin(coinSelect.value);
    var address = TG.make(coin);
    current = { coin: coin, address: address };

    showAddress();
    $("coin-name").textContent = coin.name + " (" + coin.ticker + ") · " + coin.type;
    TG.blockie($("blockie"), address);

    $("checksum").textContent = TG.check(coin, address) ? "valid ✓" : "invalid ✗ (this should never happen)";
    $("length").textContent = address.length + " characters";
    $("luck").textContent = TG.luck(address) + "/100";
    $("vibe").textContent = TG.vibe(address);
    $("fortune").textContent = TG.fortune();
    $("common").textContent = TG.mostCommon(address);
    $("brute").textContent = TG.bruteForce(coin.bits);
    $("price").textContent = TG.fakePrice();
    $("count").textContent = TG.bump();

    TG.history.add(coin, address);
    renderHistory();
  }

  function renderHistory() {
    var list = $("history");
    list.textContent = "";
    var items = TG.history.list();
    items.forEach(function (item) {
      var li = document.createElement("li");
      var code = document.createElement("code");
      code.textContent = item.address;
      var label = document.createElement("span");
      label.className = "muted";
      label.textContent = " · " + item.ticker + " " + item.type;
      li.appendChild(code);
      li.appendChild(label);
      list.appendChild(li);
    });
    $("clear").hidden = !items.length;
  }

  function copy() {
    TG.copy(current.address).then(
      function () { TG.flash($("copy"), "copied!"); },
      function () { TG.flash($("copy"), "couldn't copy"); }
    );
  }

  function cycleView() {
    var i = TG.viewNames.indexOf(viewSelect.value);
    viewSelect.value = TG.viewNames[(i + 1) % TG.viewNames.length];
    viewSelect.dispatchEvent(new Event("change"));
  }

  coinSelect.addEventListener("change", function () {
    TG.store.set("tg-coin", coinSelect.value);
    generate();
  });

  viewSelect.addEventListener("change", function () {
    TG.store.set("tg-view", viewSelect.value);
    showAddress();
  });

  $("again").addEventListener("click", generate);
  $("copy").addEventListener("click", copy);
  $("refresh").addEventListener("click", function () { location.reload(); });
  $("clear").addEventListener("click", function () {
    TG.history.clear();
    renderHistory();
  });

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName)) return;
    if (e.key === " " || e.key === "n") { e.preventDefault(); generate(); }
    else if (e.key === "c") copy();
    else if (e.key === "v") cycleView();
  });

  setInterval(function () {
    $("hodl").textContent = TG.duration(Date.now() - startedAt);
  }, 1000);

  generate();
})(window.TG);
