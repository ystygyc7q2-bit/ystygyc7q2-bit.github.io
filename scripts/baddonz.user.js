// ==UserScript==
// @name          Baddonz
// @version       1.0
// @description   Menadżer dodatków by besiak
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// @icon          https://i.imgur.com/OAtRFEw.png
// @downloadURL   https://ystygyc7q2-bit.github.io/scripts/baddonz.user.js
// @updateURL     https://ystygyc7q2-bit.github.io/scripts/baddonz.user.js
// ==/UserScript==
(function() {
    window.CSS_URL = "https://ystygyc7q2-bit.github.io/styles/baddonz.css";
    const version = Date.now();
    const build = "https://ystygyc7q2-bit.github.io/scripts/baddonz.js";
    const script = document.createElement("script");
    script.src = `${build}?v=${version}`;
    document.body.appendChild(script);
})();
