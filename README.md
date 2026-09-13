# thatguy

a website that shows a random, validly formatted crypto address every time you refresh.

## features

- 60 address formats across 41 networks: bitcoin (legacy, p2sh, segwit, p2wsh, taproot, testnet), litecoin, dogecoin, bitcoin cash, dash, zcash, ethereum and friends, tron, xrp, tezos, stellar, polkadot, kusama, nano, filecoin, ton, solana, aptos, sui, near, cosmos, cardano and more
- every checksum is real: base58check, bech32, bech32m, eip-55, cashaddr, ss58, crc16, blake2b
- **thatguy**: one random address, with a blockie, a copy button, view modes (emoji, backwards, shouting, binary...) and stats nobody asked for
- **coins**: a fresh example of every format
- **batch**: up to 500 at a time as plain text, csv or json
- **check**: paste an address to see which formats it matches and whether the checksum adds up
- **faq**: questions nobody asked
- no dependencies, no build step, no trackers. it all runs in the browser

## run it locally

open `index.html`. that's it. it also works on github pages or any static host.

## files

```
index.html      the main page
coins.html      every supported format
batch.html      lots of addresses at once
check.html      address checker
faq.html        faq
css/style.css   the one stylesheet
js/hash.js      sha-256, keccak-256, blake2b, crc16
js/encode.js    base58, bech32, cashaddr, base32, base64url, eip-55
js/coins.js     the list of formats, plus make/check for each
js/nonsense.js  luck, vibes, fortunes, the fake price, emoji
js/main.js      main page
js/coins-page.js, js/batch.js, js/check.js   the other pages
```

## donate

this project is open source, so please donate to keep all of my projects up! :) : bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4

source code and all of my projects! :] : https://github.com/onononoo/thatguy :: https://github.com/onononoo/
