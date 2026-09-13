// hashes: sha-256, keccak-256, blake2b, crc16-xmodem
// plain js so it works on file://, http, anywhere.

(function (TG) {
  "use strict";

  var M64 = (1n << 64n) - 1n;

  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  // ---------- sha-256 ----------

  var K = [];
  var H0 = [];
  (function () {
    function isPrime(n) {
      for (var i = 2; i * i <= n; i++) if (n % i === 0) return false;
      return true;
    }
    for (var n = 2; K.length < 64; n++) {
      if (!isPrime(n)) continue;
      if (H0.length < 8) H0.push((Math.pow(n, 1 / 2) % 1) * 4294967296 | 0);
      K.push((Math.pow(n, 1 / 3) % 1) * 4294967296 | 0);
    }
  })();

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256(bytes) {
    var len = bytes.length;
    var total = Math.ceil((len + 9) / 64) * 64;
    var m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(len / 536870912));
    dv.setUint32(total - 4, (len << 3) >>> 0);

    var h = H0.slice();
    var w = new Int32Array(64);
    for (var off = 0; off < total; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = dv.getInt32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        w[i] = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) + w[i - 7] +
               (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[i - 16];
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    var out = new Uint8Array(32);
    var odv = new DataView(out.buffer);
    for (var j = 0; j < 8; j++) odv.setInt32(j * 4, h[j]);
    return out;
  }

  function sha256d(bytes) {
    return sha256(sha256(bytes));
  }

  // ---------- keccak ----------

  var RC = [];
  var ROT = new Array(25).fill(0);
  (function () {
    var R = 1;
    for (var i = 0; i < 24; i++) {
      var rc = 0n;
      for (var j = 0; j < 7; j++) {
        if (R & 1) rc |= 1n << BigInt((1 << j) - 1);
        R = (R & 0x80) ? ((R << 1) ^ 0x171) : (R << 1);
      }
      RC.push(rc);
    }
    var x = 1, y = 0;
    for (var t = 0; t < 24; t++) {
      ROT[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;
      var nx = y;
      y = (2 * x + 3 * y) % 5;
      x = nx;
    }
  })();

  function rotl64(v, n) {
    if (n === 0) return v;
    var bn = BigInt(n);
    return ((v << bn) | (v >> (64n - bn))) & M64;
  }

  function keccakF(A) {
    var C = new Array(5), B = new Array(25), x, y;
    for (var round = 0; round < 24; round++) {
      for (x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
      for (x = 0; x < 5; x++) {
        var D = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
        for (y = 0; y < 5; y++) A[x + 5 * y] ^= D;
      }
      for (x = 0; x < 5; x++) {
        for (y = 0; y < 5; y++) {
          B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(A[x + 5 * y], ROT[x + 5 * y]);
        }
      }
      for (x = 0; x < 5; x++) {
        for (y = 0; y < 5; y++) {
          A[x + 5 * y] = B[x + 5 * y] ^ (~B[(x + 1) % 5 + 5 * y] & B[(x + 2) % 5 + 5 * y]);
        }
      }
      A[0] ^= RC[round];
    }
  }

  function keccak(bytes, pad) {
    var rate = 136;
    var A = new Array(25).fill(0n);
    var padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
    padded.set(bytes);
    padded[bytes.length] ^= pad;
    padded[padded.length - 1] ^= 0x80;
    for (var off = 0; off < padded.length; off += rate) {
      for (var i = 0; i < rate / 8; i++) {
        var lane = 0n;
        for (var b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
        A[i] ^= lane;
      }
      keccakF(A);
    }
    var out = new Uint8Array(32);
    for (var k = 0; k < 32; k++) out[k] = Number((A[k >> 3] >> BigInt((k % 8) * 8)) & 0xffn);
    return out;
  }

  // ---------- blake2b ----------

  var B2IV = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
  ];

  var SIGMA = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
  ];

  function rotr64(v, n) {
    return ((v >> n) | (v << (64n - n))) & M64;
  }

  function G(v, a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) & M64; v[d] = rotr64(v[d] ^ v[a], 32n);
    v[c] = (v[c] + v[d]) & M64;     v[b] = rotr64(v[b] ^ v[c], 24n);
    v[a] = (v[a] + v[b] + y) & M64; v[d] = rotr64(v[d] ^ v[a], 16n);
    v[c] = (v[c] + v[d]) & M64;     v[b] = rotr64(v[b] ^ v[c], 63n);
  }

  function blake2b(bytes, outLen) {
    var h = B2IV.slice();
    h[0] ^= 0x01010000n ^ BigInt(outLen);
    var blocks = Math.max(1, Math.ceil(bytes.length / 128));
    var m = new Array(16);
    for (var bi = 0; bi < blocks; bi++) {
      for (var i = 0; i < 16; i++) {
        var word = 0n;
        for (var b = 7; b >= 0; b--) {
          var idx = bi * 128 + i * 8 + b;
          word = (word << 8n) | BigInt(idx < bytes.length ? bytes[idx] : 0);
        }
        m[i] = word;
      }
      var last = bi === blocks - 1;
      var v = h.concat(B2IV);
      v[12] ^= BigInt(last ? bytes.length : (bi + 1) * 128);
      if (last) v[14] ^= M64;
      for (var r = 0; r < 12; r++) {
        var s = SIGMA[r % 10];
        G(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
        G(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
        G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
        G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
        G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
        G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
        G(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
        G(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
      }
      for (i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
    }
    var out = new Uint8Array(outLen);
    for (var k = 0; k < outLen; k++) out[k] = Number((h[k >> 3] >> BigInt((k % 8) * 8)) & 0xffn);
    return out;
  }

  // ---------- crc16 (xmodem) ----------

  function crc16(bytes) {
    var crc = 0;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc;
  }

  TG.utf8 = utf8;
  TG.sha256 = sha256;
  TG.sha256d = sha256d;
  TG.keccak256 = function (bytes) { return keccak(bytes, 0x01); };
  TG.blake2b = blake2b;
  TG.crc16 = crc16;
})(window.TG = window.TG || {});
