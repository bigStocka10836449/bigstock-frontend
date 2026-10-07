const vt = () => {
};
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Ue = function(e) {
  const t = [];
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    let i = e.charCodeAt(r);
    i < 128 ? t[n++] = i : i < 2048 ? (t[n++] = i >> 6 | 192, t[n++] = i & 63 | 128) : (i & 64512) === 55296 && r + 1 < e.length && (e.charCodeAt(r + 1) & 64512) === 56320 ? (i = 65536 + ((i & 1023) << 10) + (e.charCodeAt(++r) & 1023), t[n++] = i >> 18 | 240, t[n++] = i >> 12 & 63 | 128, t[n++] = i >> 6 & 63 | 128, t[n++] = i & 63 | 128) : (t[n++] = i >> 12 | 224, t[n++] = i >> 6 & 63 | 128, t[n++] = i & 63 | 128);
  }
  return t;
}, kt = function(e) {
  const t = [];
  let n = 0, r = 0;
  for (; n < e.length; ) {
    const i = e[n++];
    if (i < 128)
      t[r++] = String.fromCharCode(i);
    else if (i > 191 && i < 224) {
      const o = e[n++];
      t[r++] = String.fromCharCode((i & 31) << 6 | o & 63);
    } else if (i > 239 && i < 365) {
      const o = e[n++], s = e[n++], a = e[n++], u = ((i & 7) << 18 | (o & 63) << 12 | (s & 63) << 6 | a & 63) - 65536;
      t[r++] = String.fromCharCode(55296 + (u >> 10)), t[r++] = String.fromCharCode(56320 + (u & 1023));
    } else {
      const o = e[n++], s = e[n++];
      t[r++] = String.fromCharCode((i & 15) << 12 | (o & 63) << 6 | s & 63);
    }
  }
  return t.join("");
}, Ke = {
  /**
   * Maps bytes to characters.
   */
  byteToCharMap_: null,
  /**
   * Maps characters to bytes.
   */
  charToByteMap_: null,
  /**
   * Maps bytes to websafe characters.
   * @private
   */
  byteToCharMapWebSafe_: null,
  /**
   * Maps websafe characters to bytes.
   * @private
   */
  charToByteMapWebSafe_: null,
  /**
   * Our default alphabet, shared between
   * ENCODED_VALS and ENCODED_VALS_WEBSAFE
   */
  ENCODED_VALS_BASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  /**
   * Our default alphabet. Value 64 (=) is special; it means "nothing."
   */
  get ENCODED_VALS() {
    return this.ENCODED_VALS_BASE + "+/=";
  },
  /**
   * Our websafe alphabet.
   */
  get ENCODED_VALS_WEBSAFE() {
    return this.ENCODED_VALS_BASE + "-_.";
  },
  /**
   * Whether this browser supports the atob and btoa functions. This extension
   * started at Mozilla but is now implemented by many browsers. We use the
   * ASSUME_* variables to avoid pulling in the full useragent detection library
   * but still allowing the standard per-browser compilations.
   *
   */
  HAS_NATIVE_SUPPORT: typeof atob == "function",
  /**
   * Base64-encode an array of bytes.
   *
   * @param input An array of bytes (numbers with
   *     value in [0, 255]) to encode.
   * @param webSafe Boolean indicating we should use the
   *     alternative alphabet.
   * @return The base64 encoded string.
   */
  encodeByteArray(e, t) {
    if (!Array.isArray(e))
      throw Error("encodeByteArray takes an array as a parameter");
    this.init_();
    const n = t ? this.byteToCharMapWebSafe_ : this.byteToCharMap_, r = [];
    for (let i = 0; i < e.length; i += 3) {
      const o = e[i], s = i + 1 < e.length, a = s ? e[i + 1] : 0, u = i + 2 < e.length, c = u ? e[i + 2] : 0, v = o >> 2, k = (o & 3) << 4 | a >> 4;
      let F = (a & 15) << 2 | c >> 6, $ = c & 63;
      u || ($ = 64, s || (F = 64)), r.push(n[v], n[k], n[F], n[$]);
    }
    return r.join("");
  },
  /**
   * Base64-encode a string.
   *
   * @param input A string to encode.
   * @param webSafe If true, we should use the
   *     alternative alphabet.
   * @return The base64 encoded string.
   */
  encodeString(e, t) {
    return this.HAS_NATIVE_SUPPORT && !t ? btoa(e) : this.encodeByteArray(Ue(e), t);
  },
  /**
   * Base64-decode a string.
   *
   * @param input to decode.
   * @param webSafe True if we should use the
   *     alternative alphabet.
   * @return string representing the decoded value.
   */
  decodeString(e, t) {
    return this.HAS_NATIVE_SUPPORT && !t ? atob(e) : kt(this.decodeStringToByteArray(e, t));
  },
  /**
   * Base64-decode a string.
   *
   * In base-64 decoding, groups of four characters are converted into three
   * bytes.  If the encoder did not apply padding, the input length may not
   * be a multiple of 4.
   *
   * In this case, the last group will have fewer than 4 characters, and
   * padding will be inferred.  If the group has one or two characters, it decodes
   * to one byte.  If the group has three characters, it decodes to two bytes.
   *
   * @param input Input to decode.
   * @param webSafe True if we should use the web-safe alphabet.
   * @return bytes representing the decoded value.
   */
  decodeStringToByteArray(e, t) {
    this.init_();
    const n = t ? this.charToByteMapWebSafe_ : this.charToByteMap_, r = [];
    for (let i = 0; i < e.length; ) {
      const o = n[e.charAt(i++)], a = i < e.length ? n[e.charAt(i)] : 0;
      ++i;
      const c = i < e.length ? n[e.charAt(i)] : 64;
      ++i;
      const k = i < e.length ? n[e.charAt(i)] : 64;
      if (++i, o == null || a == null || c == null || k == null)
        throw new Ot();
      const F = o << 2 | a >> 4;
      if (r.push(F), c !== 64) {
        const $ = a << 4 & 240 | c >> 2;
        if (r.push($), k !== 64) {
          const Ct = c << 6 & 192 | k;
          r.push(Ct);
        }
      }
    }
    return r;
  },
  /**
   * Lazy static initialization function. Called before
   * accessing any of the static map variables.
   * @private
   */
  init_() {
    if (!this.byteToCharMap_) {
      this.byteToCharMap_ = {}, this.charToByteMap_ = {}, this.byteToCharMapWebSafe_ = {}, this.charToByteMapWebSafe_ = {};
      for (let e = 0; e < this.ENCODED_VALS.length; e++)
        this.byteToCharMap_[e] = this.ENCODED_VALS.charAt(e), this.charToByteMap_[this.byteToCharMap_[e]] = e, this.byteToCharMapWebSafe_[e] = this.ENCODED_VALS_WEBSAFE.charAt(e), this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]] = e, e >= this.ENCODED_VALS_BASE.length && (this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)] = e, this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)] = e);
    }
  }
};
class Ot extends Error {
  constructor() {
    super(...arguments), this.name = "DecodeBase64StringError";
  }
}
const Rt = function(e) {
  const t = Ue(e);
  return Ke.encodeByteArray(t, !0);
}, We = function(e) {
  return Rt(e).replace(/\./g, "");
}, Nt = function(e) {
  try {
    return Ke.decodeString(e, !0);
  } catch (t) {
    console.error("base64Decode failed: ", t);
  }
  return null;
};
/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Mt() {
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw new Error("Unable to locate global object.");
}
/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Bt = () => Mt().__FIREBASE_DEFAULTS__, Ft = () => {
  if (typeof process > "u" || typeof process.env > "u")
    return;
  const e = process.env.__FIREBASE_DEFAULTS__;
  if (e)
    return JSON.parse(e);
}, $t = () => {
  if (typeof document > "u")
    return;
  let e;
  try {
    e = document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/);
  } catch {
    return;
  }
  const t = e && Nt(e[1]);
  return t && JSON.parse(t);
}, Lt = () => {
  try {
    return vt() || Bt() || Ft() || $t();
  } catch (e) {
    console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);
    return;
  }
}, qe = () => {
  var e;
  return (e = Lt()) == null ? void 0 : e.config;
};
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Pt {
  constructor() {
    this.reject = () => {
    }, this.resolve = () => {
    }, this.promise = new Promise((t, n) => {
      this.resolve = t, this.reject = n;
    });
  }
  /**
   * Our API internals are not promisified and cannot because our callback APIs have subtle expectations around
   * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
   * and returns a node-style callback which will resolve or reject the Deferred's promise.
   */
  wrapCallback(t) {
    return (n, r) => {
      n ? this.reject(n) : this.resolve(r), typeof t == "function" && (this.promise.catch(() => {
      }), t.length === 1 ? t(n) : t(n, r));
    };
  }
}
function ze() {
  try {
    return typeof indexedDB == "object";
  } catch {
    return !1;
  }
}
function Ge() {
  return new Promise((e, t) => {
    try {
      let n = !0;
      const r = "validate-browser-context-for-indexeddb-analytics-module", i = self.indexedDB.open(r);
      i.onsuccess = () => {
        i.result.close(), n || self.indexedDB.deleteDatabase(r), e(!0);
      }, i.onupgradeneeded = () => {
        n = !1;
      }, i.onerror = () => {
        var o;
        t(((o = i.error) == null ? void 0 : o.message) || "");
      };
    } catch (n) {
      t(n);
    }
  });
}
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const xt = "FirebaseError";
class A extends Error {
  constructor(t, n, r) {
    super(n), this.code = t, this.customData = r, this.name = xt, Object.setPrototypeOf(this, A.prototype), Error.captureStackTrace && Error.captureStackTrace(this, j.prototype.create);
  }
}
class j {
  constructor(t, n, r) {
    this.service = t, this.serviceName = n, this.errors = r;
  }
  create(t, ...n) {
    const r = n[0] || {}, i = `${this.service}/${t}`, o = this.errors[t], s = o ? Ht(o, r) : "Error", a = `${this.serviceName}: ${s} (${i}).`;
    return new A(i, a, r);
  }
}
function Ht(e, t) {
  try {
    let n = 0, r = "";
    for (; n < e.length; ) {
      const i = e.indexOf("{$", n);
      if (i === -1) {
        r += e.substring(n);
        break;
      }
      const o = e.indexOf("}", i + 2);
      if (o === -1) {
        r += e.substring(n);
        break;
      }
      const s = e.substring(i + 2, o), a = t[s];
      r += e.substring(n, i) + (a != null ? String(a) : `<${s}?>`), n = o + 1;
    }
    return r;
  } catch {
    return e;
  }
}
function Z(e, t) {
  if (e === t)
    return !0;
  const n = Object.keys(e), r = Object.keys(t);
  for (const i of n) {
    if (!r.includes(i))
      return !1;
    const o = e[i], s = t[i];
    if (Ie(o) && Ie(s)) {
      if (!Z(o, s))
        return !1;
    } else if (o !== s)
      return !1;
  }
  for (const i of r)
    if (!n.includes(i))
      return !1;
  return !0;
}
function Ie(e) {
  return e !== null && typeof e == "object";
}
/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Je(e) {
  return e && e._delegate ? e._delegate : e;
}
class I {
  /**
   *
   * @param name The public service name, e.g. app, auth, firestore, database
   * @param instanceFactory Service factory responsible for creating the public interface
   * @param type whether the service provided by the component is public or private
   */
  constructor(t, n, r) {
    this.name = t, this.instanceFactory = n, this.type = r, this.multipleInstances = !1, this.serviceProps = {}, this.instantiationMode = "LAZY", this.onInstanceCreated = null;
  }
  setInstantiationMode(t) {
    return this.instantiationMode = t, this;
  }
  setMultipleInstances(t) {
    return this.multipleInstances = t, this;
  }
  setServiceProps(t) {
    return this.serviceProps = t, this;
  }
  setInstanceCreatedCallback(t) {
    return this.onInstanceCreated = t, this;
  }
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const w = "[DEFAULT]";
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class jt {
  constructor(t, n) {
    this.name = t, this.container = n, this.component = null, this.instances = /* @__PURE__ */ new Map(), this.instancesDeferred = /* @__PURE__ */ new Map(), this.instancesOptions = /* @__PURE__ */ new Map(), this.onInitCallbacks = /* @__PURE__ */ new Map();
  }
  /**
   * @param identifier A provider can provide multiple instances of a service
   * if this.component.multipleInstances is true.
   */
  get(t) {
    const n = this.normalizeInstanceIdentifier(t);
    if (!this.instancesDeferred.has(n)) {
      const r = new Pt();
      if (this.instancesDeferred.set(n, r), this.isInitialized(n) || this.shouldAutoInitialize())
        try {
          const i = this.getOrInitializeService({
            instanceIdentifier: n
          });
          i && r.resolve(i);
        } catch {
        }
    }
    return this.instancesDeferred.get(n).promise;
  }
  getImmediate(t) {
    const n = this.normalizeInstanceIdentifier(t == null ? void 0 : t.identifier), r = (t == null ? void 0 : t.optional) ?? !1;
    if (this.isInitialized(n) || this.shouldAutoInitialize())
      try {
        return this.getOrInitializeService({
          instanceIdentifier: n
        });
      } catch (i) {
        if (r)
          return null;
        throw i;
      }
    else {
      if (r)
        return null;
      throw Error(`Service ${this.name} is not available`);
    }
  }
  getComponent() {
    return this.component;
  }
  setComponent(t) {
    if (t.name !== this.name)
      throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);
    if (this.component)
      throw Error(`Component for ${this.name} has already been provided`);
    if (this.component = t, !!this.shouldAutoInitialize()) {
      if (Ut(t))
        try {
          this.getOrInitializeService({ instanceIdentifier: w });
        } catch {
        }
      for (const [n, r] of this.instancesDeferred.entries()) {
        const i = this.normalizeInstanceIdentifier(n);
        try {
          const o = this.getOrInitializeService({
            instanceIdentifier: i
          });
          r.resolve(o);
        } catch {
        }
      }
    }
  }
  clearInstance(t = w) {
    this.instancesDeferred.delete(t), this.instancesOptions.delete(t), this.instances.delete(t);
  }
  // app.delete() will call this method on every provider to delete the services
  // TODO: should we mark the provider as deleted?
  async delete() {
    const t = Array.from(this.instances.values());
    await Promise.all([
      ...t.filter((n) => "INTERNAL" in n).map((n) => n.INTERNAL.delete()),
      ...t.filter((n) => "_delete" in n).map((n) => n._delete())
    ]);
  }
  isComponentSet() {
    return this.component != null;
  }
  isInitialized(t = w) {
    return this.instances.has(t);
  }
  getOptions(t = w) {
    return this.instancesOptions.get(t) || {};
  }
  initialize(t = {}) {
    const { options: n = {} } = t, r = this.normalizeInstanceIdentifier(t.instanceIdentifier);
    if (this.isInitialized(r))
      throw Error(`${this.name}(${r}) has already been initialized`);
    if (!this.isComponentSet())
      throw Error(`Component ${this.name} has not been registered yet`);
    const i = this.getOrInitializeService({
      instanceIdentifier: r,
      options: n
    });
    for (const [o, s] of this.instancesDeferred.entries()) {
      const a = this.normalizeInstanceIdentifier(o);
      r === a && s.resolve(i);
    }
    return i;
  }
  /**
   *
   * @param callback - a function that will be invoked  after the provider has been initialized by calling provider.initialize().
   * The function is invoked SYNCHRONOUSLY, so it should not execute any longrunning tasks in order to not block the program.
   *
   * @param identifier An optional instance identifier
   * @returns a function to unregister the callback
   */
  onInit(t, n) {
    const r = this.normalizeInstanceIdentifier(n), i = this.onInitCallbacks.get(r) ?? /* @__PURE__ */ new Set();
    i.add(t), this.onInitCallbacks.set(r, i);
    const o = this.instances.get(r);
    return o && t(o, r), () => {
      i.delete(t);
    };
  }
  /**
   * Invoke onInit callbacks synchronously
   * @param instance the service instance`
   */
  invokeOnInitCallbacks(t, n) {
    const r = this.onInitCallbacks.get(n);
    if (r)
      for (const i of r)
        try {
          i(t, n);
        } catch {
        }
  }
  getOrInitializeService({ instanceIdentifier: t, options: n = {} }) {
    let r = this.instances.get(t);
    if (!r && this.component && (r = this.component.instanceFactory(this.container, {
      instanceIdentifier: Vt(t),
      options: n
    }), this.instances.set(t, r), this.instancesOptions.set(t, n), this.invokeOnInitCallbacks(r, t), this.component.onInstanceCreated))
      try {
        this.component.onInstanceCreated(this.container, t, r);
      } catch {
      }
    return r || null;
  }
  normalizeInstanceIdentifier(t = w) {
    return this.component ? this.component.multipleInstances ? t : w : t;
  }
  shouldAutoInitialize() {
    return !!this.component && this.component.instantiationMode !== "EXPLICIT";
  }
}
function Vt(e) {
  return e === w ? void 0 : e;
}
function Ut(e) {
  return e.instantiationMode === "EAGER";
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Kt {
  constructor(t) {
    this.name = t, this.providers = /* @__PURE__ */ new Map();
  }
  /**
   *
   * @param component Component being added
   * @param overwrite When a component with the same name has already been registered,
   * if overwrite is true: overwrite the existing component with the new component and create a new
   * provider with the new component. It can be useful in tests where you want to use different mocks
   * for different tests.
   * if overwrite is false: throw an exception
   */
  addComponent(t) {
    const n = this.getProvider(t.name);
    if (n.isComponentSet())
      throw new Error(`Component ${t.name} has already been registered with ${this.name}`);
    n.setComponent(t);
  }
  addOrOverwriteComponent(t) {
    this.getProvider(t.name).isComponentSet() && this.providers.delete(t.name), this.addComponent(t);
  }
  /**
   * getProvider provides a type safe interface where it can only be called with a field name
   * present in NameServiceMapping interface.
   *
   * Firebase SDKs providing services should extend NameServiceMapping interface to register
   * themselves.
   */
  getProvider(t) {
    if (this.providers.has(t))
      return this.providers.get(t);
    const n = new jt(t, this);
    return this.providers.set(t, n), n;
  }
  getProviders() {
    return Array.from(this.providers.values());
  }
}
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var d;
(function(e) {
  e[e.DEBUG = 0] = "DEBUG", e[e.VERBOSE = 1] = "VERBOSE", e[e.INFO = 2] = "INFO", e[e.WARN = 3] = "WARN", e[e.ERROR = 4] = "ERROR", e[e.SILENT = 5] = "SILENT";
})(d || (d = {}));
const Wt = {
  debug: d.DEBUG,
  verbose: d.VERBOSE,
  info: d.INFO,
  warn: d.WARN,
  error: d.ERROR,
  silent: d.SILENT
}, qt = d.INFO, zt = {
  [d.DEBUG]: "log",
  [d.VERBOSE]: "log",
  [d.INFO]: "info",
  [d.WARN]: "warn",
  [d.ERROR]: "error"
}, Gt = (e, t, ...n) => {
  if (t < e.logLevel)
    return;
  const r = (/* @__PURE__ */ new Date()).toISOString(), i = zt[t];
  if (i)
    console[i](`[${r}]  ${e.name}:`, ...n);
  else
    throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`);
};
class Jt {
  /**
   * Gives you an instance of a Logger to capture messages according to
   * Firebase's logging scheme.
   *
   * @param name The name that the logs will be associated with
   */
  constructor(t) {
    this.name = t, this._logLevel = qt, this._logHandler = Gt, this._userLogHandler = null;
  }
  get logLevel() {
    return this._logLevel;
  }
  set logLevel(t) {
    if (!(t in d))
      throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);
    this._logLevel = t;
  }
  // Workaround for setter/getter having to be the same type.
  setLogLevel(t) {
    this._logLevel = typeof t == "string" ? Wt[t] : t;
  }
  get logHandler() {
    return this._logHandler;
  }
  set logHandler(t) {
    if (typeof t != "function")
      throw new TypeError("Value assigned to `logHandler` must be a function");
    this._logHandler = t;
  }
  get userLogHandler() {
    return this._userLogHandler;
  }
  set userLogHandler(t) {
    this._userLogHandler = t;
  }
  /**
   * The functions below are all based on the `console` interface
   */
  debug(...t) {
    this._userLogHandler && this._userLogHandler(this, d.DEBUG, ...t), this._logHandler(this, d.DEBUG, ...t);
  }
  log(...t) {
    this._userLogHandler && this._userLogHandler(this, d.VERBOSE, ...t), this._logHandler(this, d.VERBOSE, ...t);
  }
  info(...t) {
    this._userLogHandler && this._userLogHandler(this, d.INFO, ...t), this._logHandler(this, d.INFO, ...t);
  }
  warn(...t) {
    this._userLogHandler && this._userLogHandler(this, d.WARN, ...t), this._logHandler(this, d.WARN, ...t);
  }
  error(...t) {
    this._userLogHandler && this._userLogHandler(this, d.ERROR, ...t), this._logHandler(this, d.ERROR, ...t);
  }
}
const Qt = (e, t) => t.some((n) => e instanceof n);
let Ee, _e;
function Yt() {
  return Ee || (Ee = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Xt() {
  return _e || (_e = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const Qe = /* @__PURE__ */ new WeakMap(), ee = /* @__PURE__ */ new WeakMap(), Ye = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap();
function Zt(e) {
  const t = new Promise((n, r) => {
    const i = () => {
      e.removeEventListener("success", o), e.removeEventListener("error", s);
    }, o = () => {
      n(g(e.result)), i();
    }, s = () => {
      r(e.error), i();
    };
    e.addEventListener("success", o), e.addEventListener("error", s);
  });
  return t.then((n) => {
    n instanceof IDBCursor && Qe.set(n, e);
  }).catch(() => {
  }), se.set(t, e), t;
}
function en(e) {
  if (ee.has(e))
    return;
  const t = new Promise((n, r) => {
    const i = () => {
      e.removeEventListener("complete", o), e.removeEventListener("error", s), e.removeEventListener("abort", s);
    }, o = () => {
      n(), i();
    }, s = () => {
      r(e.error || new DOMException("AbortError", "AbortError")), i();
    };
    e.addEventListener("complete", o), e.addEventListener("error", s), e.addEventListener("abort", s);
  });
  ee.set(e, t);
}
let te = {
  get(e, t, n) {
    if (e instanceof IDBTransaction) {
      if (t === "done")
        return ee.get(e);
      if (t === "objectStoreNames")
        return e.objectStoreNames || Ye.get(e);
      if (t === "store")
        return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
    }
    return g(e[t]);
  },
  set(e, t, n) {
    return e[t] = n, !0;
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
  }
};
function tn(e) {
  te = e(te);
}
function nn(e) {
  return e === IDBDatabase.prototype.transaction && !("objectStoreNames" in IDBTransaction.prototype) ? function(t, ...n) {
    const r = e.call(q(this), t, ...n);
    return Ye.set(r, t.sort ? t.sort() : [t]), g(r);
  } : Xt().includes(e) ? function(...t) {
    return e.apply(q(this), t), g(Qe.get(this));
  } : function(...t) {
    return g(e.apply(q(this), t));
  };
}
function rn(e) {
  return typeof e == "function" ? nn(e) : (e instanceof IDBTransaction && en(e), Qt(e, Yt()) ? new Proxy(e, te) : e);
}
function g(e) {
  if (e instanceof IDBRequest)
    return Zt(e);
  if (W.has(e))
    return W.get(e);
  const t = rn(e);
  return t !== e && (W.set(e, t), se.set(t, e)), t;
}
const q = (e) => se.get(e);
function V(e, t, { blocked: n, upgrade: r, blocking: i, terminated: o } = {}) {
  const s = indexedDB.open(e, t), a = g(s);
  return r && s.addEventListener("upgradeneeded", (u) => {
    r(g(s.result), u.oldVersion, u.newVersion, g(s.transaction), u);
  }), n && s.addEventListener("blocked", (u) => n(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    u.oldVersion,
    u.newVersion,
    u
  )), a.then((u) => {
    o && u.addEventListener("close", () => o()), i && u.addEventListener("versionchange", (c) => i(c.oldVersion, c.newVersion, c));
  }).catch(() => {
  }), a;
}
function L(e, { blocked: t } = {}) {
  const n = indexedDB.deleteDatabase(e);
  return t && n.addEventListener("blocked", (r) => t(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    r.oldVersion,
    r
  )), g(n).then(() => {
  });
}
const on = ["get", "getKey", "getAll", "getAllKeys", "count"], sn = ["put", "add", "delete", "clear"], z = /* @__PURE__ */ new Map();
function Se(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string"))
    return;
  if (z.get(t))
    return z.get(t);
  const n = t.replace(/FromIndex$/, ""), r = t !== n, i = sn.includes(n);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(i || on.includes(n))
  )
    return;
  const o = async function(s, ...a) {
    const u = this.transaction(s, i ? "readwrite" : "readonly");
    let c = u.store;
    return r && (c = c.index(a.shift())), (await Promise.all([
      c[n](...a),
      i && u.done
    ]))[0];
  };
  return z.set(t, o), o;
}
tn((e) => ({
  ...e,
  get: (t, n, r) => Se(t, n) || e.get(t, n, r),
  has: (t, n) => !!Se(t, n) || e.has(t, n)
}));
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class an {
  constructor(t) {
    this.container = t;
  }
  // In initial implementation, this will be called by installations on
  // auth token refresh, and installations will send this string.
  getPlatformInfoString() {
    return this.container.getProviders().map((n) => {
      if (cn(n)) {
        const r = n.getImmediate();
        return `${r.library}/${r.version}`;
      } else
        return null;
    }).filter((n) => n).join(" ");
  }
}
function cn(e) {
  const t = e.getComponent();
  return (t == null ? void 0 : t.type) === "VERSION";
}
const ne = "@firebase/app", Te = "0.16.2";
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const b = new Jt("@firebase/app"), un = "@firebase/app-compat", dn = "@firebase/analytics-compat", fn = "@firebase/analytics", ln = "@firebase/app-check-compat", hn = "@firebase/app-check", pn = "@firebase/auth", gn = "@firebase/auth-compat", bn = "@firebase/database", mn = "@firebase/data-connect", wn = "@firebase/database-compat", yn = "@firebase/functions", In = "@firebase/functions-compat", En = "@firebase/installations", _n = "@firebase/installations-compat", Sn = "@firebase/messaging", Tn = "@firebase/messaging-compat", An = "@firebase/performance", Dn = "@firebase/performance-compat", Cn = "@firebase/remote-config", vn = "@firebase/remote-config-compat", kn = "@firebase/storage", On = "@firebase/storage-compat", Rn = "@firebase/firestore", Nn = "@firebase/ai", Mn = "@firebase/firestore-compat", Bn = "firebase";
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const re = "[DEFAULT]", Fn = {
  [ne]: "fire-core",
  [un]: "fire-core-compat",
  [fn]: "fire-analytics",
  [dn]: "fire-analytics-compat",
  [hn]: "fire-app-check",
  [ln]: "fire-app-check-compat",
  [pn]: "fire-auth",
  [gn]: "fire-auth-compat",
  [bn]: "fire-rtdb",
  [mn]: "fire-data-connect",
  [wn]: "fire-rtdb-compat",
  [yn]: "fire-fn",
  [In]: "fire-fn-compat",
  [En]: "fire-iid",
  [_n]: "fire-iid-compat",
  [Sn]: "fire-fcm",
  [Tn]: "fire-fcm-compat",
  [An]: "fire-perf",
  [Dn]: "fire-perf-compat",
  [Cn]: "fire-rc",
  [vn]: "fire-rc-compat",
  [kn]: "fire-gcs",
  [On]: "fire-gcs-compat",
  [Rn]: "fire-fst",
  [Mn]: "fire-fst-compat",
  [Nn]: "fire-vertex",
  "fire-js": "fire-js",
  // Platform identifier for JS SDK.
  [Bn]: "fire-js-all"
};
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const P = /* @__PURE__ */ new Map(), $n = /* @__PURE__ */ new Map(), ie = /* @__PURE__ */ new Map();
function Ae(e, t) {
  try {
    e.container.addComponent(t);
  } catch (n) {
    b.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`, n);
  }
}
function T(e) {
  const t = e.name;
  if (ie.has(t))
    return b.debug(`There were multiple attempts to register component ${t}.`), !1;
  ie.set(t, e);
  for (const n of P.values())
    Ae(n, e);
  for (const n of $n.values())
    Ae(n, e);
  return !0;
}
function ae(e, t) {
  const n = e.container.getProvider("heartbeat").getImmediate({ optional: !0 });
  return n && n.triggerHeartbeat(), e.container.getProvider(t);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Ln = {
  "no-app": "No Firebase App '{$appName}' has been created - call initializeApp() first",
  "bad-app-name": "Illegal App name: '{$appName}'",
  "duplicate-app": "Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.",
  "app-deleted": "Firebase App named '{$appName}' already deleted",
  "server-app-deleted": "Firebase Server App has been deleted",
  "no-options": "Need to provide options, when not being deployed to hosting via source.",
  "invalid-app-argument": "firebase.{$appName}() takes either no argument or a Firebase App instance.",
  "invalid-log-argument": "First argument to `onLog` must be null or a function.",
  "idb-open": "Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.",
  "idb-get": "Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.",
  "idb-set": "Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.",
  "idb-delete": "Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.",
  "finalization-registry-not-supported": "FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.",
  "invalid-server-app-environment": "FirebaseServerApp is not for use in browser environments."
}, p = new j("app", "Firebase", Ln);
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Pn {
  constructor(t, n, r) {
    this._isDeleted = !1, this._options = { ...t }, this._config = { ...n }, this._name = n.name, this._automaticDataCollectionEnabled = n.automaticDataCollectionEnabled, this._container = r, this.container.addComponent(new I(
      "app",
      () => this,
      "PUBLIC"
      /* ComponentType.PUBLIC */
    ));
  }
  get automaticDataCollectionEnabled() {
    return this.checkDestroyed(), this._automaticDataCollectionEnabled;
  }
  set automaticDataCollectionEnabled(t) {
    this.checkDestroyed(), this._automaticDataCollectionEnabled = t;
  }
  get name() {
    return this.checkDestroyed(), this._name;
  }
  get options() {
    return this.checkDestroyed(), this._options;
  }
  get config() {
    return this.checkDestroyed(), this._config;
  }
  get container() {
    return this._container;
  }
  get isDeleted() {
    return this._isDeleted;
  }
  set isDeleted(t) {
    this._isDeleted = t;
  }
  /**
   * This function will throw an Error if the App has already been deleted -
   * use before performing API actions on the App.
   */
  checkDestroyed() {
    if (this.isDeleted)
      throw p.create("app-deleted", { appName: this._name });
  }
}
function Xe(e, t = {}) {
  let n = e;
  typeof t != "object" && (t = { name: t });
  const r = {
    name: re,
    automaticDataCollectionEnabled: !0,
    ...t
  }, i = r.name;
  if (typeof i != "string" || !i)
    throw p.create("bad-app-name", {
      appName: String(i)
    });
  if (n || (n = qe()), !n)
    throw p.create(
      "no-options"
      /* AppError.NO_OPTIONS */
    );
  const o = P.get(i);
  if (o)
    if (Z(n, o.options)) {
      if (Z(r, o.config))
        return o;
      throw p.create("duplicate-app", {
        appName: i,
        mismatchedParam: "config",
        oldValue: JSON.stringify(o.config),
        newValue: JSON.stringify(r)
      });
    } else throw p.create("duplicate-app", {
      appName: i,
      mismatchedParam: "options",
      oldValue: JSON.stringify(o.options),
      newValue: JSON.stringify(n)
    });
  const s = new Kt(i);
  for (const u of ie.values())
    s.addComponent(u);
  const a = new Pn(n, r, s);
  return P.set(i, a), a;
}
function xn(e = re) {
  const t = P.get(e);
  if (!t && e === re && qe())
    return Xe();
  if (!t)
    throw p.create("no-app", { appName: e });
  return t;
}
function S(e, t, n) {
  let r = Fn[e] ?? e;
  n && (r += `-${n}`);
  const i = r.match(/\s|\//), o = t.match(/\s|\//);
  if (i || o) {
    const s = [
      `Unable to register library "${r}" with version "${t}":`
    ];
    i && s.push(`library name "${r}" contains illegal characters (whitespace or "/")`), i && o && s.push("and"), o && s.push(`version name "${t}" contains illegal characters (whitespace or "/")`), b.warn(s.join(" "));
    return;
  }
  T(new I(
    `${r}-version`,
    () => ({ library: r, version: t }),
    "VERSION"
    /* ComponentType.VERSION */
  ));
}
/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Hn = "firebase-heartbeat-database", jn = 1, R = "firebase-heartbeat-store";
let G = null;
function Ze() {
  return G || (G = V(Hn, jn, {
    upgrade: (e, t) => {
      switch (t) {
        case 0:
          try {
            e.createObjectStore(R);
          } catch (n) {
            console.warn(n);
          }
      }
    }
  }).catch((e) => {
    throw p.create("idb-open", {
      originalErrorMessage: e.message
    });
  })), G;
}
async function Vn(e) {
  try {
    const n = (await Ze()).transaction(R), r = await n.objectStore(R).get(et(e));
    return await n.done, r;
  } catch (t) {
    if (t instanceof A)
      b.warn(t.message);
    else {
      const n = p.create("idb-get", {
        originalErrorMessage: t == null ? void 0 : t.message
      });
      b.warn(n.message);
    }
  }
}
async function De(e, t) {
  try {
    const r = (await Ze()).transaction(R, "readwrite");
    await r.objectStore(R).put(t, et(e)), await r.done;
  } catch (n) {
    if (n instanceof A)
      b.warn(n.message);
    else {
      const r = p.create("idb-set", {
        originalErrorMessage: n == null ? void 0 : n.message
      });
      b.warn(r.message);
    }
  }
}
function et(e) {
  return `${e.name}!${e.options.appId}`;
}
/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Un = 1024, Kn = 30;
class Wn {
  constructor(t) {
    this.container = t, this._heartbeatsCache = null;
    const n = this.container.getProvider("app").getImmediate();
    this._storage = new zn(n), this._heartbeatsCachePromise = this._storage.read().then((r) => (this._heartbeatsCache = r, r));
  }
  /**
   * Called to report a heartbeat. The function will generate
   * a HeartbeatsByUserAgent object, update heartbeatsCache, and persist it
   * to IndexedDB.
   * Note that we only store one heartbeat per day. So if a heartbeat for today is
   * already logged, subsequent calls to this function in the same day will be ignored.
   */
  async triggerHeartbeat() {
    var t, n;
    try {
      const i = this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(), o = Ce();
      if (((t = this._heartbeatsCache) == null ? void 0 : t.heartbeats) == null && (this._heartbeatsCache = await this._heartbeatsCachePromise, ((n = this._heartbeatsCache) == null ? void 0 : n.heartbeats) == null) || this._heartbeatsCache.lastSentHeartbeatDate === o || this._heartbeatsCache.heartbeats.some((s) => s.date === o))
        return;
      if (this._heartbeatsCache.heartbeats.push({ date: o, agent: i }), this._heartbeatsCache.heartbeats.length > Kn) {
        const s = Gn(this._heartbeatsCache.heartbeats);
        this._heartbeatsCache.heartbeats.splice(s, 1);
      }
      return this._storage.overwrite(this._heartbeatsCache);
    } catch (r) {
      b.warn(r);
    }
  }
  /**
   * Returns a base64 encoded string which can be attached to the heartbeat-specific header directly.
   * It also clears all heartbeats from memory as well as in IndexedDB.
   *
   * NOTE: Consuming product SDKs should not send the header if this method
   * returns an empty string.
   */
  async getHeartbeatsHeader() {
    var t;
    try {
      if (this._heartbeatsCache === null && await this._heartbeatsCachePromise, ((t = this._heartbeatsCache) == null ? void 0 : t.heartbeats) == null || this._heartbeatsCache.heartbeats.length === 0)
        return "";
      const n = Ce(), { heartbeatsToSend: r, unsentEntries: i } = qn(this._heartbeatsCache.heartbeats), o = We(JSON.stringify({ version: 2, heartbeats: r }));
      return this._heartbeatsCache.lastSentHeartbeatDate = n, i.length > 0 ? (this._heartbeatsCache.heartbeats = i, await this._storage.overwrite(this._heartbeatsCache)) : (this._heartbeatsCache.heartbeats = [], this._storage.overwrite(this._heartbeatsCache)), o;
    } catch (n) {
      return b.warn(n), "";
    }
  }
}
function Ce() {
  return (/* @__PURE__ */ new Date()).toISOString().substring(0, 10);
}
function qn(e, t = Un) {
  const n = [];
  let r = e.slice();
  for (const i of e) {
    const o = n.find((s) => s.agent === i.agent);
    if (o) {
      if (o.dates.push(i.date), ve(n) > t) {
        o.dates.pop();
        break;
      }
    } else if (n.push({
      agent: i.agent,
      dates: [i.date]
    }), ve(n) > t) {
      n.pop();
      break;
    }
    r = r.slice(1);
  }
  return {
    heartbeatsToSend: n,
    unsentEntries: r
  };
}
class zn {
  constructor(t) {
    this.app = t, this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck();
  }
  async runIndexedDBEnvironmentCheck() {
    return ze() ? Ge().then(() => !0).catch(() => !1) : !1;
  }
  /**
   * Read all heartbeats.
   */
  async read() {
    if (await this._canUseIndexedDBPromise) {
      const n = await Vn(this.app);
      return n != null && n.heartbeats ? n : { heartbeats: [] };
    } else
      return { heartbeats: [] };
  }
  // overwrite the storage with the provided heartbeats
  async overwrite(t) {
    if (await this._canUseIndexedDBPromise) {
      const r = await this.read();
      return De(this.app, {
        lastSentHeartbeatDate: t.lastSentHeartbeatDate ?? r.lastSentHeartbeatDate,
        heartbeats: t.heartbeats
      });
    } else
      return;
  }
  // add heartbeats
  async add(t) {
    if (await this._canUseIndexedDBPromise) {
      const r = await this.read();
      return De(this.app, {
        lastSentHeartbeatDate: t.lastSentHeartbeatDate ?? r.lastSentHeartbeatDate,
        heartbeats: [
          ...r.heartbeats,
          ...t.heartbeats
        ]
      });
    } else
      return;
  }
}
function ve(e) {
  return We(
    // heartbeatsCache wrapper properties
    JSON.stringify({ version: 2, heartbeats: e })
  ).length;
}
function Gn(e) {
  if (e.length === 0)
    return -1;
  let t = 0, n = e[0].date;
  for (let r = 1; r < e.length; r++)
    e[r].date < n && (n = e[r].date, t = r);
  return t;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Jn(e) {
  T(new I(
    "platform-logger",
    (t) => new an(t),
    "PRIVATE"
    /* ComponentType.PRIVATE */
  )), T(new I(
    "heartbeat",
    (t) => new Wn(t),
    "PRIVATE"
    /* ComponentType.PRIVATE */
  )), S(ne, Te, e), S(ne, Te, "esm2020"), S("fire-js", "");
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Jn("");
var Qn = "firebase", Yn = "12.19.0";
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
S(Qn, Yn, "app");
const tt = "@firebase/installations", ce = "0.6.24";
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const nt = 1e4, rt = `w:${ce}`, it = "FIS_v2", Xn = "https://firebaseinstallations.googleapis.com/v1", Zn = 60 * 60 * 1e3, er = "installations", tr = "Installations";
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const nr = {
  "missing-app-config-values": 'Missing App configuration value: "{$valueName}"',
  "not-registered": "Firebase Installation is not registered.",
  "installation-not-found": "Firebase Installation not found.",
  "request-failed": '{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',
  "app-offline": "Could not process request. Application offline.",
  "delete-pending-registration": "Can't delete installation while there is a pending registration request."
}, E = new j(er, tr, nr);
function ot(e) {
  return e instanceof A && e.code.includes(
    "request-failed"
    /* ErrorCode.REQUEST_FAILED */
  );
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function st({ projectId: e }) {
  return `${Xn}/projects/${e}/installations`;
}
function at(e) {
  return {
    token: e.token,
    requestStatus: 2,
    expiresIn: ir(e.expiresIn),
    creationTime: Date.now()
  };
}
async function ct(e, t) {
  const r = (await t.json()).error;
  return E.create("request-failed", {
    requestName: e,
    serverCode: r.code,
    serverMessage: r.message,
    serverStatus: r.status
  });
}
function ut({ apiKey: e }) {
  return new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-goog-api-key": e
  });
}
function rr(e, { refreshToken: t }) {
  const n = ut(e);
  return n.append("Authorization", or(t)), n;
}
async function dt(e) {
  const t = await e();
  return t.status >= 500 && t.status < 600 ? e() : t;
}
function ir(e) {
  return Number(e.replace("s", "000"));
}
function or(e) {
  return `${it} ${e}`;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function sr({ appConfig: e, heartbeatServiceProvider: t }, { fid: n }) {
  const r = st(e), i = ut(e), o = t.getImmediate({
    optional: !0
  });
  if (o) {
    const c = await o.getHeartbeatsHeader();
    c && i.append("x-firebase-client", c);
  }
  const s = {
    fid: n,
    authVersion: it,
    appId: e.appId,
    sdkVersion: rt
  }, a = {
    method: "POST",
    headers: i,
    body: JSON.stringify(s)
  }, u = await dt(() => fetch(r, a));
  if (u.ok) {
    const c = await u.json();
    return {
      fid: c.fid || n,
      registrationStatus: 2,
      refreshToken: c.refreshToken,
      authToken: at(c.authToken)
    };
  } else
    throw await ct("Create Installation", u);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function ft(e) {
  return new Promise((t) => {
    setTimeout(t, e);
  });
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function ar(e) {
  return btoa(String.fromCharCode(...e)).replace(/\+/g, "-").replace(/\//g, "_");
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const cr = /^[cdef][\w-]{21}$/, oe = "";
function ur() {
  try {
    const e = new Uint8Array(17);
    (self.crypto || self.msCrypto).getRandomValues(e), e[0] = 112 + e[0] % 16;
    const n = dr(e);
    return cr.test(n) ? n : oe;
  } catch {
    return oe;
  }
}
function dr(e) {
  return ar(e).substr(0, 22);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function U(e) {
  return `${e.appName}!${e.appId}`;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const lt = /* @__PURE__ */ new Map();
function ht(e, t) {
  const n = U(e);
  pt(n, t), fr(n, t);
}
function pt(e, t) {
  const n = lt.get(e);
  if (n)
    for (const r of n)
      r(t);
}
function fr(e, t) {
  const n = lr();
  n && n.postMessage({ key: e, fid: t }), hr();
}
let y = null;
function lr() {
  return !y && "BroadcastChannel" in self && (y = new BroadcastChannel("[Firebase] FID Change"), y.onmessage = (e) => {
    pt(e.data.key, e.data.fid);
  }), y;
}
function hr() {
  lt.size === 0 && y && (y.close(), y = null);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const pr = "firebase-installations-database", gr = 1, _ = "firebase-installations-store";
let J = null;
function ue() {
  return J || (J = V(pr, gr, {
    upgrade: (e, t) => {
      switch (t) {
        case 0:
          e.createObjectStore(_);
      }
    }
  })), J;
}
async function x(e, t) {
  const n = U(e), i = (await ue()).transaction(_, "readwrite"), o = i.objectStore(_), s = await o.get(n);
  return await o.put(t, n), await i.done, (!s || s.fid !== t.fid) && ht(e, t.fid), t;
}
async function gt(e) {
  const t = U(e), r = (await ue()).transaction(_, "readwrite");
  await r.objectStore(_).delete(t), await r.done;
}
async function K(e, t) {
  const n = U(e), i = (await ue()).transaction(_, "readwrite"), o = i.objectStore(_), s = await o.get(n), a = t(s);
  return a === void 0 ? await o.delete(n) : await o.put(a, n), await i.done, a && (!s || s.fid !== a.fid) && ht(e, a.fid), a;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function de(e) {
  let t;
  const n = await K(e.appConfig, (r) => {
    const i = br(r), o = mr(e, i);
    return t = o.registrationPromise, o.installationEntry;
  });
  return n.fid === oe ? { installationEntry: await t } : {
    installationEntry: n,
    registrationPromise: t
  };
}
function br(e) {
  const t = e || {
    fid: ur(),
    registrationStatus: 0
    /* RequestStatus.NOT_STARTED */
  };
  return bt(t);
}
function mr(e, t) {
  if (t.registrationStatus === 0) {
    if (!navigator.onLine) {
      const i = Promise.reject(E.create(
        "app-offline"
        /* ErrorCode.APP_OFFLINE */
      ));
      return {
        installationEntry: t,
        registrationPromise: i
      };
    }
    const n = {
      fid: t.fid,
      registrationStatus: 1,
      registrationTime: Date.now()
    }, r = wr(e, n);
    return { installationEntry: n, registrationPromise: r };
  } else return t.registrationStatus === 1 ? {
    installationEntry: t,
    registrationPromise: yr(e)
  } : { installationEntry: t };
}
async function wr(e, t) {
  try {
    const n = await sr(e, t);
    return x(e.appConfig, n);
  } catch (n) {
    throw ot(n) && n.customData.serverCode === 409 ? await gt(e.appConfig) : await x(e.appConfig, {
      fid: t.fid,
      registrationStatus: 0
      /* RequestStatus.NOT_STARTED */
    }), n;
  }
}
async function yr(e) {
  let t = await ke(e.appConfig);
  for (; t.registrationStatus === 1; )
    await ft(100), t = await ke(e.appConfig);
  if (t.registrationStatus === 0) {
    const { installationEntry: n, registrationPromise: r } = await de(e);
    return r || n;
  }
  return t;
}
function ke(e) {
  return K(e, (t) => {
    if (!t)
      throw E.create(
        "installation-not-found"
        /* ErrorCode.INSTALLATION_NOT_FOUND */
      );
    return bt(t);
  });
}
function bt(e) {
  return Ir(e) ? {
    fid: e.fid,
    registrationStatus: 0
    /* RequestStatus.NOT_STARTED */
  } : e;
}
function Ir(e) {
  return e.registrationStatus === 1 && e.registrationTime + nt < Date.now();
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function Er({ appConfig: e, heartbeatServiceProvider: t }, n) {
  const r = _r(e, n), i = rr(e, n), o = t.getImmediate({
    optional: !0
  });
  if (o) {
    const c = await o.getHeartbeatsHeader();
    c && i.append("x-firebase-client", c);
  }
  const s = {
    installation: {
      sdkVersion: rt,
      appId: e.appId
    }
  }, a = {
    method: "POST",
    headers: i,
    body: JSON.stringify(s)
  }, u = await dt(() => fetch(r, a));
  if (u.ok) {
    const c = await u.json();
    return at(c);
  } else
    throw await ct("Generate Auth Token", u);
}
function _r(e, { fid: t }) {
  return `${st(e)}/${t}/authTokens:generate`;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function fe(e, t = !1) {
  let n;
  const r = await K(e.appConfig, (o) => {
    if (!mt(o))
      throw E.create(
        "not-registered"
        /* ErrorCode.NOT_REGISTERED */
      );
    const s = o.authToken;
    if (!t && Ar(s))
      return o;
    if (s.requestStatus === 1)
      return n = Sr(e, t), o;
    {
      if (!navigator.onLine)
        throw E.create(
          "app-offline"
          /* ErrorCode.APP_OFFLINE */
        );
      const a = Cr(o);
      return n = Tr(e, a), a;
    }
  });
  return n ? await n : r.authToken;
}
async function Sr(e, t) {
  let n = await Oe(e.appConfig);
  for (; n.authToken.requestStatus === 1; )
    await ft(100), n = await Oe(e.appConfig);
  const r = n.authToken;
  return r.requestStatus === 0 ? fe(e, t) : r;
}
function Oe(e) {
  return K(e, (t) => {
    if (!mt(t))
      throw E.create(
        "not-registered"
        /* ErrorCode.NOT_REGISTERED */
      );
    const n = t.authToken;
    return vr(n) ? {
      ...t,
      authToken: {
        requestStatus: 0
        /* RequestStatus.NOT_STARTED */
      }
    } : t;
  });
}
async function Tr(e, t) {
  try {
    const n = await Er(e, t), r = {
      ...t,
      authToken: n
    };
    return await x(e.appConfig, r), n;
  } catch (n) {
    if (ot(n) && (n.customData.serverCode === 401 || n.customData.serverCode === 404))
      await gt(e.appConfig);
    else {
      const r = {
        ...t,
        authToken: {
          requestStatus: 0
          /* RequestStatus.NOT_STARTED */
        }
      };
      await x(e.appConfig, r);
    }
    throw n;
  }
}
function mt(e) {
  return e !== void 0 && e.registrationStatus === 2;
}
function Ar(e) {
  return e.requestStatus === 2 && !Dr(e);
}
function Dr(e) {
  const t = Date.now();
  return t < e.creationTime || e.creationTime + e.expiresIn < t + Zn;
}
function Cr(e) {
  const t = {
    requestStatus: 1,
    requestTime: Date.now()
  };
  return {
    ...e,
    authToken: t
  };
}
function vr(e) {
  return e.requestStatus === 1 && e.requestTime + nt < Date.now();
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function kr(e) {
  const t = e, { installationEntry: n, registrationPromise: r } = await de(t);
  return r ? r.catch(console.error) : fe(t).catch(console.error), n.fid;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function Or(e, t = !1) {
  const n = e;
  return await Rr(n), (await fe(n, t)).token;
}
async function Rr(e) {
  const { registrationPromise: t } = await de(e);
  t && await t;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Nr(e) {
  if (!e || !e.options)
    throw Q("App Configuration");
  if (!e.name)
    throw Q("App Name");
  const t = [
    "projectId",
    "apiKey",
    "appId"
  ];
  for (const n of t)
    if (!e.options[n])
      throw Q(n);
  return {
    appName: e.name,
    projectId: e.options.projectId,
    apiKey: e.options.apiKey,
    appId: e.options.appId
  };
}
function Q(e) {
  return E.create("missing-app-config-values", {
    valueName: e
  });
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const wt = "installations", Mr = "installations-internal", Br = (e) => {
  const t = e.getProvider("app").getImmediate(), n = Nr(t), r = ae(t, "heartbeat");
  return {
    app: t,
    appConfig: n,
    heartbeatServiceProvider: r,
    _delete: () => Promise.resolve()
  };
}, Fr = (e) => {
  const t = e.getProvider("app").getImmediate(), n = ae(t, wt).getImmediate();
  return {
    getId: () => kr(n),
    getToken: (i) => Or(n, i)
  };
};
function $r() {
  T(new I(
    wt,
    Br,
    "PUBLIC"
    /* ComponentType.PUBLIC */
  )), T(new I(
    Mr,
    Fr,
    "PRIVATE"
    /* ComponentType.PRIVATE */
  ));
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
$r();
S(tt, ce);
S(tt, ce, "esm2020");
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const le = "BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4", Lr = "https://fcmregistrations.googleapis.com/v1", yt = "FCM_MSG", Pr = "google.c.a.c_id", Re = 1e3, Ne = 3, It = 864e5, xr = 5e3, Hr = 1249, jr = 3, Vr = 1;
var H;
(function(e) {
  e[e.DATA_MESSAGE = 1] = "DATA_MESSAGE", e[e.DISPLAY_NOTIFICATION = 3] = "DISPLAY_NOTIFICATION";
})(H || (H = {}));
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
var N;
(function(e) {
  e.PUSH_RECEIVED = "push-received", e.NOTIFICATION_CLICKED = "notification-clicked", e.FID_REGISTERED = "fid-registered";
})(N || (N = {}));
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function l(e) {
  const t = new Uint8Array(e);
  return btoa(String.fromCharCode(...t)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function Et(e) {
  const t = "=".repeat((4 - e.length % 4) % 4), n = (e + t).replace(/\-/g, "+").replace(/_/g, "/"), r = atob(n), i = new Uint8Array(r.length);
  for (let o = 0; o < r.length; ++o)
    i[o] = r.charCodeAt(o);
  return i;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Y = "fcm_token_details_db", Ur = 5, Me = "fcm_token_object_Store";
async function Kr(e) {
  if ("databases" in indexedDB && !(await indexedDB.databases()).map((o) => o.name).includes(Y))
    return null;
  let t = null;
  return (await V(Y, Ur, {
    upgrade: async (r, i, o, s) => {
      if (i < 2 || !r.objectStoreNames.contains(Me))
        return;
      const a = s.objectStore(Me), u = await a.index("fcmSenderId").get(e);
      if (await a.clear(), !!u) {
        if (i === 2) {
          const c = u;
          if (!c.auth || !c.p256dh || !c.endpoint)
            return;
          t = {
            token: c.fcmToken,
            createTime: c.createTime ?? Date.now(),
            subscriptionOptions: {
              auth: c.auth,
              p256dh: c.p256dh,
              endpoint: c.endpoint,
              swScope: c.swScope,
              vapidKey: typeof c.vapidKey == "string" ? c.vapidKey : l(c.vapidKey)
            }
          };
        } else if (i === 3) {
          const c = u;
          t = {
            token: c.fcmToken,
            createTime: c.createTime,
            subscriptionOptions: {
              auth: l(c.auth),
              p256dh: l(c.p256dh),
              endpoint: c.endpoint,
              swScope: c.swScope,
              vapidKey: l(c.vapidKey)
            }
          };
        } else if (i === 4) {
          const c = u;
          t = {
            token: c.fcmToken,
            createTime: c.createTime,
            subscriptionOptions: {
              auth: l(c.auth),
              p256dh: l(c.p256dh),
              endpoint: c.endpoint,
              swScope: c.swScope,
              vapidKey: l(c.vapidKey)
            }
          };
        }
      }
    }
  })).close(), await L(Y), await L("fcm_vapid_details_db"), await L("undefined"), Wr(t) ? t : null;
}
function Wr(e) {
  if (!e || !e.subscriptionOptions)
    return !1;
  const { subscriptionOptions: t } = e;
  return typeof e.createTime == "number" && e.createTime > 0 && typeof e.token == "string" && e.token.length > 0 && typeof t.auth == "string" && t.auth.length > 0 && typeof t.p256dh == "string" && t.p256dh.length > 0 && typeof t.endpoint == "string" && t.endpoint.length > 0 && typeof t.swScope == "string" && t.swScope.length > 0 && typeof t.vapidKey == "string" && t.vapidKey.length > 0;
}
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const qr = {
  "missing-app-config-values": 'Missing App configuration value: "{$valueName}"',
  "only-available-in-window": "This method is available in a Window context.",
  "only-available-in-sw": "This method is available in a service worker context.",
  "permission-default": "The notification permission was not granted and dismissed instead.",
  "permission-blocked": "The notification permission was not granted and blocked instead.",
  "unsupported-browser": "This browser doesn't support the API's required to use the Firebase SDK.",
  "indexed-db-unsupported": "This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)",
  "failed-service-worker-registration": "We are unable to register the default service worker. {$browserErrorMessage}",
  "token-subscribe-failed": "A problem occurred while subscribing the user to FCM: {$errorInfo}",
  "token-subscribe-no-token": "FCM returned no token when subscribing the user to push.",
  "fid-registration-failed": "A problem occurred while creating an FCM registration via FID: {$errorInfo}",
  "fid-unregister-failed": "A problem occurred while unregistering the FCM registration via FID: {$errorInfo}",
  "fid-registration-idb-schema-unavailable": "Unable to read or persist FID registration metadata because the messaging IndexedDB schema is unavailable (for example, the database could not be upgraded to the latest version).",
  "token-unsubscribe-failed": "A problem occurred while unsubscribing the user from FCM: {$errorInfo}",
  "token-update-failed": "A problem occurred while updating the user from FCM: {$errorInfo}",
  "token-update-no-token": "FCM returned no token when updating the user to push.",
  "use-sw-after-get-token": "The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.",
  "invalid-sw-registration": "The input to useServiceWorker() must be a ServiceWorkerRegistration.",
  "invalid-bg-handler": "The input to setBackgroundMessageHandler() must be a function.",
  "invalid-vapid-key": "The public VAPID key must be a string.",
  "use-vapid-key-after-get-token": "The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.",
  "invalid-on-registered-handler": "No onRegistered callback handler was provided or registered. Implement onRegistered() before register()."
}, f = new j("messaging", "Messaging", qr);
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Be = "firebase-messaging-database", Fe = 2, m = "firebase-messaging-store", h = "firebase-messaging-fid-registration-store", zr = { openDB: V, deleteDB: L };
let $e = zr, O = null;
function Gr(e, t, n) {
  switch (t) {
    case 0:
      if (e.createObjectStore(m), n === 1)
        break;
    case 1:
      n === 2 && e.createObjectStore(h);
  }
}
function Le(e) {
  return {
    upgrade: (t, n) => {
      Gr(t, n, e);
    },
    blocked: () => {
    },
    blocking: (t, n, r) => {
      var i;
      O = null, (i = r.target) == null || i.close();
    },
    terminated: () => {
      O = null;
    }
  };
}
function D() {
  return O || (O = $e.openDB(Be, Fe, Le(2)).catch(() => $e.openDB(Be, Fe - 1, Le(1)))), O;
}
function _t(e, t) {
  return e.objectStoreNames.contains(t);
}
function he(e) {
  if (!_t(e, h))
    throw f.create(
      "fid-registration-idb-schema-unavailable"
      /* ErrorCode.FID_REGISTRATION_IDB_SCHEMA_UNAVAILABLE */
    );
}
async function pe(e) {
  const t = C(e), r = await (await D()).transaction(m).objectStore(m).get(t);
  if (r)
    return r;
  {
    const i = await Kr(e.appConfig.senderId);
    if (i)
      return await ge(e, i), i;
  }
}
async function ge(e, t) {
  const n = C(e), r = await D(), i = [m], o = _t(r, h);
  o && i.push(h);
  const s = r.transaction(i, "readwrite");
  return await s.objectStore(m).put(t, n), o && await s.objectStore(h).delete(n), await s.done, t;
}
async function Jr(e) {
  const t = C(e), r = (await D()).transaction(m, "readwrite");
  await r.objectStore(m).delete(t), await r.done;
}
async function be(e) {
  const t = C(e), n = await D();
  return he(n), await n.transaction(h).objectStore(h).get(t);
}
async function Qr(e, t) {
  const n = C(e), r = await D();
  he(r);
  const i = r.transaction([m, h], "readwrite");
  return await i.objectStore(h).put(t, n), await i.objectStore(m).delete(n), await i.done, t;
}
async function Yr(e) {
  const t = C(e), n = await D();
  he(n);
  const r = n.transaction(h, "readwrite");
  await r.objectStore(h).delete(t), await r.done;
}
function C({ appConfig: e }) {
  return e.appId;
}
const Xr = "0.13.3";
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Zr = 3, ei = 1e3;
async function ti(e, t) {
  const n = await B(e), r = me(
    t,
    e.appConfig.appName,
    /* includeSdkVersion= */
    !1
  ), i = {
    method: "POST",
    headers: n,
    body: JSON.stringify(r)
  };
  let o;
  try {
    o = await (await fetch(M(e.appConfig), i)).json();
  } catch (s) {
    throw f.create("token-subscribe-failed", {
      errorInfo: s == null ? void 0 : s.toString()
    });
  }
  if (o.error) {
    const s = o.error.message;
    throw f.create("token-subscribe-failed", {
      errorInfo: s
    });
  }
  if (!o.token)
    throw f.create(
      "token-subscribe-no-token"
      /* ErrorCode.TOKEN_SUBSCRIBE_NO_TOKEN */
    );
  return o.token;
}
async function ni(e, t) {
  var u;
  const n = await B(e), r = me(
    t,
    e.appConfig.appName,
    /* includeSdkVersion= */
    !0
  ), i = {
    method: "POST",
    headers: n,
    body: JSON.stringify(r)
  };
  let o;
  try {
    o = await ai(() => fetch(M(e.appConfig), i), Zr, ei);
  } catch (c) {
    throw f.create("fid-registration-failed", {
      errorInfo: c == null ? void 0 : c.toString()
    });
  }
  if (o.ok)
    return { responseFid: await ii(o) };
  let s;
  try {
    s = await o.json();
  } catch {
    throw f.create("fid-registration-failed", {
      errorInfo: o.statusText
    });
  }
  const a = ((u = s.error) == null ? void 0 : u.message) ?? o.statusText;
  throw f.create("fid-registration-failed", {
    errorInfo: a
  });
}
async function ri(e, t) {
  var o;
  const r = {
    method: "DELETE",
    headers: await B(e)
  };
  let i;
  try {
    i = await fetch(`${M(e.appConfig)}/${t}`, r);
  } catch (s) {
    throw f.create("fid-unregister-failed", {
      errorInfo: s == null ? void 0 : s.toString()
    });
  }
  if (!i.ok)
    try {
      throw ((o = (await i.json()).error) == null ? void 0 : o.message) ?? i.statusText;
    } catch (s) {
      throw f.create("fid-unregister-failed", {
        errorInfo: typeof s == "string" && s || i.statusText || (s == null ? void 0 : s.toString())
      });
    }
}
async function ii(e) {
  const t = await e.text();
  if (!t.trim())
    throw f.create("fid-registration-failed", {
      errorInfo: "CreateRegistration succeeded but response body is empty"
    });
  let n;
  try {
    n = JSON.parse(t);
  } catch {
    throw f.create("fid-registration-failed", {
      errorInfo: "CreateRegistration succeeded but response body is not valid JSON"
    });
  }
  const r = n.name;
  if (typeof r != "string" || r.length === 0)
    throw f.create("fid-registration-failed", {
      errorInfo: "CreateRegistration succeeded but response did not include a non-empty name"
    });
  return oi(r);
}
const Pe = "/registrations/";
function oi(e) {
  const t = e.indexOf(Pe);
  if (t !== -1) {
    const n = e.slice(t + Pe.length);
    if (n.length > 0)
      return n;
  }
  throw f.create("fid-registration-failed", {
    errorInfo: "CreateRegistration succeeded but response name is not a valid registration resource name"
  });
}
async function si(e, t) {
  const n = await B(e), r = me(
    t.subscriptionOptions,
    e.appConfig.appName,
    /* includeSdkVersion= */
    !1
  ), i = {
    method: "PATCH",
    headers: n,
    body: JSON.stringify(r)
  };
  let o;
  try {
    o = await (await fetch(`${M(e.appConfig)}/${t.token}`, i)).json();
  } catch (s) {
    throw f.create("token-update-failed", {
      errorInfo: s == null ? void 0 : s.toString()
    });
  }
  if (o.error) {
    const s = o.error.message;
    throw f.create("token-update-failed", {
      errorInfo: s
    });
  }
  if (!o.token)
    throw f.create(
      "token-update-no-token"
      /* ErrorCode.TOKEN_UPDATE_NO_TOKEN */
    );
  return o.token;
}
async function St(e, t) {
  const r = {
    method: "DELETE",
    headers: await B(e)
  };
  try {
    const o = await (await fetch(`${M(e.appConfig)}/${t}`, r)).json();
    if (o.error) {
      const s = o.error.message;
      throw f.create("token-unsubscribe-failed", {
        errorInfo: s
      });
    }
  } catch (i) {
    throw f.create("token-unsubscribe-failed", {
      errorInfo: i == null ? void 0 : i.toString()
    });
  }
}
async function ai(e, t, n) {
  let r;
  for (let i = 0; i < t; i++)
    try {
      return await e();
    } catch (o) {
      if (r = o, i < t - 1) {
        const s = n * Math.pow(2, i);
        await new Promise((a) => setTimeout(a, s));
      }
    }
  throw r;
}
function M({ projectId: e }) {
  return `${Lr}/projects/${e}/registrations`;
}
async function B({ appConfig: e, installations: t }) {
  const n = await t.getToken();
  return new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-goog-api-key": e.apiKey,
    "x-goog-firebase-installations-auth": `FIS ${n}`
  });
}
function ci(e, t) {
  var n, r;
  try {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e))
      return new URL(e).host;
  } catch {
  }
  try {
    if (typeof self < "u" && ((n = self.location) != null && n.href))
      return new URL(e, self.location.origin).host;
  } catch {
  }
  return typeof self < "u" && ((r = self.location) != null && r.host) ? self.location.host : t;
}
function me({ p256dh: e, auth: t, endpoint: n, vapidKey: r, swScope: i }, o, s) {
  const a = {
    web: {
      origin: ci(i, o),
      endpoint: n,
      auth: t,
      p256dh: e
    }
  };
  return s && (a.fcm_sdk_version = Xr), r !== le && (a.web.applicationPubKey = r), a;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ui = 7 * 24 * 60 * 60 * 1e3;
async function di(e) {
  const t = await pi(e.swRegistration, e.vapidKey), n = {
    vapidKey: e.vapidKey,
    swScope: e.swRegistration.scope,
    endpoint: t.endpoint,
    auth: l(t.getKey("auth")),
    p256dh: l(t.getKey("p256dh"))
  }, r = await pe(e.firebaseDependencies);
  if (r) {
    if (gi(r.subscriptionOptions, n))
      return Date.now() >= r.createTime + ui ? hi(e, {
        token: r.token,
        createTime: Date.now(),
        subscriptionOptions: n
      }) : r.token;
    try {
      await St(e.firebaseDependencies, r.token);
    } catch (i) {
      console.warn(i);
    }
    return He(e.firebaseDependencies, n);
  } else return He(e.firebaseDependencies, n);
}
async function fi(e, t) {
  await St(e.firebaseDependencies, t.token), await Jr(e.firebaseDependencies), await Tt(e.firebaseDependencies);
}
async function li(e) {
  const t = await be(e.firebaseDependencies).catch(() => {
  }), n = t == null ? void 0 : t.fid;
  n && await ri(e.firebaseDependencies, n), await Tt(e.firebaseDependencies), n && mi(e, n);
}
async function xe(e) {
  const t = await pe(e.firebaseDependencies);
  t ? await fi(e, t) : await li(e);
  const n = await e.swRegistration.pushManager.getSubscription();
  return n ? n.unsubscribe() : !0;
}
async function hi(e, t) {
  try {
    const n = await si(e.firebaseDependencies, t), r = {
      ...t,
      token: n,
      createTime: Date.now()
    };
    return await ge(e.firebaseDependencies, r), n;
  } catch (n) {
    throw n;
  }
}
async function He(e, t) {
  const r = {
    token: await ti(e, t),
    createTime: Date.now(),
    subscriptionOptions: t
  };
  return await ge(e, r), r.token;
}
async function pi(e, t) {
  const n = await e.pushManager.getSubscription();
  return n || e.pushManager.subscribe({
    userVisibleOnly: !0,
    // Chrome <= 75 doesn't support base64-encoded VAPID key. For backward compatibility, VAPID key
    // submitted to pushManager#subscribe must be of type Uint8Array.
    applicationServerKey: Et(t)
  });
}
function gi(e, t) {
  const n = t.vapidKey === e.vapidKey, r = t.endpoint === e.endpoint, i = t.auth === e.auth, o = t.p256dh === e.p256dh;
  return n && r && i && o;
}
async function Tt(e) {
  try {
    await Yr(e);
  } catch {
  }
}
function bi(e, t) {
  const n = e.onRegisteredHandler;
  n && (typeof n == "function" ? n(t) : n.next(t));
}
function mi(e, t) {
  const n = e.onUnregisteredHandler;
  n && (typeof n == "function" ? n(t) : n.next(t));
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function wi(e, t) {
  t ? e.vapidKey = t : e.vapidKey || (e.vapidKey = le);
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const je = 3;
async function yi(e, t) {
  const n = await Ii(e.swRegistration, e.vapidKey), r = {
    vapidKey: e.vapidKey,
    swScope: e.swRegistration.scope,
    endpoint: n.endpoint,
    auth: l(n.getKey("auth")),
    p256dh: l(n.getKey("p256dh"))
  }, i = e.firebaseDependencies.installations;
  for (let o = 0; o < je; o++) {
    const { responseFid: s } = await ni(e.firebaseDependencies, r);
    if (s === t)
      return;
    o < je - 1 && await i.getToken(!0);
  }
  throw f.create("fid-registration-failed", {
    errorInfo: "CreateRegistration response FID does not match Firebase Installation ID"
  });
}
async function Ii(e, t) {
  const n = await e.pushManager.getSubscription();
  return n || e.pushManager.subscribe({
    userVisibleOnly: !0,
    // `PushManager.subscribe` expects a `BufferSource`; `base64ToArray` produces a typed array.
    // Cast to satisfy the lib typing differences across TS DOM versions.
    applicationServerKey: Et(t)
  });
}
/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function Ei(e) {
  const t = await be(e.firebaseDependencies).catch(() => {
  });
  if (!t)
    return;
  await wi(e, t.vapidKey);
  const n = await e.firebaseDependencies.installations.getId();
  return await yi(e, n), await Qr(e.firebaseDependencies, {
    fid: n,
    lastRegisterTime: Date.now(),
    vapidKey: e.vapidKey
  }), bi(e, n), n;
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function _i(e) {
  const t = {
    from: e.from,
    // eslint-disable-next-line camelcase
    collapseKey: e.collapse_key,
    // eslint-disable-next-line camelcase
    messageId: e.fcmMessageId
  };
  return Si(t, e), Ti(t, e), Ai(t, e), t;
}
function Si(e, t) {
  if (!t.notification)
    return;
  e.notification = {};
  const n = t.notification.title;
  n && (e.notification.title = n);
  const r = t.notification.body;
  r && (e.notification.body = r);
  const i = t.notification.image;
  i && (e.notification.image = i);
  const o = t.notification.icon;
  o && (e.notification.icon = o);
}
function Ti(e, t) {
  t.data && (e.data = t.data);
}
function Ai(e, t) {
  var i, o, s, a;
  if (!t.fcmOptions && !((i = t.notification) != null && i.click_action))
    return;
  e.fcmOptions = {};
  const n = ((o = t.fcmOptions) == null ? void 0 : o.link) ?? ((s = t.notification) == null ? void 0 : s.click_action);
  n && (e.fcmOptions.link = n);
  const r = (a = t.fcmOptions) == null ? void 0 : a.analytics_label;
  r && (e.fcmOptions.analyticsLabel = r);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Di(e) {
  return typeof e == "object" && !!e && Pr in e;
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Ci(e) {
  return new Promise((t) => {
    setTimeout(t, e);
  });
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const vi = "https://play.google.com/log?format=json_proto3", At = 0, ki = Li("AzSCbw63g1R0nCw85jG8", "Iaya3yLKwmgvh7cF0q4");
function Oi(e) {
  e.logQueue.state === "stopped" && e.logEvents.length > 0 && we(e, At);
}
function we(e, t) {
  if (e.logQueue.state === "scheduled" && clearTimeout(e.logQueue.timerId), e.logQueue = { state: "stopped" }, !e.deliveryMetricsExportedToBigQueryEnabled) {
    e.logEvents = [];
    return;
  }
  e.logQueue = {
    state: "scheduled",
    timerId: setTimeout(async () => {
      if (e.logQueue = { state: "flushing" }, !e.logEvents.length)
        return we(e, It);
      await Ri(e);
    }, t)
  };
}
async function Ri(e) {
  const t = e.logEvents;
  e.logEvents = [];
  for (let n = 0, r = t.length; n < r; n += Re) {
    const i = t.slice(n, n + Re);
    if (!i.length)
      break;
    const o = $i(i);
    let s = 0, a = {};
    do {
      try {
        if (a = await fetch(vi.concat("&key=", ki), {
          method: "POST",
          body: JSON.stringify(o)
        }), a.ok || !a.ok && !Ve(a))
          break;
        if (!a.ok && Ve(a))
          throw new Error("a retriable Non-200 code is returned in fetch to Firelog endpoint. Retry");
      } catch {
        if (s === Ne)
          break;
      }
      let u;
      try {
        u = Number((await a.json()).nextRequestWaitMillis);
      } catch {
        u = xr;
      }
      await new Promise((c) => setTimeout(c, u)), s++;
    } while (s < Ne);
  }
  we(e, e.logEvents.length ? At : It);
}
function Ve(e) {
  const t = e.status;
  return t === 429 || t === 500 || t === 503 || t === 504;
}
async function Ni(e, t) {
  const n = Mi(t, await e.firebaseDependencies.installations.getId());
  Bi(e, n, t.productId), Oi(e);
}
function Mi(e, t) {
  var r, i;
  const n = {};
  return e.from && (n.project_number = e.from), e.fcmMessageId && (n.message_id = e.fcmMessageId), n.instance_id = t, e.notification ? n.message_type = H.DISPLAY_NOTIFICATION.toString() : n.message_type = H.DATA_MESSAGE.toString(), n.sdk_platform = jr.toString(), n.package_name = self.origin.replace(/(^\w+:|^)\/\//, ""), e.collapse_key && (n.collapse_key = e.collapse_key), n.event = Vr.toString(), (r = e.fcmOptions) != null && r.analytics_label && (n.analytics_label = (i = e.fcmOptions) == null ? void 0 : i.analytics_label), n;
}
function Bi(e, t, n) {
  const r = {};
  r.event_time_ms = Math.floor(Date.now()).toString(), r.source_extension_json_proto3 = JSON.stringify({
    messaging_client_event: t
  }), n && (r.compliance_data = Fi(n)), e.logEvents.push(r);
}
function Fi(e) {
  return {
    privacy_context: {
      prequest: {
        origin_associated_product_id: e
      }
    }
  };
}
function $i(e) {
  const t = {};
  return t.log_source = Hr.toString(), t.log_event = e, t;
}
function Li(e, t) {
  const n = [];
  for (let r = 0; r < e.length; r++)
    n.push(e.charAt(r)), r < t.length && n.push(t.charAt(r));
  return n.join("");
}
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function Pi(e, t) {
  var o;
  t.swRegistration || (t.swRegistration = self.registration);
  const { newSubscription: n } = e;
  if (!n) {
    await xe(t);
    return;
  }
  if (await be(t.firebaseDependencies).catch(() => {
  })) {
    const s = await Ei(t).catch(() => {
    });
    if (s) {
      const a = await ye();
      Dt(a) && Wi(a, s);
    }
    return;
  }
  const i = await pe(t.firebaseDependencies);
  await xe(t), t.vapidKey = ((o = i == null ? void 0 : i.subscriptionOptions) == null ? void 0 : o.vapidKey) ?? le, await di(t);
}
async function xi(e, t) {
  const n = Vi(e);
  if (!n)
    return;
  t.deliveryMetricsExportedToBigQueryEnabled && await Ni(t, n);
  const r = await ye();
  if (Dt(r))
    return Ki(r, n);
  if (n.notification && await qi(ji(n)), !!t && t.onBackgroundMessageHandler) {
    const i = _i(n);
    typeof t.onBackgroundMessageHandler == "function" ? await t.onBackgroundMessageHandler(i) : t.onBackgroundMessageHandler.next(i);
  }
}
async function Hi(e) {
  var s, a;
  const t = (a = (s = e.notification) == null ? void 0 : s.data) == null ? void 0 : a[yt];
  if (t) {
    if (e.action)
      return;
  } else return;
  e.stopImmediatePropagation(), e.notification.close();
  const n = zi(t);
  if (!n)
    return;
  const r = new URL(n, self.location.href), i = new URL(self.location.origin);
  if (r.host !== i.host)
    return;
  let o = await Ui(r);
  if (o ? o = await o.focus() : (o = await self.clients.openWindow(n), await Ci(3e3)), !!o)
    return t.messageType = N.NOTIFICATION_CLICKED, t.isFirebaseMessaging = !0, o.postMessage(t);
}
function ji(e) {
  const t = {
    ...e.notification
  };
  return t.data = {
    [yt]: e
  }, t;
}
function Vi({ data: e }) {
  if (!e)
    return null;
  try {
    return e.json();
  } catch {
    return null;
  }
}
async function Ui(e) {
  const t = await ye();
  for (const n of t) {
    const r = new URL(n.url, self.location.href);
    if (e.host === r.host)
      return n;
  }
  return null;
}
function Dt(e) {
  return e.some((t) => t.visibilityState === "visible" && // Ignore chrome-extension clients as that matches the background pages of extensions, which
  // are always considered visible for some reason.
  !t.url.startsWith("chrome-extension://"));
}
function Ki(e, t) {
  t.isFirebaseMessaging = !0, t.messageType = N.PUSH_RECEIVED;
  for (const n of e)
    n.postMessage(t);
}
function Wi(e, t) {
  const n = {
    isFirebaseMessaging: !0,
    messageType: N.FID_REGISTERED,
    fid: t
  };
  for (const r of e)
    r.postMessage(n);
}
function ye() {
  return self.clients.matchAll({
    type: "window",
    includeUncontrolled: !0
    // TS doesn't know that "type: 'window'" means it'll return WindowClient[]
  });
}
function qi(e) {
  const { actions: t } = e, { maxActions: n } = Notification;
  return t && n && t.length > n && console.warn(`This browser only supports ${n} actions. The remaining actions will not be displayed.`), self.registration.showNotification(
    /* title= */
    e.title ?? "",
    e
  );
}
function zi(e) {
  var n, r;
  const t = ((n = e.fcmOptions) == null ? void 0 : n.link) ?? ((r = e.notification) == null ? void 0 : r.click_action);
  return t || (Di(e.data) ? self.location.origin : null);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Gi(e) {
  if (!e || !e.options)
    throw X("App Configuration Object");
  if (!e.name)
    throw X("App Name");
  const t = [
    "projectId",
    "apiKey",
    "appId",
    "messagingSenderId"
  ], { options: n } = e;
  for (const r of t)
    if (!n[r])
      throw X(r);
  return {
    appName: e.name,
    projectId: n.projectId,
    apiKey: n.apiKey,
    appId: n.appId,
    senderId: n.messagingSenderId
  };
}
function X(e) {
  return f.create("missing-app-config-values", {
    valueName: e
  });
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Ji {
  constructor(t, n, r) {
    this.deliveryMetricsExportedToBigQueryEnabled = !1, this.onBackgroundMessageHandler = null, this.onMessageHandler = null, this.onRegisteredHandler = null, this.onUnregisteredHandler = null, this._registerNotifyChain = Promise.resolve(), this._fidChangeUnsubscribe = null, this.logEvents = [], this.logQueue = { state: "stopped" };
    const i = Gi(t);
    this.firebaseDependencies = {
      app: t,
      appConfig: i,
      installations: n,
      analyticsProvider: r
    };
  }
  _delete() {
    return this._fidChangeUnsubscribe && (this._fidChangeUnsubscribe(), this._fidChangeUnsubscribe = null), this.logQueue.state === "scheduled" && clearTimeout(this.logQueue.timerId), this.logQueue = { state: "stopped" }, Promise.resolve();
  }
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const Qi = (e) => {
  const t = new Ji(e.getProvider("app").getImmediate(), e.getProvider("installations-internal").getImmediate(), e.getProvider("analytics-internal"));
  return self.addEventListener("push", (n) => {
    n.waitUntil(xi(n, t));
  }), self.addEventListener("pushsubscriptionchange", (n) => {
    n.waitUntil(Pi(n, t));
  }), self.addEventListener("notificationclick", (n) => {
    n.waitUntil(Hi(n));
  }), t;
};
function Yi() {
  T(new I(
    "messaging-sw",
    Qi,
    "PUBLIC"
    /* ComponentType.PUBLIC */
  ));
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function Xi() {
  return ze() && await Ge() && "PushManager" in self && "Notification" in self && ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification") && PushSubscription.prototype.hasOwnProperty("getKey");
}
/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function Zi(e, t) {
  if (self.document !== void 0)
    throw f.create(
      "only-available-in-sw"
      /* ErrorCode.AVAILABLE_IN_SW */
    );
  return e.onBackgroundMessageHandler = t, () => {
    e.onBackgroundMessageHandler = null;
  };
}
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function eo(e = xn()) {
  return Xi().then((t) => {
    if (!t)
      throw f.create(
        "unsupported-browser"
        /* ErrorCode.UNSUPPORTED_BROWSER */
      );
  }, (t) => {
    throw f.create(
      "indexed-db-unsupported"
      /* ErrorCode.INDEXED_DB_UNSUPPORTED */
    );
  }), ae(Je(e), "messaging-sw").getImmediate();
}
function to(e, t) {
  return e = Je(e), Zi(e, t);
}
/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Yi();
const no = {
  apiKey: "AIzaSyCiULFiI39ohot_AtyT-pLU3mnp2vHbCBM",
  authDomain: "my-new-bigstock-holder.firebaseapp.com",
  projectId: "my-new-bigstock-holder",
  storageBucket: "my-new-bigstock-holder.firebasestorage.app",
  messagingSenderId: "880401522074",
  appId: "1:880401522074:web:12c6a3776707ae7dd4ee23"
}, ro = Xe(no), io = eo(ro);
to(
  io,
  (e) => {
    var r, i, o, s, a, u;
    if (console.log(
      "[FCM SW] Background message:",
      e
    ), ((r = e.data) == null ? void 0 : r.type) === "DEVICE_VERIFY") {
      console.log(
        "[FCM SW] DEVICE_VERIFY received."
      );
      return;
    }
    const t = ((i = e.notification) == null ? void 0 : i.title) ?? ((o = e.data) == null ? void 0 : o.title) ?? "BigStock", n = {
      body: ((s = e.notification) == null ? void 0 : s.body) ?? ((a = e.data) == null ? void 0 : a.body) ?? "",
      icon: "/favicon.ico",
      data: {
        url: ((u = e.data) == null ? void 0 : u.url) ?? "/"
      }
    };
    self.registration.showNotification(
      t,
      n
    );
  }
);
self.addEventListener(
  "notificationclick",
  (e) => {
    var n;
    e.notification.close();
    const t = ((n = e.notification.data) == null ? void 0 : n.url) ?? "/";
    e.waitUntil(
      self.clients.matchAll({
        type: "window",
        includeUncontrolled: !0
      }).then(async (r) => {
        for (const i of r)
          if (i instanceof WindowClient)
            return await i.navigate(
              t
            ), i.focus();
        return self.clients.openWindow(
          t
        );
      })
    );
  }
);
