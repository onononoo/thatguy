// encodings: base58(check), bech32(m), cashaddr, base32, nano base32, base64url, eip-55

(function (TG) {
  "use strict";

  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  var BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
  var NANO32 = "13456789abcdefghijkmnopqrstuwxyz";
  var BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
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

  // ---------- cashaddr ----------

  var CASH_GEN = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

  function cashPolymod(values) {
    var c = 1n;
    for (var i = 0; i < values.length; i++) {
      var c0 = c >> 35n;
      c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(values[i]);
      for (var j = 0; j < 5; j++) if ((c0 >> BigInt(j)) & 1n) c ^= CASH_GEN[j];
    }
    return c ^ 1n;
  }

  function cashPrefix(prefix) {
    var out = [];
    for (var i = 0; i < prefix.length; i++) out.push(prefix.charCodeAt(i) & 31);
    out.push(0);
    return out;
  }

  function cashaddrEncode(prefix, type, hash) {
    var data = convertBits(concat([type << 3], hash), 8, 5, true);
    var mod = cashPolymod(cashPrefix(prefix).concat(data, [0, 0, 0, 0, 0, 0, 0, 0]));
    var str = prefix + ":", i;
    for (i = 0; i < data.length; i++) str += BECH32[data[i]];
    for (i = 0; i < 8; i++) str += BECH32[Number((mod >> BigInt(5 * (7 - i))) & 31n)];
    return str;
  }

  function cashaddrDecode(str) {
    if (str !== str.toLowerCase() && str !== str.toUpperCase()) return null;
    str = str.toLowerCase();
    var pos = str.indexOf(":");
    if (pos < 1) return null;
    var prefix = str.slice(0, pos), values = [];
    for (var i = pos + 1; i < str.length; i++) {
      var v = BECH32.indexOf(str[i]);
      if (v < 0) return null;
      values.push(v);
    }
    if (values.length < 9 || cashPolymod(cashPrefix(prefix).concat(values)) !== 0n) return null;
    var bytes = convertBits(values.slice(0, -8), 5, 8, false);
    if (!bytes || !bytes.length) return null;
    return { prefix: prefix, type: bytes[0] >> 3, hash: bytes.slice(1) };
  }

  // ---------- base32 / nano / base64url ----------

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

  function bitsEncode(bytes, padBits, alphabet) {
    var n = 0n;
    for (var i = 0; i < bytes.length; i++) n = (n << 8n) | BigInt(bytes[i]);
    var chars = (bytes.length * 8 + padBits) / 5, out = "";
    for (var k = chars - 1; k >= 0; k--) out += alphabet[Number((n >> BigInt(5 * k)) & 31n)];
    return out;
  }

  function bitsDecode(str, byteLen, alphabet) {
    var n = 0n;
    for (var i = 0; i < str.length; i++) {
      var v = alphabet.indexOf(str[i]);
      if (v < 0) return null;
      n = (n << 5n) | BigInt(v);
    }
    if (n >> BigInt(byteLen * 8)) return null;
    var out = new Uint8Array(byteLen);
    for (var k = byteLen - 1; k >= 0; k--) {
      out[k] = Number(n & 255n);
      n >>= 8n;
    }
    return out;
  }

  function base64url(bytes) {
    return convertBits(bytes, 8, 6, true).map(function (v) { return BASE64URL[v]; }).join("");
  }

  function unbase64url(str) {
    str = str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    var values = [];
    for (var i = 0; i < str.length; i++) {
      var v = BASE64URL.indexOf(str[i]);
      if (v < 0) return null;
      values.push(v);
    }
    var bytes = convertBits(values, 6, 8, false);
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
    NANO32: NANO32,
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
    cashaddrEncode: cashaddrEncode,
    cashaddrDecode: cashaddrDecode,
    base32: base32,
    unbase32: unbase32,
    bitsEncode: bitsEncode,
    bitsDecode: bitsDecode,
    base64url: base64url,
    unbase64url: unbase64url,
    eip55: eip55
  };
})(window.TG = window.TG || {});
