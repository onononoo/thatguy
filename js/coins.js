// every address format thatguy knows how to make (and check)

(function (TG) {
  "use strict";

  var E = TG.enc;
  var XRP58 = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
  var BASE32_UPPER = E.BASE32.toUpperCase();

  function ss58sum(data) {
    return TG.blake2b(E.concat(TG.utf8("SS58PRE"), data), 64).slice(0, 2);
  }

  function nanoSum(pub) {
    return TG.blake2b(pub, 5).reverse();
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
        return E.bech32Encode(p.hrp, E.convertBits(E.concat(p.header, E.random(p.len)), 8, 5, true), "");
      },
      check: function (a, p) {
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

    cashaddr: {
      make: function (p) {
        return E.cashaddrEncode("bitcoincash", p.type, E.random(20));
      },
      check: function (a, p) {
        if (a.indexOf(":") < 0) a = "bitcoincash:" + a;
        var d = E.cashaddrDecode(a);
        return !!d && d.prefix === "bitcoincash" && d.type === p.type && d.hash.length === 20;
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

    nano: {
      make: function () {
        var pub = E.random(32);
        return "nano_" + E.bitsEncode(pub, 4, E.NANO32) + E.bitsEncode(nanoSum(pub), 0, E.NANO32);
      },
      check: function (a) {
        var m = /^(?:nano|xrb)_([13][13456789abcdefghijkmnopqrstuwxyz]{59})$/.exec(a);
        if (!m) return false;
        var pub = E.bitsDecode(m[1].slice(0, 52), 32, E.NANO32);
        var sum = E.bitsDecode(m[1].slice(52), 5, E.NANO32);
        return !!pub && !!sum && E.equal(nanoSum(pub), sum);
      }
    },

    filecoin: {
      make: function () {
        var payload = E.random(20);
        return "f1" + E.base32(E.concat(payload, TG.blake2b(E.concat([1], payload), 4)));
      },
      check: function (a) {
        if (a.slice(0, 2) !== "f1") return false;
        var d = E.unbase32(a.slice(2));
        return !!d && d.length === 24 && E.equal(TG.blake2b(E.concat([1], d.slice(0, 20)), 4), d.slice(20));
      }
    },

    ton: {
      make: function (p) {
        var body = E.concat([p.tag, 0], E.random(32));
        var crc = TG.crc16(body);
        return E.base64url(E.concat(body, [crc >> 8, crc & 255]));
      },
      check: function (a, p) {
        var d = E.unbase64url(a);
        if (!d || d.length !== 36 || d[0] !== p.tag || d[1] !== 0) return false;
        var crc = TG.crc16(d.slice(0, 34));
        return d[34] === crc >> 8 && d[35] === (crc & 255);
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

  // [network, ticker, format, family, params]
  var LIST = [
    ["Bitcoin", "BTC", "legacy (p2pkh)", "base58check", { prefix: [0x00], len: 20 }],
    ["Bitcoin", "BTC", "script (p2sh)", "base58check", { prefix: [0x05], len: 20 }],
    ["Bitcoin", "BTC", "native segwit (p2wpkh)", "segwit", { hrp: "bc", version: 0, len: 20 }],
    ["Bitcoin", "BTC", "segwit script (p2wsh)", "segwit", { hrp: "bc", version: 0, len: 32 }],
    ["Bitcoin", "BTC", "taproot (p2tr)", "segwit", { hrp: "bc", version: 1, len: 32 }],

    ["Bitcoin Testnet", "tBTC", "legacy (p2pkh)", "base58check", { prefix: [0x6f], len: 20 }],
    ["Bitcoin Testnet", "tBTC", "script (p2sh)", "base58check", { prefix: [0xc4], len: 20 }],
    ["Bitcoin Testnet", "tBTC", "native segwit (p2wpkh)", "segwit", { hrp: "tb", version: 0, len: 20 }],
    ["Bitcoin Testnet", "tBTC", "taproot (p2tr)", "segwit", { hrp: "tb", version: 1, len: 32 }],

    ["Litecoin", "LTC", "legacy (p2pkh)", "base58check", { prefix: [0x30], len: 20 }],
    ["Litecoin", "LTC", "script (p2sh)", "base58check", { prefix: [0x32], len: 20 }],
    ["Litecoin", "LTC", "native segwit (p2wpkh)", "segwit", { hrp: "ltc", version: 0, len: 20 }],

    ["Dogecoin", "DOGE", "legacy (p2pkh)", "base58check", { prefix: [0x1e], len: 20 }],
    ["Dogecoin", "DOGE", "script (p2sh)", "base58check", { prefix: [0x16], len: 20 }],

    ["Bitcoin Cash", "BCH", "cashaddr (p2pkh)", "cashaddr", { type: 0, len: 20 }],
    ["Bitcoin Cash", "BCH", "cashaddr (p2sh)", "cashaddr", { type: 1, len: 20 }],

    ["Dash", "DASH", "legacy (p2pkh)", "base58check", { prefix: [0x4c], len: 20 }],
    ["Dash", "DASH", "script (p2sh)", "base58check", { prefix: [0x10], len: 20 }],

    ["Bitcoin Gold", "BTG", "legacy (p2pkh)", "base58check", { prefix: [0x26], len: 20 }],
    ["Bitcoin Gold", "BTG", "script (p2sh)", "base58check", { prefix: [0x17], len: 20 }],

    ["Zcash", "ZEC", "transparent (t1)", "base58check", { prefix: [0x1c, 0xb8], len: 20 }],
    ["Zcash", "ZEC", "transparent script (t3)", "base58check", { prefix: [0x1c, 0xbd], len: 20 }],

    ["DigiByte", "DGB", "legacy (p2pkh)", "base58check", { prefix: [0x1e], len: 20 }],
    ["DigiByte", "DGB", "native segwit (p2wpkh)", "segwit", { hrp: "dgb", version: 0, len: 20 }],

    ["Ravencoin", "RVN", "legacy (p2pkh)", "base58check", { prefix: [0x3c], len: 20 }],
    ["Namecoin", "NMC", "legacy (p2pkh)", "base58check", { prefix: [0x34], len: 20 }],
    ["Peercoin", "PPC", "legacy (p2pkh)", "base58check", { prefix: [0x37], len: 20 }],
    ["Vertcoin", "VTC", "native segwit (p2wpkh)", "segwit", { hrp: "vtc", version: 0, len: 20 }],
    ["Qtum", "QTUM", "legacy (p2pkh)", "base58check", { prefix: [0x3a], len: 20 }],
    ["Komodo", "KMD", "legacy (p2pkh)", "base58check", { prefix: [0x3c], len: 20 }],

    ["Ethereum", "ETH", "account (eip-55)", "evm", { len: 20 }],
    ["BNB Smart Chain", "BNB", "account (eip-55)", "evm", { len: 20 }],
    ["Polygon", "POL", "account (eip-55)", "evm", { len: 20 }],
    ["Arbitrum One", "ETH", "account (eip-55)", "evm", { len: 20 }],
    ["Optimism", "ETH", "account (eip-55)", "evm", { len: 20 }],
    ["Base", "ETH", "account (eip-55)", "evm", { len: 20 }],
    ["Avalanche C-Chain", "AVAX", "account (eip-55)", "evm", { len: 20 }],
    ["Ethereum Classic", "ETC", "account (eip-55)", "evm", { len: 20 }],

    ["TRON", "TRX", "account", "base58check", { prefix: [0x41], len: 20 }],
    ["XRP Ledger", "XRP", "classic address", "base58check", { prefix: [0x00], len: 20, alphabet: XRP58 }],

    ["Tezos", "XTZ", "tz1 (ed25519)", "base58check", { prefix: [6, 161, 159], len: 20 }],
    ["Tezos", "XTZ", "tz2 (secp256k1)", "base58check", { prefix: [6, 161, 161], len: 20 }],
    ["Tezos", "XTZ", "tz3 (p-256)", "base58check", { prefix: [6, 161, 164], len: 20 }],

    ["Stellar", "XLM", "account (G...)", "stellar", { len: 32 }],

    ["Polkadot", "DOT", "account (ss58)", "ss58", { prefix: 0, len: 32 }],
    ["Kusama", "KSM", "account (ss58)", "ss58", { prefix: 2, len: 32 }],
    ["Substrate", "SUB", "generic account (ss58)", "ss58", { prefix: 42, len: 32 }],

    ["Nano", "XNO", "account", "nano", { len: 32 }],
    ["Filecoin", "FIL", "secp256k1 (f1)", "filecoin", { len: 20 }],

    ["TON", "TON", "bounceable (EQ)", "ton", { tag: 0x11, len: 32 }],
    ["TON", "TON", "non-bounceable (UQ)", "ton", { tag: 0x51, len: 32 }],

    ["Solana", "SOL", "account", "solana", { len: 32 }],
    ["Aptos", "APT", "account", "hex", { prefix: "0x", len: 32 }],
    ["Sui", "SUI", "account", "hex", { prefix: "0x", len: 32 }],
    ["NEAR", "NEAR", "implicit account", "hex", { prefix: "", len: 32 }],

    ["Cosmos Hub", "ATOM", "account", "bech32", { hrp: "cosmos", header: [], len: 20 }],
    ["Osmosis", "OSMO", "account", "bech32", { hrp: "osmo", header: [], len: 20 }],
    ["Celestia", "TIA", "account", "bech32", { hrp: "celestia", header: [], len: 20 }],

    ["Cardano", "ADA", "base address", "bech32", { hrp: "addr", header: [0x01], len: 56 }],
    ["Cardano", "ADA", "enterprise address", "bech32", { hrp: "addr", header: [0x61], len: 28 }]
  ];

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
