// encodings: base58(check), monero base58, bech32(m), base32, eip-55

(function (TG) {
  "use strict";

  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  var BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
  var BECH32M = 0x2bc830a3;

  // ---------- bytes ----------

  function random(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  function randomInt(n) {
    return crypto.getRandomValues(new Uint32Array(1))[0] % n;
  }

  function concat() {
    var total = 0, i;
    for (i = 0; i < arguments.length; i++) total += arguments[i].length;
    var out = new Uint8Array(total), off = 0;
    for (i = 0; i < arguments.length; i++) {
      out.set(arguments[i], off);
      off += arguments[i].length;
    }
    return out;
  }

  function equal(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function startsWith(bytes, prefix) {
    if (bytes.length < prefix.length) return false;
    for (var i = 0; i < prefix.length; i++) if (bytes[i] !== prefix[i]) return false;
    return true;
  }

  function hex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return s;
  }

  // ---------- base58 ----------

  function base58(bytes, alphabet) {
    alphabet = alphabet || B58;
    var digits = [0];
    for (var i = 0; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) {
        carry += digits[j] * 256;
        digits[j] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }
    var z = 0;
    while (z < bytes.length && bytes[z] === 0) z++;
    var str = alphabet[0].repeat(z);
    var k = digits.length - 1;
    while (k >= 0 && digits[k] === 0) k--;
    for (; k >= 0; k--) str += alphabet[digits[k]];
    return str;
  }

  function unbase58(str, alphabet) {
    alphabet = alphabet || B58;
    var bytes = [0];
    for (var i = 0; i < str.length; i++) {
      var carry = alphabet.indexOf(str[i]);
      if (carry < 0) return null;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 255;
        carry >>= 8;
      }
      while (carry) {
        bytes.push(carry & 255);
        carry >>= 8;
      }
    }
    var z = 0;
    while (z < str.length && str[z] === alphabet[0]) z++;
    var k = bytes.length - 1;
    while (k >= 0 && bytes[k] === 0) k--;
    var out = new Uint8Array(z + k + 1);
    for (var n = z; k >= 0; k--, n++) out[n] = bytes[k];
    return out;
  }

  function base58check(bytes, alphabet) {
    return base58(concat(bytes, TG.sha256d(bytes).slice(0, 4)), alphabet);
  }

  function unbase58check(str, alphabet) {
    var d = unbase58(str, alphabet);
    if (!d || d.length < 5) return null;
    var payload = d.slice(0, -4);
    return equal(TG.sha256d(payload).slice(0, 4), d.slice(-4)) ? payload : null;
  }

  // ---------- bech32 / bech32m ----------

  function polymod(values) {
    var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    var chk = 1;
    for (var i = 0; i < values.length; i++) {
      var top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ values[i];
      for (var j = 0; j < 5; j++) if ((top >> j) & 1) chk ^= GEN[j];
    }
    return chk;
  }

  function hrpExpand(hrp) {
    var out = [], i;
    for (i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
    out.push(0);
    for (i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
    return out;
  }

  function convertBits(data, from, to, pad) {
    var acc = 0, bits = 0, out = [], max = (1 << to) - 1;
    for (var i = 0; i < data.length; i++) {
      var v = data[i];
      if (v >> from) return null;
      acc = ((acc << from) | v) & 0xffffff;
      bits += from;
      while (bits >= to) {
        bits -= to;
        out.push((acc >> bits) & max);
      }
    }
    if (pad) {
      if (bits) out.push((acc << (to - bits)) & max);
    } else if (bits >= from || ((acc << (to - bits)) & max)) {
      return null;
    }
    return out;
  }

  function bech32Encode(hrp, data, variant) {
    var mod = polymod(hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0])) ^ (variant === "m" ? BECH32M : 1);
    var str = hrp + "1", i;
    for (i = 0; i < data.length; i++) str += BECH32[data[i]];
    for (i = 0; i < 6; i++) str += BECH32[(mod >>> (5 * (5 - i))) & 31];
    return str;
  }

  function bech32Decode(str) {
    if (str !== str.toLowerCase() && str !== str.toUpperCase()) return null;
    str = str.toLowerCase();
    var pos = str.lastIndexOf("1");
    if (pos < 1 || pos + 7 > str.length) return null;
    var hrp = str.slice(0, pos), data = [];
    for (var i = pos + 1; i < str.length; i++) {
      var v = BECH32.indexOf(str[i]);
      if (v < 0) return null;
      data.push(v);
    }
    var check = polymod(hrpExpand(hrp).concat(data));
    var variant = check === 1 ? "" : check === BECH32M ? "m" : null;
    if (variant === null) return null;
    return { hrp: hrp, data: data.slice(0, -6), variant: variant };
  }

  function segwitEncode(hrp, version, program) {
    return bech32Encode(hrp, [version].concat(convertBits(program, 8, 5, true)), version === 0 ? "" : "m");
  }

  function segwitDecode(hrp, str) {
    var d = bech32Decode(str);
    if (!d || d.hrp !== hrp || !d.data.length) return null;
    var version = d.data[0];
    if ((version === 0) !== (d.variant === "")) return null;
    var program = convertBits(d.data.slice(1), 5, 8, false);
    if (!program || program.length < 2 || program.length > 40) return null;
    return { version: version, program: program };
  }

  // ---------- monero base58 (8-byte blocks) ----------

  var XMR_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];

  function moneroBase58(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 8) {
      var block = bytes.slice(i, i + 8);
      var num = 0n;
      for (var j = 0; j < block.length; j++) num = (num << 8n) | BigInt(block[j]);
      var chars = "";
      for (var k = 0; k < XMR_SIZES[block.length]; k++) {
        chars = B58[Number(num % 58n)] + chars;
        num /= 58n;
      }
      out += chars;
    }
    return out;
  }

  function unmoneroBase58(str) {
    var out = [];
    for (var i = 0; i < str.length; i += 11) {
      var chunk = str.slice(i, i + 11);
      var size = XMR_SIZES.indexOf(chunk.length);
      if (size < 1) return null;
      var num = 0n;
      for (var j = 0; j < chunk.length; j++) {
        var v = B58.indexOf(chunk[j]);
        if (v < 0) return null;
        num = num * 58n + BigInt(v);
      }
      if (num >> BigInt(size * 8)) return null;
      for (var k = size - 1; k >= 0; k--) out.push(Number((num >> BigInt(k * 8)) & 255n));
    }
    return new Uint8Array(out);
  }

  // ---------- base32 ----------

  function base32(bytes, alphabet) {
    alphabet = alphabet || BASE32;
    return convertBits(bytes, 8, 5, true).map(function (v) { return alphabet[v]; }).join("");
  }

  function unbase32(str, alphabet) {
    alphabet = alphabet || BASE32;
    var values = [];
    for (var i = 0; i < str.length; i++) {
      var v = alphabet.indexOf(str[i]);
      if (v < 0) return null;
      values.push(v);
    }
    var bytes = convertBits(values, 5, 8, false);
    return bytes ? new Uint8Array(bytes) : null;
  }

  // ---------- eip-55 ----------

  function eip55(lowerHex) {
    var hash = TG.keccak256(TG.utf8(lowerHex)), out = "0x";
    for (var i = 0; i < 40; i++) {
      var nibble = (hash[i >> 1] >> (i % 2 ? 0 : 4)) & 15;
      out += nibble >= 8 ? lowerHex[i].toUpperCase() : lowerHex[i];
    }
    return out;
  }

  TG.enc = {
    BASE32: BASE32,
    random: random,
    randomInt: randomInt,
    concat: concat,
    equal: equal,
    startsWith: startsWith,
    hex: hex,
    base58: base58,
    unbase58: unbase58,
    base58check: base58check,
    unbase58check: unbase58check,
    convertBits: convertBits,
    bech32Encode: bech32Encode,
    bech32Decode: bech32Decode,
    segwitEncode: segwitEncode,
    segwitDecode: segwitDecode,
    moneroBase58: moneroBase58,
    unmoneroBase58: unmoneroBase58,
    base32: base32,
    unbase32: unbase32,
    eip55: eip55
  };
})(window.TG = window.TG || {});
