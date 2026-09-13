// real addresses, dug out of public blockchains through free public apis.
// every coin has a "source" that fetches a batch of real addresses. the batch goes
// into a small stash in local storage, so most refreshes never touch the network.
// monero has no source: its blockchain hides every address.

(function (TG) {
  "use strict";

  var E = TG.enc;

  var POOL_KEY = "tg-chain-pool-v2";
  var POOL_TTL = 15 * 60 * 1000;
  var MAX_POOL = 3000;
  var PATIENCE = 4;
  var TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

  var used = {};
  var queue = Promise.resolve();

  // ---------- plumbing ----------

  function randInt(n) {
    return E.randomInt(n);
  }

  function pick(list) {
    return list[randInt(list.length)];
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function fromHex(hex) {
    hex = hex.replace(/^0x/, "");
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function hostOf(url) {
    return url.split("/")[2];
  }

  // opts: { post: true, body: {...}, headers: {...} }
  function fetchJSON(url, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 10000);
    var init = { signal: ctrl.signal, headers: opts.headers || {} };
    if (opts.post || opts.body !== undefined) init.method = "POST";
    if (opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error(hostOf(url) + " said " + res.status);
      return res.json();
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // a list of interchangeable api base urls. tries them in order, remembers the one that worked.
  function hosts(list) {
    var current = 0;
    return {
      get: function (path, opts) {
        var tried = 0;
        function attempt() {
          var index = (current + tried) % list.length;
          return fetchJSON(list[index] + path, opts).then(function (data) {
            current = index;
            return data;
          }, function (err) {
            if (++tried >= list.length) throw err;
            return attempt();
          });
        }
        return attempt();
      },
      name: function () {
        return hostOf(list[current]);
      }
    };
  }

  function rpc(h, method, params) {
    return h.get("", { body: { jsonrpc: "2.0", id: 1, method: method, params: params } }).then(function (d) {
      if (d.error) throw new Error(d.error.message || "rpc error");
      if (d.result === undefined || (d.result && d.result.code && d.result.message)) throw new Error("rpc said no");
      return d.result;
    });
  }

  // returns add(coinId, address, via): keeps only valid, unseen addresses
  function adder(items) {
    var seen = {};
    items.forEach(function (it) { seen[it.id + " " + it.a] = true; });
    return function (id, address, via) {
      if (typeof address !== "string") return;
      var key = id + " " + address;
      if (seen[key] || used[key]) return;
      var coin = TG.findCoin(id);
      if (!coin || !TG.check(coin, address)) return;
      seen[key] = true;
      items.push({ id: id, a: address, via: via, at: Date.now() });
    };
  }

  // ---------- sources ----------

  // bitcoin-style chains with an esplora api (mempool.space and friends)
  function esplora(h, types) {
    var blocks = null, blocksAt = 0;
    return function (items) {
      var add = adder(items);
      var recent = blocks && Date.now() - blocksAt < 60000
        ? Promise.resolve(blocks)
        : h.get("/blocks").then(function (list) {
          blocks = list.filter(function (b) { return b.tx_count > 1; });
          blocksAt = Date.now();
          if (!blocks.length) throw new Error("no recent blocks");
          return blocks;
        });
      return recent.then(function (list) {
        var block = pick(list);
        return h.get("/block/" + block.id + "/txs/" + randInt(Math.ceil(block.tx_count / 25)) * 25);
      }).then(function (txs) {
        txs.forEach(function (tx) {
          tx.vout.concat(tx.vin.map(function (v) { return v.prevout; })).forEach(function (s) {
            if (s && types[s.scriptpubkey_type]) add(types[s.scriptpubkey_type], s.scriptpubkey_address, h.name());
          });
        });
      });
    };
  }

  // evm chains: whoever sent a transaction in a recent block
  function evmSenders(h, id) {
    return function (items) {
      var add = adder(items);
      return rpc(h, "eth_blockNumber", []).then(function (n) {
        var height = parseInt(n, 16) - randInt(30);
        return rpc(h, "eth_getBlockByNumber", ["0x" + height.toString(16), true]);
      }).then(function (block) {
        ((block && block.transactions) || []).forEach(function (tx) {
          if (tx.from) add(id, E.eip55(tx.from.slice(2).toLowerCase()), h.name());
        });
      });
    };
  }

  // erc-20 tokens: people who sent or received the token recently. contracts are skipped
  // (they have code), so only plain wallets are left.
  function erc20(h, contract, id, span) {
    return function (items) {
      var add = adder(items);
      return rpc(h, "eth_blockNumber", []).then(function (n) {
        var to = parseInt(n, 16) - randInt(50);
        return rpc(h, "eth_getLogs", [{
          fromBlock: "0x" + (to - span).toString(16),
          toBlock: "0x" + to.toString(16),
          address: contract,
          topics: [TRANSFER]
        }]);
      }).then(function (logs) {
        var candidates = {};
        shuffle(logs).slice(0, 30).forEach(function (log) {
          [log.topics[1], log.topics[2]].forEach(function (t) {
            if (t && !/^0x0+$/.test(t)) candidates["0x" + t.slice(26)] = true;
          });
        });
        var list = Object.keys(candidates).slice(0, 20);
        return h.get("", {
          body: list.map(function (a, i) {
            return { jsonrpc: "2.0", id: i, method: "eth_getCode", params: [a, "latest"] };
          })
        }).then(function (answers) {
          (Array.isArray(answers) ? answers : []).forEach(function (r) {
            if (r.result === "0x") add(id, E.eip55(list[r.id].slice(2)), h.name());
          });
        });
      });
    };
  }

  // solana: signers of recent transactions, or wallets that hold a token
  function solana(h, watch, id, mint) {
    return function (items) {
      var add = adder(items);
      return rpc(h, "getSignaturesForAddress", [watch, { limit: 25 }]).then(function (sigs) {
        var chosen = shuffle(sigs.filter(function (s) { return !s.err; })).slice(0, 3);
        return Promise.all(chosen.map(function (s) {
          return rpc(h, "getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])
            .then(function (tx) {
              if (!tx) return;
              if (mint) {
                ((tx.meta && tx.meta.postTokenBalances) || []).forEach(function (b) {
                  // wallets are points on the curve; program-owned accounts are not
                  var bytes = b.mint === mint && b.owner && E.unbase58(b.owner);
                  if (bytes && bytes.length === 32 && TG.isEdPoint(bytes)) add(id, b.owner, h.name());
                });
              } else {
                tx.transaction.message.accountKeys.forEach(function (k) {
                  if (k.signer) add(id, k.pubkey, h.name());
                });
              }
            }, function () {});
        }));
      });
    };
  }

  // tron: trx transfers, and usdt (trc-20) transfer calls
  var USDT_TRON = "41a614f803b6fd780986a42c78ec9c7f77e6ded13c";

  function tron(h) {
    var latest = 0;
    function tronAddress(hex) {
      return E.base58check(fromHex(hex));
    }
    return function (items) {
      var add = adder(items);
      var block = latest
        ? h.get("/wallet/getblockbynum", { body: { num: latest - randInt(200) } })
        : h.get("/wallet/getnowblock", { post: true });
      return block.then(function (b) {
        if (!latest) latest = b.block_header.raw_data.number;
        (b.transactions || []).forEach(function (tx) {
          var c = tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0];
          if (!c) return;
          var v = c.parameter.value;
          if (c.type === "TransferContract") {
            add("tron-account", tronAddress(v.owner_address), h.name());
            add("tron-account", tronAddress(v.to_address), h.name());
          } else if (c.type === "TriggerSmartContract" && v.contract_address === USDT_TRON &&
                     v.data && v.data.slice(0, 8) === "a9059cbb") {
            add("tether-trc-20-on-tron", tronAddress(v.owner_address), h.name());
            add("tether-trc-20-on-tron", tronAddress("41" + v.data.slice(32, 72)), h.name());
          }
        });
      });
    };
  }

  // xrp ledger: accounts in a recent validated ledger
  function xrp(h) {
    var latest = 0;
    return function (items) {
      var add = adder(items);
      var index = latest ? latest - randInt(100) : "validated";
      return h.get("", { body: { method: "ledger", params: [{ ledger_index: index, transactions: true, expand: true }] } })
        .then(function (d) {
          var ledger = d.result && d.result.ledger;
          if (!ledger) throw new Error("no ledger");
          if (!latest) latest = parseInt(ledger.ledger_index, 10);
          (ledger.transactions || []).forEach(function (tx) {
            add("xrp-classic-address", tx.Account, h.name());
            add("xrp-classic-address", tx.Destination, h.name());
          });
        });
    };
  }

  // blockchair: recent outputs. the free tier is small, so it's used sparingly
  var blockchair = hosts(["https://api.blockchair.com"]);

  function blockchairOutputs(chain, types, scriptId) {
    return function (items, coin) {
      var add = adder(items);
      var onlyScripts = coin.id === scriptId ? "&q=type(scripthash)" : "";
      return blockchair.get("/" + chain + "/outputs?limit=100&s=block_id(desc)" + onlyScripts).then(function (d) {
        ((d && d.data) || []).forEach(function (o) {
          if (types[o.type]) add(types[o.type], o.recipient, "blockchair.com");
        });
      });
    };
  }

  // dogecoin: blockcypher's recent transactions first, blockchair for script addresses or as a backup
  var DOGE = { pubkeyhash: "dogecoin-legacy-p2pkh", scripthash: "dogecoin-script-p2sh" };
  var dogeChair = blockchairOutputs("dogecoin", DOGE, DOGE.scripthash);
  var blockcypher = hosts(["https://api.blockcypher.com"]);

  function dogecoin(items, coin) {
    if (coin.id === DOGE.scripthash) return dogeChair(items, coin);
    var add = adder(items);
    return blockcypher.get("/v1/doge/main/txs?limit=100").then(function (txs) {
      txs.forEach(function (tx) {
        (tx.inputs || []).concat(tx.outputs || []).forEach(function (io) {
          (io.addresses || []).forEach(function (a) { add(DOGE.pubkeyhash, a, "blockcypher.com"); });
        });
      });
    }, function () {
      return dogeChair(items, coin);
    });
  }

  // cardano: wallet addresses of people who own an ada handle
  var handles = hosts(["https://api.handle.me"]);

  function cardano(items) {
    var add = adder(items);
    return handles.get("/handles?records_per_page=100&page=" + (1 + randInt(3000)), { headers: { Accept: "application/json" } })
      .then(function (list) {
        (Array.isArray(list) ? list : []).forEach(function (hd) {
          if (hd.holder_type !== "wallet") return;
          add("cardano-base-address", hd.holder, "api.handle.me");
          add("cardano-base-address", hd.resolved_addresses && hd.resolved_addresses.ada, "api.handle.me");
        });
      });
  }

  // stellar: accounts behind the latest operations
  var horizon = hosts(["https://horizon.stellar.org"]);

  function stellar(items) {
    var add = adder(items);
    return horizon.get("/operations?order=desc&limit=200").then(function (d) {
      ((d._embedded && d._embedded.records) || []).forEach(function (op) {
        ["source_account", "from", "to", "account", "funder", "into", "trustor"].forEach(function (k) {
          if (op[k]) add("stellar-account-g", op[k], horizon.name());
        });
      });
    });
  }

  // sui: senders of recent transactions, paging further back each time
  var suiHosts = hosts(["https://sui-rpc.publicnode.com", "https://fullnode.mainnet.sui.io"]);
  var suiCursor = null;

  function sui(items) {
    var add = adder(items);
    return rpc(suiHosts, "suix_queryTransactionBlocks", [{ options: { showInput: true } }, suiCursor, 50, true])
      .then(function (page) {
        suiCursor = page.hasNextPage ? page.nextCursor : null;
        page.data.forEach(function (tx) {
          var sender = tx.transaction && tx.transaction.data.sender;
          if (sender && !/^0x0+$/.test(sender)) add("sui-account", sender, suiHosts.name());
        });
      });
  }

  // polkadot: every account lives in System.Account storage, keyed by
  // blake2_128(account) ++ account. start reading at a random spot and take what's there.
  var ACCOUNTS = "0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9";
  var dotHosts = hosts(["https://polkadot-asset-hub-rpc.polkadot.io", "https://rpc.polkadot.io"]);

  function polkadot(items) {
    var add = adder(items);
    return rpc(dotHosts, "state_getKeysPaged", [ACCOUNTS, 50, ACCOUNTS + E.hex(E.random(16))]).then(function (keys) {
      keys.forEach(function (key) {
        add("polkadot-account-ss58", TG.ss58(0, fromHex(key.slice(-64))), dotHosts.name());
      });
    });
  }

  // avalanche x-chain and p-chain: every address mentioned in a recent block
  function avalanche(url, heightMethod, blockMethod, id) {
    var h = hosts([url]);
    return function (items) {
      var add = adder(items);
      return rpc(h, heightMethod, {}).then(function (r) {
        var height = Math.max(1, parseInt(r.height, 10) - randInt(40));
        return rpc(h, blockMethod, { height: String(height), encoding: "json" });
      }).then(function (r) {
        (JSON.stringify(r.block || {}).match(/[XP]-avax1[02-9ac-hj-np-z]{38}/g) || []).forEach(function (a) {
          add(id, a, h.name());
        });
      });
    };
  }

  var bitcoin = hosts(["https://mempool.space/api", "https://blockstream.info/api"]);
  var litecoin = hosts(["https://litecoinspace.org/api"]);
  var eth = hosts(["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"]);
  var bsc = hosts(["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org"]);
  var avaxC = hosts(["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"]);
  var sol = hosts(["https://solana-rpc.publicnode.com"]);

  var bitcoinSource = esplora(bitcoin, {
    p2pkh: "bitcoin-legacy-p2pkh",
    p2sh: "bitcoin-script-p2sh",
    v0_p2wpkh: "bitcoin-native-segwit-p2wpkh",
    v0_p2wsh: "bitcoin-segwit-script-p2wsh",
    v1_p2tr: "bitcoin-taproot-p2tr"
  });
  var litecoinSource = esplora(litecoin, {
    p2pkh: "litecoin-legacy-p2pkh",
    p2sh: "litecoin-script-p2sh",
    v0_p2wpkh: "litecoin-native-segwit-p2wpkh"
  });
  var tronSource = tron(hosts(["https://api.trongrid.io", "https://tron-rpc.publicnode.com"]));
  var zcashSource = blockchairOutputs("zcash",
    { pubkeyhash: "zcash-transparent-t1", scripthash: "zcash-transparent-script-t3" }, "zcash-transparent-script-t3");

  // coin id -> source
  var SOURCES = {
    "avalanche-c-chain-account": evmSenders(avaxC, "avalanche-c-chain-account"),
    "avalanche-x-chain-address": avalanche("https://api.avax.network/ext/bc/X", "avm.getHeight", "avm.getBlockByHeight", "avalanche-x-chain-address"),
    "avalanche-p-chain-address": avalanche("https://api.avax.network/ext/bc/P", "platform.getHeight", "platform.getBlockByHeight", "avalanche-p-chain-address"),
    "bitcoin-legacy-p2pkh": bitcoinSource,
    "bitcoin-script-p2sh": bitcoinSource,
    "bitcoin-native-segwit-p2wpkh": bitcoinSource,
    "bitcoin-segwit-script-p2wsh": bitcoinSource,
    "bitcoin-taproot-p2tr": bitcoinSource,
    "bnb-bnb-smart-chain-account": evmSenders(bsc, "bnb-bnb-smart-chain-account"),
    "cardano-base-address": cardano,
    "chainlink-erc-20-on-ethereum": erc20(eth, "0x514910771AF9Ca656af840dff83E8264EcF986CA", "chainlink-erc-20-on-ethereum", 150),
    "dogecoin-legacy-p2pkh": dogecoin,
    "dogecoin-script-p2sh": dogecoin,
    "ethereum-account-eip-55": evmSenders(eth, "ethereum-account-eip-55"),
    "litecoin-legacy-p2pkh": litecoinSource,
    "litecoin-script-p2sh": litecoinSource,
    "litecoin-native-segwit-p2wpkh": litecoinSource,
    "polkadot-account-ss58": polkadot,
    "shiba-inu-erc-20-on-ethereum": erc20(eth, "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "shiba-inu-erc-20-on-ethereum", 150),
    "solana-account": solana(sol, "11111111111111111111111111111111", "solana-account", null),
    "stellar-account-g": stellar,
    "sui-account": sui,
    "tether-erc-20-on-ethereum": erc20(eth, "0xdAC17F958D2ee523a2206206994597C13D831ec7", "tether-erc-20-on-ethereum", 4),
    "tether-trc-20-on-tron": tronSource,
    "tether-spl-on-solana": solana(sol, "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "tether-spl-on-solana", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    "tron-account": tronSource,
    "usd-coin-erc-20-on-ethereum": erc20(eth, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "usd-coin-erc-20-on-ethereum", 4),
    "usd-coin-spl-on-solana": solana(sol, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "usd-coin-spl-on-solana", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    "xrp-classic-address": xrp(hosts(["https://xrplcluster.com"])),
    "zcash-transparent-t1": zcashSource,
    "zcash-transparent-script-t3": zcashSource
  };

  // where to look an address up (matched against the start of the coin id)
  var EXPLORERS = {
    "avalanche-c-chain": "https://snowtrace.io/address/",
    "bitcoin": "https://mempool.space/address/",
    "bnb": "https://bscscan.com/address/",
    "cardano": "https://cardanoscan.io/address/",
    "chainlink": "https://etherscan.io/token/0x514910771AF9Ca656af840dff83E8264EcF986CA?a=",
    "dogecoin": "https://blockchair.com/dogecoin/address/",
    "ethereum": "https://etherscan.io/address/",
    "litecoin": "https://litecoinspace.org/address/",
    "polkadot": "https://assethub-polkadot.subscan.io/account/",
    "shiba-inu": "https://etherscan.io/token/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE?a=",
    "solana": "https://solscan.io/account/",
    "stellar": "https://stellar.expert/explorer/public/account/",
    "sui": "https://suiscan.xyz/mainnet/account/",
    "tether-erc-20": "https://etherscan.io/token/0xdAC17F958D2ee523a2206206994597C13D831ec7?a=",
    "tether-trc-20": "https://tronscan.org/#/address/",
    "tether-spl": "https://solscan.io/account/",
    "tron": "https://tronscan.org/#/address/",
    "usd-coin-erc-20": "https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48?a=",
    "usd-coin-spl": "https://solscan.io/account/",
    "xrp": "https://xrpscan.com/account/",
    "zcash": "https://blockchair.com/zcash/address/"
  };

  // coins whose balance can be looked up right here (esplora apis)
  var BALANCES = { bitcoin: bitcoin, litecoin: litecoin };

  // ---------- the stash ----------

  // one thing at a time, so parallel callers share refills instead of stampeding an api
  function serial(fn) {
    var run = queue.then(fn, fn);
    queue = run.catch(function () {});
    return run;
  }

  function loadPool() {
    var items = TG.store.get(POOL_KEY, []);
    var now = Date.now();
    return (Array.isArray(items) ? items : []).filter(function (it) {
      return it && it.id && it.a && now - it.at < POOL_TTL;
    });
  }

  function savePool(items) {
    TG.store.set(POOL_KEY, items.slice(-MAX_POOL));
  }

  function take(coin, patience) {
    var source = SOURCES[coin.id];
    return serial(function () {
      var items = loadPool();
      var refills = 0;
      var lastError = null;
      function attempt() {
        var matches = [];
        items.forEach(function (it, i) { if (it.id === coin.id) matches.push(i); });
        if (matches.length) {
          var item = items.splice(pick(matches), 1)[0];
          used[item.id + " " + item.a] = true;
          savePool(items);
          return item;
        }
        if (refills++ >= (patience || PATIENCE)) {
          savePool(items);
          throw lastError || new Error("no real " + coin.type + " addresses turned up");
        }
        return source(items, coin).catch(function (err) { lastError = err; }).then(attempt);
      }
      return attempt();
    });
  }

  function explorerPrefix(coin) {
    for (var key in EXPLORERS) {
      if (coin.id.indexOf(key) === 0) return EXPLORERS[key];
    }
    return null;
  }

  TG.chain = {
    isLive: function (coin) {
      return !!SOURCES[coin.id];
    },
    explorer: function (coin, address) {
      var prefix = explorerPrefix(coin);
      return prefix ? prefix + address : null;
    },
    canLookup: function (coin) {
      return !!BALANCES[coin.id.split("-")[0]];
    },
    lookup: function (coin, address) {
      var h = BALANCES[coin.id.split("-")[0]];
      return h.get("/address/" + encodeURIComponent(address)).then(function (d) {
        var c = d.chain_stats, m = d.mempool_stats;
        var sats = c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum;
        return { txCount: c.tx_count + m.tx_count, amount: (sats / 1e8).toFixed(8) + " " + coin.ticker };
      });
    }
  };

  // real address when there's a source, made-up address otherwise (monero).
  // patience = how many batches to fetch before giving up
  TG.makeReal = function (coin, patience) {
    if (!SOURCES[coin.id]) return Promise.resolve({ address: TG.make(coin), item: null });
    return take(coin, patience).then(function (item) {
      return { address: item.a, item: item };
    });
  };
})(window.TG);
