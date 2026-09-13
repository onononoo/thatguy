// index page

(function (TG) {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var coinSelect = $("coin");
  var viewSelect = $("view");
  var startedAt = Date.now();
  var current = null;
  var token = 0;

  TG.fillCoinSelect(coinSelect, true);
  TG.viewNames.forEach(function (name) { viewSelect.add(new Option(name, name)); });

  var wanted = new URLSearchParams(location.search).get("coin") || TG.store.get("tg-coin", "random");
  coinSelect.value = TG.findCoin(wanted) ? wanted : "random";
  viewSelect.value = TG.viewNames.indexOf(TG.store.get("tg-view")) >= 0 ? TG.store.get("tg-view") : "normal";

  function showAddress() {
    TG.renderView($("address"), viewSelect.value, current.address);
  }

  function generate() {
    var mine = ++token;
    var coin = coinSelect.value === "random" ? TG.pickCoin() : TG.findCoin(coinSelect.value);
    $("coin-name").textContent = coin.name + " (" + coin.ticker + ") · " + coin.type;
    $("logo").src = "logos/" + coin.ticker.toLowerCase() + ".svg";
    $("logo").alt = coin.name + " logo";
    if (TG.chain.isLive(coin)) $("address").textContent = "digging through the blockchain...";

    TG.makeReal(coin)
      .catch(function (err) {
        return { address: TG.make(coin), item: null, error: err };
      })
      .then(function (result) {
        if (mine === token) show(coin, result, mine);
      });
  }

  function show(coin, result, mine) {
    var address = result.address;
    current = { coin: coin, address: address };

    showAddress();
    showSource(coin, result, mine);

    $("checksum").textContent = TG.check(coin, address) ? "valid ✓" : "invalid ✗ (this should never happen)";
    $("length").textContent = address.length + " characters";
    $("luck").textContent = TG.luck(address) + "/100";
    $("fortune").textContent = TG.fortune();
    $("common").textContent = TG.mostCommon(address);
    $("zodiac").textContent = TG.zodiac(address);
    $("tomoko-approval").textContent = TG.tomokoApproval(address);
    $("versus").textContent = TG.digitsVsLetters(address);
    $("digit-sum").textContent = TG.digitSum(address);
    $("palindrome").textContent = TG.palindrome(address);
    $("brute").textContent = TG.bruteForce(coin.bits);
    $("price").textContent = TG.fakePrice();
    $("count").textContent = TG.bump();

    TG.history.add(coin, address, !!result.item);
    renderHistory();
  }

  function showSource(coin, result, mine) {
    var source = $("source");
    var balance = $("balance");
    source.textContent = "";

    if (!result.item) {
      if (!TG.chain.isLive(coin)) {
        source.textContent = "made up. monero hides every address on its blockchain, so there are no real ones to show";
      } else {
        source.textContent = "made up, couldn't reach the blockchain (" + result.error.message + ")";
      }
      balance.textContent = "0 (nobody has the key. do not send anything here.)";
      return;
    }

    source.appendChild(document.createTextNode("real, from " + result.item.via));
    var url = TG.chain.explorer(coin, result.address);
    if (url) {
      var link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "look it up";
      source.appendChild(document.createTextNode(" · "));
      source.appendChild(link);
    }

    var warning = " · belongs to a real stranger, don't send anything";
    if (!TG.chain.canLookup(coin)) {
      balance.textContent = "not checked here, see \"look it up\"" + warning;
      return;
    }
    balance.textContent = "checking...";
    TG.chain.lookup(coin, result.address).then(function (info) {
      if (mine !== token) return;
      balance.textContent = info.amount + " across " + info.txCount + (info.txCount === 1 ? " tx" : " txs") + warning;
    }, function () {
      if (mine === token) balance.textContent = "couldn't check (the explorer is busy)" + warning;
    });
  }

  function renderHistory() {
    var list = $("history");
    list.textContent = "";
    var items = TG.history.list();
    items.forEach(function (item) {
      var li = document.createElement("li");
      var code = document.createElement("code");
      code.textContent = item.address;
      li.appendChild(code);
      li.appendChild(document.createTextNode(" · " + item.ticker + " " + item.type + (item.real ? " (real)" : " (made up)")));
      list.appendChild(li);
    });
    $("clear").hidden = !items.length;
  }

  function copy() {
    if (!current) return;
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

  function realWorld() {
    TG.gasPrice().then(function (text) { $("gas").textContent = text; }, function () {
      $("gas").textContent = "couldn't reach fueleconomy.gov right now";
    });
    TG.ibmPrice().then(function (text) { $("ibm").textContent = text; }, function () {
      $("ibm").textContent = "couldn't reach alpha vantage right now (the free demo has a daily limit)";
    });
  }

  realWorld();
  setInterval(realWorld, 10 * 60 * 1000);

  generate();
})(window.TG);
