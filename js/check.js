// check page: what is this address, and is the checksum right

(function (TG) {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var DONATION = "bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4";
  var input = $("input");

  function run() {
    var value = input.value.trim();
    var list = $("matches");
    list.textContent = "";

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
      li.textContent = coin.name + " (" + coin.ticker + ") · " + coin.type;
      list.appendChild(li);
    });
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

  input.addEventListener("input", run);
  $("random").addEventListener("click", function () { fill(TG.make(TG.pickCoin())); });
  $("broken").addEventListener("click", function () { fill(breakIt(TG.make(TG.pickCoin()))); });
  $("donate").addEventListener("click", function () { fill(DONATION); });

  run();
})(window.TG);
