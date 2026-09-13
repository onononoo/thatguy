# prolly my brokest project ever. i fuck with tomoko. 



# thatguy

a real crypto address from a real stranger, every time you refresh.

HEAD
## features

every address comes live from its coin's actual blockchain through free public apis, straight from your browser. the one exception is monero: its blockchain hides every address, so monero addresses are made up (valid checksum, valid keys, no owner).

**do not send anything to any of these addresses.** the real ones belong to strangers. the made-up ones belong to nobody.
b27c875 (updates)

## coins

19 coins, 33 address formats, alphabetical:

| coin | formats | where the real addresses come from |
|---|---|---|
| avalanche (AVAX) | C-Chain, X-Chain, P-Chain | publicnode, api.avax.network |
| bitcoin (BTC) | legacy, p2sh, native segwit, p2wsh, taproot | mempool.space, blockstream.info |
| bnb (BNB) | BNB Smart Chain | publicnode |
| cardano (ADA) | base address | api.handle.me (ada handle owners) |
| chainlink (LINK) | ERC-20 | publicnode (ethereum) |
| dogecoin (DOGE) | legacy, p2sh | blockcypher, blockchair |
| ethereum (ETH) | account | publicnode |
| litecoin (LTC) | legacy, p2sh, native segwit | litecoinspace.org |
| monero (XMR) | standard, subaddress | made up |
| polkadot (DOT) | account | polkadot asset hub rpc |
| shiba inu (SHIB) | ERC-20 | publicnode (ethereum) |
| solana (SOL) | account | publicnode |
| stellar (XLM) | account | horizon.stellar.org |
| sui (SUI) | account | publicnode |
| tether (USDT) | ERC-20, TRC-20, SPL | publicnode, trongrid |
| tron (TRX) | account | trongrid |
| usd coin (USDC) | ERC-20, SPL | publicnode |
| xrp (XRP) | classic address | xrplcluster.com |
| zcash (ZEC) | t1, t3 | blockchair |

tokens (USDT, USDC, LINK, SHIB) don't have addresses of their own, so thatguy picks people who just sent or received them. smart contracts are filtered out.

if an api is down or you hit its free limit (blockchair's is small), the page shows a made-up address and says so.

## pages

- **thatguy**: one address, with a copy button, view modes (emoji, backwards, shouting, mocking, binary, morse, tomoko...) and stats nobody asked for, including the live balance for bitcoin and litecoin
- **coins**: a fresh real example of every format
- **batch**: up to 500 at a time as plain text, csv or json
- **check**: paste an address to see which coins it matches and whether the checksum adds up
- **faq**: questions nobody asked

plain html, no styling, no dependencies, no build step, no trackers.

## run it locally

open `index.html`. that's it. it also works on github pages or any static host. you need internet for the real addresses.

## files

```
index.html, coins.html, batch.html, check.html, faq.html, tomoko.html, donate.html
js/hash.js        sha-256, keccak-256, blake2b, crc16
js/encode.js      base58, monero base58, bech32, base32, eip-55
js/coins.js       the coins and formats, plus make/check for each
js/chain.js       where the real addresses come from, one source per coin
js/nonsense.js    luck, fortunes, the fake price, emoji
js/footer.js      the donation copy button
js/donate.js      the click-to-copy address on the donate page
js/main.js, js/coins-page.js, js/batch.js, js/check.js   one per page
logos/            coin logos from web3icons (MIT, see logos/LICENSE.txt)
```

## donate

this project is open source, so please donate to keep all of my projects up! :) : bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4

all of my projects! :] : https://github.com/onononoo/
                                                                                                             























does anybody read this :: its called a readme :( i hope u guys read this and **donate to my cryptocurrency** 
