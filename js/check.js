// check page: what is this address, is the checksum right, and (for bitcoin and litecoin) what's in it

(function (TG) {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var DONATION = "bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4";
  var input = $("input");
  var token = 0;
  var timer = null;

  function run() {
    var mine = ++token;
    var value = input.value.trim();
    var list = $("matches");
    list.textContent = "";
    $("chain").textContent = "";
    clearTimeout(timer);

    if (!value) {
      $("status").textContent = "waiting for an address...";
      return;
    }

    var hits = TG.identify(value);
    if (!hits.length) {
      $("status").textContent = "✗ not thatguy-shaped. typo? unsupported coin? just vibes?";
      return;
    }

    $("status").textContent = "✓ valid format for " + hits.length + (hits.length === 1 ? " thing" : " things") +
      (value === DONATION ? " (and it's the donation address, thank you <3)" : "");
    hits.forEach(function (coin) {
      var li = document.createElement("li");
      li.appendChild(document.createTextNode(coin.name + " (" + coin.ticker + ") · " + coin.type));
      var url = TG.chain.explorer(coin, value);
      if (url) {
        var link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "look it up";
        li.appendChild(document.createTextNode(" · "));
        li.appendChild(link);
      }
      list.appendChild(li);
    });

    var lookable = hits.filter(function (c) { return TG.chain.canLookup(c); })[0];
    if (!lookable) return;

    $("chain").textContent = "asking the " + lookable.name.toLowerCase() + " blockchain...";
    timer = setTimeout(function () {
      TG.chain.lookup(lookable, value).then(function (info) {
        if (mine !== token) return;
        $("chain").textContent = info.txCount
          ? "on-chain: used in " + info.txCount + (info.txCount === 1 ? " tx" : " txs") + ", balance " + info.amount
          : "on-chain: never used (yet)";
      }, function () {
        if (mine === token) $("chain").textContent = "couldn't reach the blockchain right now";
      });
    }, 400);
  }

  function fill(value) {
    input.value = value;
    run();
  }

  // swap one character so the checksum breaks
  function breakIt(address) {
    for (var tries = 0; tries < 20; tries++) {
      var pos = 4 + TG.enc.randomInt(address.length - 8);
      var ch = address[pos];
      var swap = ch === "q" ? "p" : ch === "Q" ? "P" : ch === "2" ? "3" : "q";
      var broken = address.slice(0, pos) + swap + address.slice(pos + 1);
      if (!TG.identify(broken).length) return broken;
    }
    return address.slice(0, -1) + "!";
  }

  function randomLive() {
    var live = TG.coins.filter(function (c) { return TG.chain.isLive(c); });
    return live[TG.enc.randomInt(live.length)];
  }

  input.addEventListener("input", run);
  $("real").addEventListener("click", function () {
    $("status").textContent = "digging...";
    TG.makeReal(randomLive()).then(function (r) { fill(r.address); }, function () {
      $("status").textContent = "couldn't reach that blockchain right now, try again";
    });
  });
  $("broken").addEventListener("click", function () { fill(breakIt(TG.make(TG.pickCoin()))); });
  $("donate").addEventListener("click", function () { fill(DONATION); });

  run();
})(window.TG);
