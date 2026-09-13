// the copy button next to the donation address, on every page

(function () {
  "use strict";

  var button = document.getElementById("copy-donation");
  if (!button) return;

  function done(text) {
    button.textContent = text;
    setTimeout(function () { button.textContent = "⧉"; }, 1200);
  }

  function fallback(address) {
    var ta = document.createElement("textarea");
    ta.value = address;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { done(document.execCommand("copy") ? "✓" : "✗"); } catch (e) { done("✗"); }
    document.body.removeChild(ta);
  }

  button.addEventListener("click", function () {
    var address = document.getElementById("donation").textContent;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(address).then(function () { done("✓"); }, function () { fallback(address); });
    } else {
      fallback(address);
    }
  });
})();
