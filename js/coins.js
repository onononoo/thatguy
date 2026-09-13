// every address format thatguy knows how to make (and check)

(function (TG) {
  "use strict";

  var E = TG.enc;
  var XRP58 = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
  var BASE32_UPPER = E.BASE32.toUpperCase();

  function ss58sum(data) {
    return TG.blake2b(E.concat(TG.utf8("SS58PRE"), data), 64).slice(0, 2);
  }

  // ---------- ed25519 point check (monero wallets reject keys that aren't on the curve) ----------

  var P = (1n << 255n) - 19n;

  function mod(n) {
    n %= P;
    return n < 0n ? n + P : n;
  }

  function pow(b, e) {
    var r = 1n;
    b = mod(b);
    while (e > 0n) {
      if (e & 1n) r = r * b % P;
      b = b * b % P;
      e >>= 1n;
    }
    return r;
  }

  var D = mod(-121665n * pow(121666n, P - 2n));

  function isEdPoint(bytes) {
    var y = 0n;
    for (var i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
    y &= (1n << 255n) - 1n;
    if (y >= P) return false;
    var y2 = y * y % P;
    var u = mod(y2 - 1n);
    var v = mod(D * y2 + 1n);
    var v3 = v * v % P * v % P;
    var x = u * v3 % P * pow(u * v3 % P * v3 % P * v % P, (P - 5n) / 8n) % P;
    var vx2 = v * x % P * x % P;
    return vx2 === u || vx2 === mod(-u);
  }

  function randomEdPoint() {
    for (;;) {
      var bytes = E.random(32);
      if (isEdPoint(bytes)) return bytes;
    }
  }

  // a family knows how to make an address from params, and how to check one
  var families = {
    base58check: {
      make: function (p) {
        return E.base58check(E.concat(p.prefix, E.random(p.len)), p.alphabet);
      },
      check: function (a, p) {
        var d = E.unbase58check(a, p.alphabet);
        return !!d && d.length === p.prefix.length + p.len && E.startsWith(d, p.prefix);
      }
    },

    segwit: {
      make: function (p) {
        return E.segwitEncode(p.hrp, p.version, E.random(p.len));
      },
      check: function (a, p) {
        var d = E.segwitDecode(p.hrp, a);
        return !!d && d.version === p.version && d.program.length === p.len;
      }
    },

    bech32: {
      make: function (p) {
        return (p.chain || "") +
          E.bech32Encode(p.hrp, E.convertBits(E.concat(p.header, E.random(p.len)), 8, 5, true), "");
      },
      check: function (a, p) {
        if (p.chain) {
          if (a.slice(0, p.chain.length) !== p.chain) return false;
          a = a.slice(p.chain.length);
        }
        var d = E.bech32Decode(a);
        if (!d || d.hrp !== p.hrp || d.variant !== "") return false;
        var bytes = E.convertBits(d.data, 5, 8, false);
        return !!bytes && bytes.length === p.header.length + p.len && E.startsWith(bytes, p.header);
      }
    },

    evm: {
      make: function () {
        return E.eip55(E.hex(E.random(20)));
      },
      check: function (a) {
        if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return false;
        var body = a.slice(2);
        if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
        return E.eip55(body.toLowerCase()) === a;
      }
    },

    stellar: {
      make: function () {
        var payload = E.concat([6 << 3], E.random(32));
        var crc = TG.crc16(payload);
        return E.base32(E.concat(payload, [crc & 255, crc >> 8]), BASE32_UPPER);
      },
      check: function (a) {
        var d = E.unbase32(a, BASE32_UPPER);
        if (!d || d.length !== 35 || d[0] !== 6 << 3) return false;
        var crc = TG.crc16(d.slice(0, 33));
        return d[33] === (crc & 255) && d[34] === crc >> 8;
      }
    },

    ss58: {
      make: function (p) {
        var data = E.concat([p.prefix], E.random(32));
        return E.base58(E.concat(data, ss58sum(data)));
      },
      check: function (a, p) {
        var d = E.unbase58(a);
        return !!d && d.length === 35 && d[0] === p.prefix && E.equal(ss58sum(d.slice(0, 33)), d.slice(33));
      }
    },

    monero: {
      make: function (p) {
        var data = E.concat([p.prefix], randomEdPoint(), randomEdPoint());
        return E.moneroBase58(E.concat(data, TG.keccak256(data).slice(0, 4)));
      },
      check: function (a, p) {
        if (!/^[1-9A-HJ-NP-Za-km-z]{95}$/.test(a)) return false;
        var d = E.unmoneroBase58(a);
        return !!d && d.length === 69 && d[0] === p.prefix &&
          E.equal(TG.keccak256(d.slice(0, 65)).slice(0, 4), d.slice(65)) &&
          isEdPoint(d.slice(1, 33)) && isEdPoint(d.slice(33, 65));
      }
    },

    hex: {
      make: function (p) {
        return p.prefix + E.hex(E.random(p.len));
      },
      check: function (a, p) {
        return new RegExp("^" + p.prefix + "[0-9a-f]{" + p.len * 2 + "}$").test(a);
      }
    },

    solana: {
      make: function () {
        return E.base58(E.random(32));
      },
      check: function (a) {
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return false;
        var d = E.unbase58(a);
        return !!d && d.length === 32;
      }
    }
  };

  // [name, ticker, format, family, params]
  // tokens (USDT, USDC, LINK, SHIB) don't have their own addresses: you hold them at an
  // ordinary address on the chain they live on, so their formats are that chain's.
  // kept in alphabetical order by name (and sorted again below, just in case)
  var LIST = [
    ["Avalanche", "AVAX", "C-Chain account", "evm", { len: 20 }],
    ["Avalanche", "AVAX", "X-Chain address", "bech32", { chain: "X-", hrp: "avax", header: [], len: 20 }],
    ["Avalanche", "AVAX", "P-Chain address", "bech32", { chain: "P-", hrp: "avax", header: [], len: 20 }],

    ["Bitcoin", "BTC", "legacy (p2pkh)", "base58check", { prefix: [0x00], len: 20 }],
    ["Bitcoin", "BTC", "script (p2sh)", "base58check", { prefix: [0x05], len: 20 }],
    ["Bitcoin", "BTC", "native segwit (p2wpkh)", "segwit", { hrp: "bc", version: 0, len: 20 }],
    ["Bitcoin", "BTC", "segwit script (p2wsh)", "segwit", { hrp: "bc", version: 0, len: 32 }],
    ["Bitcoin", "BTC", "taproot (p2tr)", "segwit", { hrp: "bc", version: 1, len: 32 }],

    ["BNB", "BNB", "BNB Smart Chain account", "evm", { len: 20 }],

    ["Cardano", "ADA", "base address", "bech32", { hrp: "addr", header: [0x01], len: 56 }],

    ["Chainlink", "LINK", "ERC-20 (on Ethereum)", "evm", { len: 20 }],

    ["Dogecoin", "DOGE", "legacy (p2pkh)", "base58check", { prefix: [0x1e], len: 20 }],
    ["Dogecoin", "DOGE", "script (p2sh)", "base58check", { prefix: [0x16], len: 20 }],

    ["Ethereum", "ETH", "account (eip-55)", "evm", { len: 20 }],

    ["Litecoin", "LTC", "legacy (p2pkh)", "base58check", { prefix: [0x30], len: 20 }],
    ["Litecoin", "LTC", "script (p2sh)", "base58check", { prefix: [0x32], len: 20 }],
    ["Litecoin", "LTC", "native segwit (p2wpkh)", "segwit", { hrp: "ltc", version: 0, len: 20 }],

    ["Monero", "XMR", "standard address", "monero", { prefix: 18, len: 32 }],
    ["Monero", "XMR", "subaddress", "monero", { prefix: 42, len: 32 }],

    ["Polkadot", "DOT", "account (ss58)", "ss58", { prefix: 0, len: 32 }],

    ["Shiba Inu", "SHIB", "ERC-20 (on Ethereum)", "evm", { len: 20 }],

    ["Solana", "SOL", "account", "solana", { len: 32 }],

    ["Stellar", "XLM", "account (G...)", "stellar", { len: 32 }],

    ["Sui", "SUI", "account", "hex", { prefix: "0x", len: 32 }],

    ["Tether", "USDT", "ERC-20 (on Ethereum)", "evm", { len: 20 }],
    ["Tether", "USDT", "TRC-20 (on TRON)", "base58check", { prefix: [0x41], len: 20 }],
    ["Tether", "USDT", "SPL (on Solana)", "solana", { len: 32 }],

    ["TRON", "TRX", "account", "base58check", { prefix: [0x41], len: 20 }],

    ["USD Coin", "USDC", "ERC-20 (on Ethereum)", "evm", { len: 20 }],
    ["USD Coin", "USDC", "SPL (on Solana)", "solana", { len: 32 }],

    ["XRP", "XRP", "classic address", "base58check", { prefix: [0x00], len: 20, alphabet: XRP58 }],

    ["Zcash", "ZEC", "transparent (t1)", "base58check", { prefix: [0x1c, 0xb8], len: 20 }],
    ["Zcash", "ZEC", "transparent script (t3)", "base58check", { prefix: [0x1c, 0xbd], len: 20 }]
  ];

  // sort by name only; formats of the same coin keep their order (sort is stable)
  LIST.sort(function (a, b) {
    return a[0].localeCompare(b[0], "en", { sensitivity: "base" });
  });

  TG.coins = LIST.map(function (row) {
    return {
      id: (row[0] + "-" + row[2]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: row[0],
      ticker: row[1],
      type: row[2],
      family: row[3],
      params: row[4],
      bits: Math.min(row[4].len * 8, 256)
    };
  });

  TG.isEdPoint = isEdPoint;

  TG.ss58 = function (prefix, pubkey) {
    var data = E.concat([prefix], pubkey);
    return E.base58(E.concat(data, ss58sum(data)));
  };

  TG.findCoin = function (id) {
    for (var i = 0; i < TG.coins.length; i++) if (TG.coins[i].id === id) return TG.coins[i];
    return null;
  };

  TG.pickCoin = function () {
    return TG.coins[E.randomInt(TG.coins.length)];
  };

  TG.make = function (coin) {
    return families[coin.family].make(coin.params);
  };

  TG.check = function (coin, address) {
    try {
      return families[coin.family].check(String(address).trim(), coin.params);
    } catch (e) {
      return false;
    }
  };

  TG.identify = function (address) {
    return TG.coins.filter(function (coin) { return TG.check(coin, address); });
  };

  TG.networkCount = function () {
    var seen = {};
    TG.coins.forEach(function (c) { seen[c.name] = true; });
    return Object.keys(seen).length;
  };

  TG.fillCoinSelect = function (select, withRandom) {
    if (withRandom) select.add(new Option("random (surprise me)", "random"));
    var groups = {};
    TG.coins.forEach(function (c) {
      if (!groups[c.name]) {
        groups[c.name] = document.createElement("optgroup");
        groups[c.name].label = c.name + " (" + c.ticker + ")";
        select.appendChild(groups[c.name]);
      }
      groups[c.name].appendChild(new Option(c.type, c.id));
    });
  };
})(window.TG = window.TG || {});
