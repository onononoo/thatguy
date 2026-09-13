// donate page: one click on the address copies it

(function () {
  "use strict";

  var button = document.getElementById("btc");
  var label = document.getElementById("copied");

  function done(text) {
    label.textContent = text;
    clearTimeout(done.timer);
    done.timer = setTimeout(function () { label.textContent = ""; }, 1500);
  }

  // older way, for when the clipboard api is missing or says no
  function fallback(address) {
    var ta = document.createElement("textarea");
    ta.value = address;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    done(ok ? "copied!" : "couldn't copy, select it by hand");
  }

  button.addEventListener("click", function () {
    var address = button.textContent.trim();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(address).then(function () { done("copied!"); }, function () { fallback(address); });
    } else {
      fallback(address);
    }
  });
})();
