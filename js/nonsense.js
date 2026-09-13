// the important stuff: vibes, luck, fortunes, fake prices, emoji

(function (TG) {
  "use strict";

  var FORTUNES = [
    "number go up",
    "few understand",
    "probably nothing",
    "gm",
    "this is not financial advice. this is not advice. this is barely a website.",
    "wen moon? not this address",
    "diamond hands detected",
    "the chart looks like a chart",
    "somewhere out there, another guy is also that guy",
    "have you tried turning the blockchain off and on again",
    "this address has never been rugged",
    "zero sats, zero problems",
    "hodl on tight",
    "the mempool believes in you",
    "a whale just blinked",
    "not your keys, not anyone's keys",
    "satoshi would have refreshed too",
    "bullish on refreshing",
    "this one feels lucky. it isn't.",
    "gas is free in here",
    "you are now that guy",
    "block confirmed (in spirit)",
    "your portfolio is now diversified across 1 random address",
    "wagmi",
    "ngmi (this address, specifically)",
    "sideways is a direction too",
    "the halving is always coming",
    "every address is a vibe",
    "hash rate: yes",
    "checksum valid. life choices: unverified.",
    "somebody paid 10,000 btc for two pizzas. you paid nothing for this.",
    "1 thatguy = 1 thatguy",
    "the private key is in another castle",
    "this address is carbon neutral because it does nothing",
    "buy high, sell never, refresh often",
    "you have been visited by the address of good fortune",
    "left curve, right curve, same address",
    "this address is ready for the bull run. it is not invited.",
    "down only (the scroll bar)",
    "the real crypto was the refreshes we made along the way"
  ];

  var VIBES = [
    "bullish", "bearish", "crabwise", "moon-adjacent", "rekt", "degen", "comfy",
    "wagmi", "ngmi", "sideways", "hopium", "copium", "based", "suspiciously calm",
    "rug-proof", "fud-resistant", "early", "late", "exit liquidity", "down bad",
    "up only", "touching grass", "ser", "gigabrain"
  ];

  var EMOJI = [
    "🚀", "🌕", "💎", "🙌", "🐋", "🐂", "🐻", "🔥", "📈", "📉", "🧊", "🪙",
    "💸", "🦀", "🍌", "🧠", "👀", "🎲", "🔑", "🔒", "⚡", "🌊", "🍕", "🐸",
    "🦍", "🌈", "🧃", "🎯", "🛸", "🍀", "🥚", "🧱"
  ];

  function hashOf(str) {
    return TG.sha256(TG.utf8(str));
  }

  // ---------- storage that never throws ----------

  TG.store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode, whatever */ }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) { /* same */ }
    }
  };

  // ---------- nonsense ----------

  TG.fortune = function () {
    return FORTUNES[TG.enc.randomInt(FORTUNES.length)];
  };

  TG.luck = function (address) {
    return hashOf(address)[0] % 101;
  };

  TG.vibe = function (address) {
    return VIBES[hashOf(address)[1] % VIBES.length];
  };

  TG.mostCommon = function (address) {
    var counts = {}, best = "", n = 0;
    for (var i = 0; i < address.length; i++) {
      var ch = address[i];
      counts[ch] = (counts[ch] || 0) + 1;
      if (counts[ch] > n) { n = counts[ch]; best = ch; }
    }
    return "\"" + best + "\" ×" + n;
  };

  TG.bruteForce = function (bits) {
    // 1 trillion guesses per second, forever
    var log10 = bits * Math.log10(2) - 12 - Math.log10(31557600);
    var exp = Math.floor(log10);
    var mant = Math.pow(10, log10 - exp);
    return "about " + mant.toFixed(1) + " × 10^" + exp + " years at a trillion guesses/sec";
  };

  TG.views = {
    normal: function (a) { return a; },
    spaced: function (a) { return a.match(/.{1,4}/g).join(" "); },
    emoji: function (a) {
      return Array.from(a).map(function (ch) { return EMOJI[ch.charCodeAt(0) % EMOJI.length]; }).join("");
    },
    backwards: function (a) { return a.split("").reverse().join(""); },
    shouting: function (a) { return a.toUpperCase() + "!!!"; },
    binary: function (a) {
      return Array.from(TG.utf8(a)).map(function (b) { return ("0000000" + b.toString(2)).slice(-8); }).join(" ");
    }
  };

  TG.viewNames = Object.keys(TG.views);

  // fake coin, fake price, real random walk
  TG.fakePrice = function () {
    var before = TG.store.get("tg-price", 0.000042);
    var after = before * (1 + (Math.random() - 0.5) * 0.2);
    if (!(after > 1e-9 && after < 1e9)) after = 0.000042;
    TG.store.set("tg-price", after);
    var change = (after / before - 1) * 100;
    return "$" + after.toFixed(8) + " (" + (change >= 0 ? "▲ " : "▼ ") + Math.abs(change).toFixed(1) +
      "%) · not a real coin, not a real price";
  };

  TG.bump = function (n) {
    var count = TG.store.get("tg-count", 0) + (n || 1);
    TG.store.set("tg-count", count);
    return count;
  };

  TG.history = {
    list: function () {
      return TG.store.get("tg-history", []);
    },
    add: function (coin, address) {
      var items = TG.history.list();
      items.unshift({ name: coin.name, ticker: coin.ticker, type: coin.type, address: address });
      TG.store.set("tg-history", items.slice(0, 10));
    },
    clear: function () {
      TG.store.remove("tg-history");
    }
  };

  TG.duration = function (ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    s = s % 60;
    return (h ? h + "h " : "") + (h || m ? m + "m " : "") + s + "s";
  };

  // tiny 8x8 mirrored identicon
  TG.blockie = function (canvas, address) {
    var h = hashOf(address);
    var ctx = canvas.getContext("2d");
    var hue = Math.round(h[0] / 255 * 360);
    ctx.clearRect(0, 0, 8, 8);
    ctx.fillStyle = "hsl(" + hue + ", 60%, 50%)";
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 4; x++) {
        if ((h[1 + y] >> x) & 1) {
          ctx.fillRect(x, y, 1, 1);
          ctx.fillRect(7 - x, y, 1, 1);
        }
      }
    }
  };

  TG.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand("copy")) resolve(); else reject(new Error("copy failed"));
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(ta);
    });
  };

  TG.flash = function (button, text) {
    var original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = text;
    clearTimeout(button._t);
    button._t = setTimeout(function () { button.textContent = original; }, 1200);
  };
})(window.TG = window.TG || {});
