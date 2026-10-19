/* =====================================================================
   cripto.js — hash de senha (PBKDF2-SHA256)
   Usa crypto.subtle quando existe (file:// e https). Quando não existe
   (ex.: servidor http na rede do laboratório), cai num SHA-256 em JS puro.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = (window.Lab = window.Lab || {});

  // ---------- SHA-256 em JS puro (fallback) ----------
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  var W = new Uint32Array(64);

  function bloco(h, m, off) {
    var i, a, b, c, d, e, f, g, hh, t1, t2, s0, s1;
    for (i = 0; i < 16; i++) {
      W[i] = (m[off + i * 4] << 24) | (m[off + i * 4 + 1] << 16) | (m[off + i * 4 + 2] << 8) | m[off + i * 4 + 3];
    }
    for (i = 16; i < 64; i++) {
      s0 = ((W[i - 15] >>> 7) | (W[i - 15] << 25)) ^ ((W[i - 15] >>> 18) | (W[i - 15] << 14)) ^ (W[i - 15] >>> 3);
      s1 = ((W[i - 2] >>> 17) | (W[i - 2] << 15)) ^ ((W[i - 2] >>> 19) | (W[i - 2] << 13)) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; g = h[6]; hh = h[7];
    for (i = 0; i < 64; i++) {
      s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      t1 = (hh + s1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }

  function sha256(bytes) {
    var len = bytes.length;
    var total = ((len + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    var bits = len * 8;
    m[total - 4] = (bits >>> 24) & 255; m[total - 3] = (bits >>> 16) & 255;
    m[total - 2] = (bits >>> 8) & 255; m[total - 1] = bits & 255;
    m[total - 5] = Math.floor(bits / 4294967296) & 255;
    var h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    for (var off = 0; off < total; off += 64) bloco(h, m, off);
    var out = new Uint8Array(32);
    for (var i = 0; i < 8; i++) {
      out[i * 4] = h[i] >>> 24; out[i * 4 + 1] = (h[i] >>> 16) & 255;
      out[i * 4 + 2] = (h[i] >>> 8) & 255; out[i * 4 + 3] = h[i] & 255;
    }
    return out;
  }

  function concat(a, b) {
    var r = new Uint8Array(a.length + b.length);
    r.set(a); r.set(b, a.length);
    return r;
  }

  function hmacPreparado(chave) {
    if (chave.length > 64) chave = sha256(chave);
    var ip = new Uint8Array(64), op = new Uint8Array(64);
    for (var i = 0; i < 64; i++) {
      var k = i < chave.length ? chave[i] : 0;
      ip[i] = k ^ 0x36; op[i] = k ^ 0x5c;
    }
    return function (msg) { return sha256(concat(op, sha256(concat(ip, msg)))); };
  }

  function pbkdf2JS(senhaBytes, sal, iteracoes) {
    var hmac = hmacPreparado(senhaBytes);
    var u = hmac(concat(sal, new Uint8Array([0, 0, 0, 1])));
    var t = new Uint8Array(u);
    for (var i = 1; i < iteracoes; i++) {
      u = hmac(u);
      for (var j = 0; j < 32; j++) t[j] ^= u[j];
    }
    return t;
  }

  // ---------- utilidades ----------
  function utf8(txt) {
    if (window.TextEncoder) return new TextEncoder().encode(txt);
    var s = unescape(encodeURIComponent(txt)), r = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) r[i] = s.charCodeAt(i);
    return r;
  }
  function paraHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }
  function deHex(hex) {
    var r = new Uint8Array(hex.length / 2);
    for (var i = 0; i < r.length; i++) r[i] = parseInt(hex.substr(i * 2, 2), 16);
    return r;
  }

  function temSubtle() {
    return !!(window.crypto && window.crypto.subtle && window.isSecureContext !== false);
  }

  /** PBKDF2-SHA256 → Promise<hex de 32 bytes> */
  function pbkdf2(senha, salHex, iteracoes) {
    var senhaB = utf8(String(senha));
    var sal = deHex(salHex);
    if (temSubtle()) {
      var s = window.crypto.subtle;
      return s.importKey('raw', senhaB, { name: 'PBKDF2' }, false, ['deriveBits'])
        .then(function (k) {
          return s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, k, 256);
        })
        .then(function (bits) { return paraHex(new Uint8Array(bits)); })
        .catch(function () { return paraHex(pbkdf2JS(senhaB, sal, iteracoes)); });
    }
    return new Promise(function (ok) {
      // setTimeout para a interface conseguir mostrar "verificando..." antes do cálculo
      setTimeout(function () { ok(paraHex(pbkdf2JS(senhaB, sal, iteracoes))); }, 30);
    });
  }

  function gerarSal(n) {
    var b = new Uint8Array(n || 16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (var i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256); // fraco, mas só sem crypto
    return paraHex(b);
  }

  /** comparação em tempo constante (evita vazar quantos caracteres batem) */
  function iguais(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }

  Lab.cripto = {
    pbkdf2: pbkdf2,
    pbkdf2JS: function (senha, salHex, it) { return paraHex(pbkdf2JS(utf8(senha), deHex(salHex), it)); },
    sha256Hex: function (txt) { return paraHex(sha256(utf8(txt))); },
    gerarSal: gerarSal,
    iguais: iguais,
    temSubtle: temSubtle
  };
})();
