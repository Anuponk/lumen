# Android Browser Helper Billing adapter

This module vendors the Apache-2.0 `playbilling/src/main` sources from
[GoogleChrome/android-browser-helper at 05f859f](https://github.com/GoogleChrome/android-browser-helper/tree/05f859f431abf9f82d16ec6c023881492a66367c/playbilling).
Java sources are kept at short paths for Windows. The adapter retains the
upstream Chrome caller verification, result protocol and Digital Goods reads.
The module compiles against Play Billing 8.3.0 and ABH 2.7.3.

Lumen's changes forward the 64-character obfuscated account ID, reject
unsupported SKUs or missing bindings before opening Play, and select the
same one-time offer as the price lookup. The reserved ID
`lumen_internal_bound_checkout_v1` is a capability reply for an exact
one-item Digital Goods query. It is never a Play Console product, never
shown as an offer and never accepted by the payment activity. The Web
requires that reply in addition to the checkout release switch.
