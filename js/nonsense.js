// the important stuff: luck, fortunes, zodiac signs, tomoko's opinion, fake prices, emoji

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
    "not your keys, not your coins. definitely not your address.",
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
    "the real crypto was the refreshes we made along the way",
    "tomoko would not approve of this address. tomoko does not approve of anything.",
    "this address has more friends than you",
    "no matter how you look at it, it's the market's fault",
    "somewhere a stranger just felt someone look at their wallet",
    "the blockchain remembers. the blockchain does not care.",
    "this address has seen things",
    "your seed phrase is safe. this website doesn't know it. neither do you, probably.",
    "have you considered touching grass? the grass is not on-chain.",
    "this refresh has been added to the permanent record (your browser history)",
    "someone mined a block for this. you're welcome, apparently.",
    "this address was not financial advice when it was created either",
    "the whales are watching. the whales are always watching.",
    "number go sideways, which is technically a direction",
    "certified random stranger moment",
    "if you stare at this address long enough it stares back",
    "the developer is broke. the donate tab exists for a reason.",
    "refresh count is a lifestyle, not a metric",
    "this wallet has never once said thank you"
  ];

  var ZODIAC = [
    "the whale", "the bull", "the bear", "the crab", "the ape", "the degen",
    "the shrimp", "the paper hand", "the diamond hand", "the rug", "the moon", "the gas fee"
  ];

  var MORSE = {
    a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---",
    k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-",
    u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----."
  };

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

  TG.zodiac = function (address) {
    return ZODIAC[hashOf(address)[2] % ZODIAC.length];
  };

  TG.digitsVsLetters = function (address) {
    var digits = (address.match(/[0-9]/g) || []).length;
    var letters = (address.match(/[a-z]/gi) || []).length;
    var winner = digits > letters ? "numbers win" : letters > digits ? "letters win" : "it's a tie, somehow";
    return digits + " numbers vs " + letters + " letters · " + winner;
  };

  TG.digitSum = function (address) {
    var sum = 0;
    (address.match(/[0-9]/g) || []).forEach(function (d) { sum += +d; });
    return sum + (sum === 42 ? " (the answer to everything)" : sum === 69 ? " (nice)" : "");
  };

  TG.palindrome = function (address) {
    var backwards = address.split("").reverse().join("");
    return address === backwards ? "yes!!! screenshot this" : "no. it never is. it never will be.";
  };

  TG.tomokoApproval = function (address) {
    var score = hashOf(address)[3] % 11;
    var mood = score === 0 ? "she looked away" : score < 4 ? "she sighed" : score < 8 ? "she didn't hate it" : score < 10 ? "she almost smiled" : "she stuck her tongue out";
    return score + "/10 · " + mood;
  };

  // each view turns the address into a string. "tomoko" is special: it's pictures.
  TG.views = {
    normal: function (a) { return a; },
    spaced: function (a) { return a.match(/.{1,4}/g).join(" "); },
    emoji: function (a) {
      return Array.from(a).map(function (ch) { return EMOJI[ch.charCodeAt(0) % EMOJI.length]; }).join("");
    },
    backwards: function (a) { return a.split("").reverse().join(""); },
    shouting: function (a) { return a.toUpperCase() + "!!!"; },
    mocking: function (a) {
      return a.split("").map(function (ch, i) { return i % 2 ? ch.toUpperCase() : ch.toLowerCase(); }).join("");
    },
    binary: function (a) {
      return Array.from(TG.utf8(a)).map(function (b) { return ("0000000" + b.toString(2)).slice(-8); }).join(" ");
    },
    morse: function (a) {
      return a.toLowerCase().split("").map(function (ch) { return MORSE[ch] || "?"; }).join(" / ");
    },
    tomoko: null
  };

  TG.viewNames = Object.keys(TG.views);

  // puts the address into el in the chosen view
  TG.renderView = function (el, name, address) {
    el.textContent = "";
    if (name !== "tomoko") {
      el.textContent = TG.views[name](address);
      return;
    }
    // one tomoko per character
    Array.from(address).forEach(function (ch) {
      var img = document.createElement("img");
      img.src = "icon.jpg";
      img.alt = ch;
      img.title = ch;
      img.style.height = "1.6em";
      img.style.verticalAlign = "middle";
      el.appendChild(img);
    });
  };

  // ---------- actual real-world numbers, for no reason ----------

  // keeps a value in local storage for maxAge. if the api fails, an old value beats nothing.
  function cached(key, maxAge, load) {
    var hit = TG.store.get(key, null);
    if (hit && Date.now() - hit.at < maxAge) return Promise.resolve(hit.value);
    return load().then(function (value) {
      TG.store.set(key, { at: Date.now(), value: value });
      return value;
    }, function (err) {
      if (hit) return hit.value;
      throw err;
    });
  }

  function getJSON(url, headers) {
    return fetch(url, { headers: headers || {} }).then(function (res) {
      if (!res.ok) throw new Error(url.split("/")[2] + " said " + res.status);
      return res.json();
    });
  }

  // gary, indiana has no free gas price api, so this is the u.s. average for regular (fueleconomy.gov, updated weekly)
  TG.gasPrice = function () {
    return cached("tg-gas", 60 * 60 * 1000, function () {
      return getJSON("https://www.fueleconomy.gov/ws/rest/fuelprices", { Accept: "application/json" }).then(function (d) {
        var regular = parseFloat(d.regular);
        if (!(regular > 0)) throw new Error("no gas price");
        return "$" + regular.toFixed(2) + "/gal regular · well, that's the u.s. average (fueleconomy.gov). gary doesn't have a free api";
      });
    });
  };

  // alpha vantage's public demo key only works for ibm, which is exactly what we need
  TG.ibmPrice = function () {
    return cached("tg-ibm", 10 * 60 * 1000, function () {
      return getJSON("https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=demo").then(function (d) {
        var q = d["Global Quote"];
        var price = q && parseFloat(q["05. price"]);
        if (!(price > 0)) throw new Error("alpha vantage said no");
        var change = parseFloat(q["10. change percent"]) || 0;
        return "$" + price.toFixed(2) + " (" + (change >= 0 ? "▲ " : "▼ ") + Math.abs(change).toFixed(2) + "%) · last trade " +
          q["07. latest trading day"] + " · alpha vantage";
      });
    });
  };

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
    add: function (coin, address, real) {
      var items = TG.history.list();
      items.unshift({ name: coin.name, ticker: coin.ticker, type: coin.type, address: address, real: !!real });
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

  TG.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return copyFallback(text); });
    }
    return copyFallback(text);
  };

  // older way, for when the clipboard api is missing or says no
  function copyFallback(text) {
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
  }

  TG.flash = function (button, text) {
    var original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = text;
    clearTimeout(button._t);
    button._t = setTimeout(function () { button.textContent = original; }, 1200);
  };
})(window.TG = window.TG || {});
