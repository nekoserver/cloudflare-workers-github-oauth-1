// このファイルは scripts/build-moonbit.mjs が moonbit/buildlog/ から生成する。手で編集しないこと。
// コンパイラ: @moonbit/moonc-worker 0.1.202608195+6e6c44045 (moonc v0.10.9+6e6c44045) / target: js
const $reinterpret_view = new DataView(new ArrayBuffer(8));
function $i64_reinterpret_f64(a) {
  $reinterpret_view.setBigUint64(0, BigInt.asUintN(64, a), false);
  return $reinterpret_view.getFloat64(0, false);
}
function _M0TPB13StringBuilder(param0) {
  this.val = param0;
}
const _M0FPB12random__seed = () => {
  if (globalThis.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] | 0; // Convert to signed 32
  } else {
    return Math.floor(Math.random() * 0x100000000) | 0; // Fallback to Math.random
  }
};
const _M0FPB21int64__to__string__js = (num, radix) => BigInt.asIntN(64, num).toString(radix);
function _M0TPB4IterGUlRP210nekoserver8buildlog4StepEE(param0, param1) {
  this.f = param0;
  this.size_hint = param1;
}
class $PanicError extends Error {}
function $panic() {
  throw new $PanicError();
}
function $bound_check(arr, index) {
  if (index < 0 || index >= arr.length) throw new Error("Index out of bounds");
}
function _M0TPC16string10StringView(param0, param1, param2) {
  this.str = param0;
  this.start = param1;
  this.end = param2;
}
const _M0MPB7JSArray4push = (arr, val) => { arr.push(val); };
function _M0TPB12MutArrayViewGRP210nekoserver8buildlog4StepE(param0, param1, param2) {
  this.buf = param0;
  this.start = param1;
  this.end = param2;
}
function $make_array_len_and_init(a, b) {
  const arr = new Array(a);
  arr.fill(b);
  return arr;
}
function _M0TPB3MapGlRP210nekoserver8buildlog4StepE(param0, param1, param2, param3, param4, param5, param6) {
  this.entries = param0;
  this.size = param1;
  this.capacity = param2;
  this.capacity_mask = param3;
  this.grow_at = param4;
  this.head = param5;
  this.tail = param6;
}
function _M0TPB5EntryGlRP210nekoserver8buildlog4StepE(param0, param1, param2, param3, param4, param5) {
  this.prev = param0;
  this.next = param1;
  this.psl = param2;
  this.hash = param3;
  this.key = param4;
  this.value = param5;
}
function _M0TPB8MutLocalGORPB5EntryGlRP210nekoserver8buildlog4StepEE(param0) {
  this.val = param0;
}
function _M0TPB8MutLocalGiE(param0) {
  this.val = param0;
}
function $compare_int64(a, b) {
  const c = BigInt.asIntN(64, a);
  const d = BigInt.asIntN(64, b);
  if (c < d) return -1;
  if (c > d) return 1;
  return 0;
}
const _M0FP210nekoserver8buildlog10js__number = (s) => Number(s);
function _M0TP210nekoserver8buildlog4Step(param0, param1, param2, param3) {
  this.id = param0;
  this.label = param1;
  this.state = param2;
  this.seconds = param3;
}
function _M0DTPC16option6OptionGdE4None() {}
_M0DTPC16option6OptionGdE4None.prototype.$tag = 0;
const _M0DTPC16option6OptionGdE4None__ = new _M0DTPC16option6OptionGdE4None();
function _M0DTPC16option6OptionGdE4Some(param0) {
  this._0 = param0;
}
_M0DTPC16option6OptionGdE4Some.prototype.$tag = 1;
const _M0FP210nekoserver8buildlog20js__number__to__json = (v) => JSON.stringify(v);
function _M0TPB9ArrayViewGUlRP210nekoserver8buildlog4StepEE(param0, param1, param2) {
  this.buf = param0;
  this.start = param1;
  this.end = param2;
}
const _M0FPB18double__max__value = $i64_reinterpret_f64(9218868437227405311n);
const _M0FPB18double__min__value = $i64_reinterpret_f64(18442240474082181119n);
const _M0MPB4Iter4nextN6constrS9385GUlRP210nekoserver8buildlog4StepEE = 0;
const _M0MPB4Iter4nextN6constrS9386GUlRP210nekoserver8buildlog4StepEE = 0;
const _M0MPB4Iter3newN6constrS9393GUlRP210nekoserver8buildlog4StepEE = 0;
const _M0FP210nekoserver8buildlog11placeholder = "（処理名未取得）";
const _M0FP210nekoserver8buildlog18max__safe__integer = 9007199254740991n;
const _M0FP210nekoserver8buildlog11skip__words = ["transferring", "exporting layers", "exporting manifest", "exporting config", "naming to", "unpacking to", "pushing layers", "pushing manifest", "writing image"];
const _M0FP210nekoserver8buildlog11step__words = ["exporting to image", "exporting cache", "importing cache manifest", "building with", "resolve image config", "preparing build context"];
const _M0FP210nekoserver8buildlog12json__stringN3hexS19 = "0123456789abcdef";
const _M0FPB4seed = _M0FPB12random__seed();
function _M0FPB13consume4__acc(acc, input) {
  const _p = (acc >>> 0) + ((Math.imul(input, -1028477379) | 0) >>> 0) | 0;
  const _p$2 = 17;
  return Math.imul(_p << _p$2 | (_p >>> (32 - _p$2 | 0) | 0), 668265263) | 0;
}
function _M0MPB13StringBuilder21StringBuilder_2einner(size_hint) {
  return new _M0TPB13StringBuilder("");
}
function _M0IPB13StringBuilderPB6Logger11write__char(self, ch) {
  self.val = `${self.val}${String.fromCodePoint(ch)}`;
}
function _M0IPB13StringBuilderPB6Logger13write__string(self, str) {
  self.val = `${self.val}${str}`;
}
function _M0FPB14avalanche__acc(acc) {
  let acc$2 = acc;
  acc$2 = acc$2 ^ (acc$2 >>> 15 | 0);
  acc$2 = Math.imul(acc$2, -2048144777) | 0;
  acc$2 = acc$2 ^ (acc$2 >>> 13 | 0);
  acc$2 = Math.imul(acc$2, -1028477379) | 0;
  acc$2 = acc$2 ^ (acc$2 >>> 16 | 0);
  return acc$2;
}
function _M0FPB13finalize__acc(acc) {
  return _M0FPB14avalanche__acc(acc);
}
function _M0MPB4Iter4nextGUlRP210nekoserver8buildlog4StepEE(self) {
  const _func = self.f;
  const result = _func();
  const _bind = self.size_hint;
  if (result === undefined) {
    self.size_hint = _M0MPB4Iter4nextN6constrS9386GUlRP210nekoserver8buildlog4StepEE;
  } else {
    if (_bind === undefined) {
    } else {
      const _Some = _bind;
      const _n = _Some;
      self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS9385GUlRP210nekoserver8buildlog4StepEE;
    }
  }
  return result;
}
function _M0MPC15int645Int6418to__string_2einner(self, radix) {
  return _M0FPB21int64__to__string__js(self, radix);
}
function _M0MPB4Iter3newGUlRP210nekoserver8buildlog4StepEE(f, size_hint) {
  let size_hint$2;
  if (size_hint === undefined) {
    size_hint$2 = undefined;
  } else {
    const _Some = size_hint;
    const _n = _Some;
    size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS9393GUlRP210nekoserver8buildlog4StepEE;
  }
  return new _M0TPB4IterGUlRP210nekoserver8buildlog4StepEE(f, size_hint$2);
}
function _M0MPC16string10StringView9to__owned(self) {
  return self.str.substring(self.start, self.end);
}
function _M0MPC16string6String12view_2einner(self, start_offset, end_offset) {
  let end_offset$2;
  if (end_offset === undefined) {
    end_offset$2 = self.length;
  } else {
    const _Some = end_offset;
    end_offset$2 = _Some;
  }
  if (start_offset >= 0 && (start_offset <= end_offset$2 && end_offset$2 <= self.length)) {
    return new _M0TPC16string10StringView(self, start_offset, end_offset$2);
  } else {
    return $panic();
  }
}
function _M0MPC15array5Array4pushGRP210nekoserver8buildlog4StepE(self, value) {
  _M0MPB7JSArray4push(self, value);
}
function _M0MPC15array5Array4pushGiE(self, value) {
  _M0MPB7JSArray4push(self, value);
}
function _M0MPC15array5Array17mut__view_2einnerGRP210nekoserver8buildlog4StepE(self, start, end) {
  const len = self.length;
  let end$2;
  if (end === undefined) {
    end$2 = len;
  } else {
    const _Some = end;
    const _end = _Some;
    end$2 = _end;
  }
  if (start >= 0 && (start <= end$2 && end$2 <= len)) {
    const _bind = self;
    const _bind$2 = end$2 - start | 0;
    return new _M0TPB12MutArrayViewGRP210nekoserver8buildlog4StepE(_bind, start, start + _bind$2 | 0);
  } else {
    return $panic();
  }
}
function _M0MPC15array12MutArrayView17mut__view_2einnerGRP210nekoserver8buildlog4StepE(self, start, end) {
  const len = self.end - self.start | 0;
  let end$2;
  if (end === undefined) {
    end$2 = len;
  } else {
    const _Some = end;
    const _end = _Some;
    end$2 = _end;
  }
  if (start >= 0 && (start <= end$2 && end$2 <= len)) {
    const _bind = self.buf;
    const _bind$2 = self.start + start | 0;
    const _bind$3 = end$2 - start | 0;
    return new _M0TPB12MutArrayViewGRP210nekoserver8buildlog4StepE(_bind, _bind$2, _bind$2 + _bind$3 | 0);
  } else {
    return $panic();
  }
}
function _M0MPC13int3Int20next__power__of__two(self) {
  if (self >= 0) {
    if (self <= 1) {
      return 1;
    }
    if (self > 1073741824) {
      return 1073741824;
    }
    return (2147483647 >> (Math.clz32(self - 1 | 0) - 1 | 0)) + 1 | 0;
  } else {
    return $panic();
  }
}
function _M0FPB8new__mapGlRP210nekoserver8buildlog4StepE(capacity) {
  const capacity$2 = _M0MPC13int3Int20next__power__of__two(capacity);
  const _bind = capacity$2 - 1 | 0;
  const _bind$2 = (Math.imul(capacity$2, 13) | 0) / 16 | 0;
  const _bind$3 = $make_array_len_and_init(capacity$2, undefined);
  const _bind$4 = undefined;
  return new _M0TPB3MapGlRP210nekoserver8buildlog4StepE(_bind$3, 0, capacity$2, _bind, _bind$2, _bind$4, -1);
}
function _M0FPB21capacity__for__length(length) {
  let capacity = _M0MPC13int3Int20next__power__of__two(length);
  const _p = capacity;
  if (length > ((Math.imul(_p, 13) | 0) / 16 | 0)) {
    capacity = Math.imul(capacity, 2) | 0;
  }
  return capacity;
}
function _M0MPB3Map20add__entry__to__tailGlRP210nekoserver8buildlog4StepE(self, idx, entry) {
  const _bind = self.tail;
  if (_bind === -1) {
    self.head = entry;
  } else {
    const _tmp = self.entries;
    $bound_check(_tmp, _bind);
    const _p = _tmp[_bind];
    let _tmp$2;
    if (_p === undefined) {
      _tmp$2 = $panic();
    } else {
      const _p$2 = _p;
      _tmp$2 = _p$2;
    }
    _tmp$2.next = entry;
  }
  self.tail = idx;
  const _tmp = self.entries;
  $bound_check(_tmp, idx);
  _tmp[idx] = entry;
  self.size = self.size + 1 | 0;
}
function _M0MPB3Map10set__entryGlRP210nekoserver8buildlog4StepE(self, entry, new_idx) {
  const _bind = entry.next;
  if (_bind === undefined) {
    self.tail = new_idx;
  } else {
    const _Some = _bind;
    const _next = _Some;
    _next.prev = new_idx;
  }
  const _tmp = self.entries;
  $bound_check(_tmp, new_idx);
  _tmp[new_idx] = entry;
}
function _M0MPB3Map10push__awayGlRP210nekoserver8buildlog4StepE(self, idx, entry) {
  let _tmp = entry.psl + 1 | 0;
  let _tmp$2 = idx + 1 & self.capacity_mask;
  let _tmp$3 = entry;
  while (true) {
    const psl = _tmp;
    const idx$2 = _tmp$2;
    const entry$2 = _tmp$3;
    const _tmp$4 = self.entries;
    $bound_check(_tmp$4, idx$2);
    const _bind = _tmp$4[idx$2];
    if (_bind === undefined) {
      entry$2.psl = psl;
      _M0MPB3Map10set__entryGlRP210nekoserver8buildlog4StepE(self, entry$2, idx$2);
      return;
    } else {
      const _Some = _bind;
      const _curr_entry = _Some;
      if (psl > _curr_entry.psl) {
        entry$2.psl = psl;
        _M0MPB3Map10set__entryGlRP210nekoserver8buildlog4StepE(self, entry$2, idx$2);
        _tmp = _curr_entry.psl + 1 | 0;
        _tmp$2 = idx$2 + 1 & self.capacity_mask;
        _tmp$3 = _curr_entry;
        continue;
      } else {
        _tmp = psl + 1 | 0;
        _tmp$2 = idx$2 + 1 & self.capacity_mask;
        continue;
      }
    }
  }
}
function _M0MPB3Map20rehash__place__entryGlRP210nekoserver8buildlog4StepE(self, outer) {
  const hash = outer.hash;
  let _tmp = 0;
  let _tmp$2 = hash & self.capacity_mask;
  while (true) {
    const psl = _tmp;
    const idx = _tmp$2;
    const _tmp$3 = self.entries;
    $bound_check(_tmp$3, idx);
    const _bind = _tmp$3[idx];
    if (_bind === undefined) {
      outer.psl = psl;
      outer.prev = self.tail;
      _M0MPB3Map20add__entry__to__tailGlRP210nekoserver8buildlog4StepE(self, idx, outer);
      return undefined;
    } else {
      const _Some = _bind;
      const _curr = _Some;
      if (psl > _curr.psl) {
        _M0MPB3Map10push__awayGlRP210nekoserver8buildlog4StepE(self, idx, _curr);
        outer.psl = psl;
        outer.prev = self.tail;
        _M0MPB3Map20add__entry__to__tailGlRP210nekoserver8buildlog4StepE(self, idx, outer);
        return undefined;
      } else {
        _tmp = psl + 1 | 0;
        _tmp$2 = idx + 1 & self.capacity_mask;
        continue;
      }
    }
  }
}
function _M0MPB3Map4growGlRP210nekoserver8buildlog4StepE(self) {
  const old_head = self.head;
  const new_capacity = self.capacity << 1;
  self.entries = $make_array_len_and_init(new_capacity, undefined);
  self.capacity = new_capacity;
  self.capacity_mask = new_capacity - 1 | 0;
  const _p = self.capacity;
  self.grow_at = (Math.imul(_p, 13) | 0) / 16 | 0;
  self.size = 0;
  self.head = undefined;
  self.tail = -1;
  let _tmp = old_head;
  while (true) {
    const x = _tmp;
    if (x === undefined) {
      return;
    } else {
      const _Some = x;
      const _e = _Some;
      const next_in_chain = _e.next;
      _e.next = undefined;
      _M0MPB3Map20rehash__place__entryGlRP210nekoserver8buildlog4StepE(self, _e);
      _tmp = next_in_chain;
      continue;
    }
  }
}
function _M0MPB3Map15set__with__hashGlRP210nekoserver8buildlog4StepE(self, key, value, hash) {
  let _tmp = 0;
  let _tmp$2 = hash & self.capacity_mask;
  while (true) {
    const psl = _tmp;
    const idx = _tmp$2;
    const _tmp$3 = self.entries;
    $bound_check(_tmp$3, idx);
    const _bind = _tmp$3[idx];
    if (_bind === undefined) {
      if (self.size >= self.grow_at) {
        _M0MPB3Map4growGlRP210nekoserver8buildlog4StepE(self);
        _tmp = 0;
        _tmp$2 = hash & self.capacity_mask;
        continue;
      }
      const _bind$2 = self.tail;
      const _bind$3 = undefined;
      const entry = new _M0TPB5EntryGlRP210nekoserver8buildlog4StepE(_bind$2, _bind$3, psl, hash, key, value);
      _M0MPB3Map20add__entry__to__tailGlRP210nekoserver8buildlog4StepE(self, idx, entry);
      return undefined;
    } else {
      const _Some = _bind;
      const _curr_entry = _Some;
      if (_curr_entry.hash === hash && BigInt.asUintN(64, _curr_entry.key) === BigInt.asUintN(64, key)) {
        _curr_entry.value = value;
        return undefined;
      }
      if (psl > _curr_entry.psl) {
        if (self.size >= self.grow_at) {
          _M0MPB3Map4growGlRP210nekoserver8buildlog4StepE(self);
          _tmp = 0;
          _tmp$2 = hash & self.capacity_mask;
          continue;
        }
        _M0MPB3Map10push__awayGlRP210nekoserver8buildlog4StepE(self, idx, _curr_entry);
        const _bind$2 = self.tail;
        const _bind$3 = undefined;
        const entry = new _M0TPB5EntryGlRP210nekoserver8buildlog4StepE(_bind$2, _bind$3, psl, hash, key, value);
        _M0MPB3Map20add__entry__to__tailGlRP210nekoserver8buildlog4StepE(self, idx, entry);
        return undefined;
      }
      _tmp = psl + 1 | 0;
      _tmp$2 = idx + 1 & self.capacity_mask;
      continue;
    }
  }
}
function _M0MPB3Map3setGlRP210nekoserver8buildlog4StepE(self, key, value) {
  _M0MPB3Map15set__with__hashGlRP210nekoserver8buildlog4StepE(self, key, value, _M0IPC15int645Int64PB4Hash4hash(key));
}
function _M0MPB3Map3MapGlRP210nekoserver8buildlog4StepE(arr, capacity) {
  const length = arr.end - arr.start | 0;
  let capacity$2;
  if (capacity === undefined) {
    capacity$2 = length === 0 ? 8 : _M0FPB21capacity__for__length(length);
  } else {
    const _Some = capacity;
    const _capacity = _Some;
    const _p = _M0FPB21capacity__for__length(length);
    capacity$2 = _capacity > _p ? _capacity : _p;
  }
  const m = _M0FPB8new__mapGlRP210nekoserver8buildlog4StepE(capacity$2);
  const _bind = arr.end - arr.start | 0;
  let _tmp = 0;
  while (true) {
    const _ = _tmp;
    if (_ < _bind) {
      const e = arr.buf[arr.start + _ | 0];
      _M0MPB3Map3setGlRP210nekoserver8buildlog4StepE(m, e._0, e._1);
      _tmp = _ + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  return m;
}
function _M0MPB3Map3getGlRP210nekoserver8buildlog4StepE(self, key) {
  const hash = _M0IPC15int645Int64PB4Hash4hash(key);
  let _tmp = 0;
  let _tmp$2 = hash & self.capacity_mask;
  while (true) {
    const i = _tmp;
    const idx = _tmp$2;
    const _tmp$3 = self.entries;
    $bound_check(_tmp$3, idx);
    const _bind = _tmp$3[idx];
    if (_bind === undefined) {
      return undefined;
    } else {
      const _Some = _bind;
      const _entry = _Some;
      if (_entry.hash === hash && BigInt.asUintN(64, _entry.key) === BigInt.asUintN(64, key)) {
        return _entry.value;
      }
      if (i > _entry.psl) {
        return undefined;
      }
      _tmp = i + 1 | 0;
      _tmp$2 = idx + 1 & self.capacity_mask;
      continue;
    }
  }
}
function _M0MPB3Map4iterGlRP210nekoserver8buildlog4StepE(self) {
  const curr_entry = new _M0TPB8MutLocalGORPB5EntryGlRP210nekoserver8buildlog4StepEE(self.head);
  const len = self.size;
  const remaining = new _M0TPB8MutLocalGiE(len);
  return _M0MPB4Iter3newGUlRP210nekoserver8buildlog4StepEE(() => {
    _L: {
      if (remaining.val > 0) {
        const _bind = curr_entry.val;
        if (_bind === undefined) {
          break _L;
        } else {
          const _Some = _bind;
          const _x = _Some;
          const _key = _x.key;
          const _value = _x.value;
          const _next = _x.next;
          curr_entry.val = _next;
          remaining.val = remaining.val - 1 | 0;
          return { _0: _key, _1: _value };
        }
      } else {
        break _L;
      }
    }
    return undefined;
  }, len);
}
function _M0MPB3Map5iter2GlRP210nekoserver8buildlog4StepE(self) {
  return _M0MPB3Map4iterGlRP210nekoserver8buildlog4StepE(self);
}
function _M0MPB5Iter24nextGlRP210nekoserver8buildlog4StepE(self) {
  return _M0MPB4Iter4nextGUlRP210nekoserver8buildlog4StepEE(self);
}
function _M0IPC15int645Int64PB4Hash4hash(self) {
  return _M0IPC16uint646UInt64PB4Hash4hash(self);
}
function _M0IPC16uint646UInt64PB4Hash4hash(self) {
  const acc = (((_M0FPB4seed >>> 0) + (374761393 >>> 0) | 0) >>> 0) + (8 >>> 0) | 0;
  const low = Number(BigInt.asUintN(32, BigInt.asUintN(64, self & 4294967295n))) | 0;
  const high = Number(BigInt.asUintN(32, BigInt.asUintN(64, BigInt.asUintN(64, BigInt.asUintN(64, self) >> BigInt(32 & 63)) & 4294967295n))) | 0;
  const acc$2 = _M0FPB13consume4__acc(acc, low);
  const acc$3 = _M0FPB13consume4__acc(acc$2, high);
  return _M0FPB13finalize__acc(acc$3);
}
function _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, i, j) {
  const temp = arr.buf[arr.start + i | 0];
  arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
  arr.buf[arr.start + j | 0] = temp;
}
function _M0MPC15array12MutArrayView5sliceGRP210nekoserver8buildlog4StepE(arr, start, end) {
  return _M0MPC15array12MutArrayView17mut__view_2einnerGRP210nekoserver8buildlog4StepE(arr, start, end);
}
function _M0MPC15array12MutArrayView14rev__in__placeGRP210nekoserver8buildlog4StepE(arr) {
  const len = arr.end - arr.start | 0;
  const mid_len = len / 2 | 0;
  let _tmp = 0;
  while (true) {
    const i = _tmp;
    if (i < mid_len) {
      const j = (len - i | 0) - 1 | 0;
      const temp = arr.buf[arr.start + i | 0];
      arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
      arr.buf[arr.start + j | 0] = temp;
      _tmp = i + 1 | 0;
      continue;
    } else {
      return;
    }
  }
}
function _M0FPB17fixed__get__limit(len) {
  let _tmp = len;
  let _tmp$2 = 0;
  while (true) {
    const len$2 = _tmp;
    const limit = _tmp$2;
    if (len$2 > 0) {
      _tmp = len$2 / 2 | 0;
      _tmp$2 = limit + 1 | 0;
      continue;
    } else {
      return limit;
    }
  }
}
function _M0FPB23fixed__bubble__sort__byGRP210nekoserver8buildlog4StepE(arr, cmp) {
  const _bind = arr.end - arr.start | 0;
  let _tmp = 1;
  while (true) {
    const i = _tmp;
    if (i < _bind) {
      let _tmp$2 = i;
      while (true) {
        const j = _tmp$2;
        if (j > 0 && cmp(arr.buf[arr.start + (j - 1 | 0) | 0], arr.buf[arr.start + j | 0]) > 0) {
          _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, j, j - 1 | 0);
          _tmp$2 = j - 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _tmp = i + 1 | 0;
      continue;
    } else {
      return;
    }
  }
}
function _M0FPB24fixed__choose__pivot__byN7sort__2S439GRP210nekoserver8buildlog4StepE(_env, a, b) {
  const swaps = _env._2;
  const arr = _env._1;
  const cmp = _env._0;
  if (cmp(arr.buf[arr.start + a | 0], arr.buf[arr.start + b | 0]) > 0) {
    _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, a, b);
    swaps.val = swaps.val + 1 | 0;
    return;
  } else {
    return;
  }
}
function _M0FPB24fixed__choose__pivot__byN7sort__3S443GRP210nekoserver8buildlog4StepE(_env, a, b, c) {
  _M0FPB24fixed__choose__pivot__byN7sort__2S439GRP210nekoserver8buildlog4StepE(_env, a, b);
  _M0FPB24fixed__choose__pivot__byN7sort__2S439GRP210nekoserver8buildlog4StepE(_env, b, c);
  _M0FPB24fixed__choose__pivot__byN7sort__2S439GRP210nekoserver8buildlog4StepE(_env, a, b);
}
function _M0FPB24fixed__choose__pivot__byGRP210nekoserver8buildlog4StepE(arr, cmp) {
  const len = arr.end - arr.start | 0;
  const swaps = new _M0TPB8MutLocalGiE(0);
  const b = Math.imul(len / 4 | 0, 2) | 0;
  if (len >= 8) {
    const a = Math.imul(len / 4 | 0, 1) | 0;
    const c = Math.imul(len / 4 | 0, 3) | 0;
    const _env = { _0: cmp, _1: arr, _2: swaps };
    if (len > 50) {
      _M0FPB24fixed__choose__pivot__byN7sort__3S443GRP210nekoserver8buildlog4StepE(_env, a - 1 | 0, a, a + 1 | 0);
      _M0FPB24fixed__choose__pivot__byN7sort__3S443GRP210nekoserver8buildlog4StepE(_env, b - 1 | 0, b, b + 1 | 0);
      _M0FPB24fixed__choose__pivot__byN7sort__3S443GRP210nekoserver8buildlog4StepE(_env, c - 1 | 0, c, c + 1 | 0);
    }
    _M0FPB24fixed__choose__pivot__byN7sort__3S443GRP210nekoserver8buildlog4StepE(_env, a, b, c);
  }
  if (swaps.val === 12) {
    _M0MPC15array12MutArrayView14rev__in__placeGRP210nekoserver8buildlog4StepE(arr);
    return { _0: (len - b | 0) - 1 | 0, _1: true };
  } else {
    return { _0: b, _1: swaps.val === 0 };
  }
}
function _M0FPB21fixed__sift__down__byGRP210nekoserver8buildlog4StepE(arr, index, cmp) {
  const len = arr.end - arr.start | 0;
  let _tmp = index;
  let _tmp$2 = (Math.imul(index, 2) | 0) + 1 | 0;
  while (true) {
    const index$2 = _tmp;
    const child = _tmp$2;
    if (child < len) {
      const child$2 = (child + 1 | 0) < len && cmp(arr.buf[arr.start + child | 0], arr.buf[arr.start + (child + 1 | 0) | 0]) < 0 ? child + 1 | 0 : child;
      if (cmp(arr.buf[arr.start + index$2 | 0], arr.buf[arr.start + child$2 | 0]) >= 0) {
        return undefined;
      }
      _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, index$2, child$2);
      _tmp = child$2;
      _tmp$2 = (Math.imul(child$2, 2) | 0) + 1 | 0;
      continue;
    } else {
      return;
    }
  }
}
function _M0FPB21fixed__heap__sort__byGRP210nekoserver8buildlog4StepE(arr, cmp) {
  const len = arr.end - arr.start | 0;
  const _bind = len / 2 | 0;
  let _tmp = _bind - 1 | 0;
  while (true) {
    const i = _tmp;
    if (i >= 0) {
      _M0FPB21fixed__sift__down__byGRP210nekoserver8buildlog4StepE(arr, i, cmp);
      _tmp = i - 1 | 0;
      continue;
    } else {
      break;
    }
  }
  let _tmp$2 = len - 1 | 0;
  while (true) {
    const i = _tmp$2;
    if (i >= 1) {
      _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, 0, i);
      _M0FPB21fixed__sift__down__byGRP210nekoserver8buildlog4StepE(_M0MPC15array12MutArrayView5sliceGRP210nekoserver8buildlog4StepE(arr, 0, i), 0, cmp);
      _tmp$2 = i - 1 | 0;
      continue;
    } else {
      return;
    }
  }
}
function _M0FPB20fixed__partition__byGRP210nekoserver8buildlog4StepE(arr, cmp, pivot_index) {
  _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, pivot_index, (arr.end - arr.start | 0) - 1 | 0);
  const pivot = arr.buf[arr.start + ((arr.end - arr.start | 0) - 1 | 0) | 0];
  const _bind = (arr.end - arr.start | 0) - 1 | 0;
  let _tmp = 0;
  let _tmp$2 = 0;
  let _tmp$3 = true;
  while (true) {
    const j = _tmp;
    const i = _tmp$2;
    const partitioned = _tmp$3;
    if (j < _bind) {
      if (cmp(arr.buf[arr.start + j | 0], pivot) < 0) {
        if (i !== j) {
          _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, i, j);
          _tmp = j + 1 | 0;
          _tmp$2 = i + 1 | 0;
          _tmp$3 = false;
          continue;
        } else {
          _tmp = j + 1 | 0;
          _tmp$2 = i + 1 | 0;
          continue;
        }
      } else {
        _tmp = j + 1 | 0;
        continue;
      }
    } else {
      _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, i, (arr.end - arr.start | 0) - 1 | 0);
      return { _0: i, _1: partitioned };
    }
  }
}
function _M0FPB28fixed__try__bubble__sort__byGRP210nekoserver8buildlog4StepE(arr, cmp) {
  const _bind = arr.end - arr.start | 0;
  let _tmp = 1;
  let _tmp$2 = 0;
  while (true) {
    const i = _tmp;
    const tries = _tmp$2;
    if (i < _bind) {
      let sorted;
      let _tmp$3 = i;
      let _tmp$4 = true;
      while (true) {
        const j = _tmp$3;
        const sorted$2 = _tmp$4;
        if (j > 0 && cmp(arr.buf[arr.start + (j - 1 | 0) | 0], arr.buf[arr.start + j | 0]) > 0) {
          _M0MPC15array12MutArrayView4swapGRP210nekoserver8buildlog4StepE(arr, j, j - 1 | 0);
          _tmp$3 = j - 1 | 0;
          _tmp$4 = false;
          continue;
        } else {
          sorted = sorted$2;
          break;
        }
      }
      if (!sorted) {
        const tries$2 = tries + 1 | 0;
        if (tries$2 > 8) {
          return false;
        }
        _tmp = i + 1 | 0;
        _tmp$2 = tries$2;
        continue;
      } else {
        _tmp = i + 1 | 0;
        continue;
      }
    } else {
      return true;
    }
  }
}
function _M0FPB22fixed__quick__sort__byGRP210nekoserver8buildlog4StepE(arr, cmp, pred, limit) {
  let _tmp = limit;
  let _tmp$2 = arr;
  let _tmp$3 = pred;
  let _tmp$4 = true;
  let _tmp$5 = true;
  while (true) {
    const limit$2 = _tmp;
    const arr$2 = _tmp$2;
    const pred$2 = _tmp$3;
    const was_partitioned = _tmp$4;
    const balanced = _tmp$5;
    const len = arr$2.end - arr$2.start | 0;
    if (len <= 16) {
      if (len >= 2) {
        _M0FPB23fixed__bubble__sort__byGRP210nekoserver8buildlog4StepE(arr$2, cmp);
      }
      return undefined;
    }
    if (limit$2 === 0) {
      _M0FPB21fixed__heap__sort__byGRP210nekoserver8buildlog4StepE(arr$2, cmp);
      return undefined;
    }
    const _bind = _M0FPB24fixed__choose__pivot__byGRP210nekoserver8buildlog4StepE(arr$2, cmp);
    const _pivot_index = _bind._0;
    const _likely_sorted = _bind._1;
    if (was_partitioned && (balanced && _likely_sorted)) {
      if (_M0FPB28fixed__try__bubble__sort__byGRP210nekoserver8buildlog4StepE(arr$2, cmp)) {
        return undefined;
      }
    }
    const _bind$2 = _M0FPB20fixed__partition__byGRP210nekoserver8buildlog4StepE(arr$2, cmp, _pivot_index);
    const _pivot = _bind$2._0;
    const _partitioned = _bind$2._1;
    const _p = len - _pivot | 0;
    const balanced$2 = (_pivot > _p ? _p : _pivot) >= (len / 8 | 0);
    const limit$3 = !balanced$2 ? limit$2 - 1 | 0 : limit$2;
    if (pred$2 === undefined) {
    } else {
      const _Some = pred$2;
      const _p$2 = _Some;
      if (cmp(_p$2, arr$2.buf[arr$2.start + _pivot | 0]) === 0) {
        let i;
        let _tmp$6 = _pivot;
        while (true) {
          const i$2 = _tmp$6;
          if (i$2 < len && cmp(_p$2, arr$2.buf[arr$2.start + i$2 | 0]) === 0) {
            _tmp$6 = i$2 + 1 | 0;
            continue;
          } else {
            i = i$2;
            break;
          }
        }
        _tmp = limit$3;
        _tmp$2 = _M0MPC15array12MutArrayView5sliceGRP210nekoserver8buildlog4StepE(arr$2, i, len);
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      }
    }
    const left = _M0MPC15array12MutArrayView5sliceGRP210nekoserver8buildlog4StepE(arr$2, 0, _pivot);
    const right = _M0MPC15array12MutArrayView5sliceGRP210nekoserver8buildlog4StepE(arr$2, _pivot + 1 | 0, len);
    if ((left.end - left.start | 0) < (right.end - right.start | 0)) {
      _M0FPB22fixed__quick__sort__byGRP210nekoserver8buildlog4StepE(left, cmp, pred$2, limit$3);
      _tmp = limit$3;
      _tmp$2 = right;
      _tmp$3 = arr$2.buf[arr$2.start + _pivot | 0];
      _tmp$4 = _partitioned;
      _tmp$5 = balanced$2;
      continue;
    } else {
      _M0FPB22fixed__quick__sort__byGRP210nekoserver8buildlog4StepE(right, cmp, arr$2.buf[arr$2.start + _pivot | 0], limit$3);
      _tmp = limit$3;
      _tmp$2 = left;
      _tmp$4 = _partitioned;
      _tmp$5 = balanced$2;
      continue;
    }
  }
}
function _M0MPC15array12MutArrayView13sort__by__keyGRP210nekoserver8buildlog4SteplE(self, map) {
  _M0FPB22fixed__quick__sort__byGRP210nekoserver8buildlog4StepE(self, (a, b) => $compare_int64(map(a), map(b)), undefined, _M0FPB17fixed__get__limit(self.end - self.start | 0));
}
function _M0MPC15array5Array13sort__by__keyGRP210nekoserver8buildlog4SteplE(self, map) {
  _M0MPC15array12MutArrayView13sort__by__keyGRP210nekoserver8buildlog4SteplE(_M0MPC15array5Array17mut__view_2einnerGRP210nekoserver8buildlog4StepE(self, 0, undefined), map);
}
function _M0FP210nekoserver8buildlog9is__alpha(c) {
  return c >= 65 && c <= 90 || c >= 97 && c <= 122;
}
function _M0FP210nekoserver8buildlog8is__word(c) {
  return c >= 48 && c <= 57 || (_M0FP210nekoserver8buildlog9is__alpha(c) || c === 95);
}
function _M0FP210nekoserver8buildlog9is__space(c) {
  switch (c) {
    case 9: {
      return true;
    }
    case 10: {
      return true;
    }
    case 11: {
      return true;
    }
    case 12: {
      return true;
    }
    case 13: {
      return true;
    }
    case 32: {
      return true;
    }
    case 160: {
      return true;
    }
    case 5760: {
      return true;
    }
    case 8232: {
      return true;
    }
    case 8233: {
      return true;
    }
    case 8239: {
      return true;
    }
    case 8287: {
      return true;
    }
    case 12288: {
      return true;
    }
    case 65279: {
      return true;
    }
    default: {
      return c >= 8192 && c <= 8202;
    }
  }
}
function _M0FP210nekoserver8buildlog5slice(s, start, end) {
  return _M0MPC16string10StringView9to__owned(_M0MPC16string6String12view_2einner(s, start, end));
}
function _M0FP210nekoserver8buildlog11strip__ansi(s) {
  const b = _M0MPB13StringBuilder21StringBuilder_2einner(0);
  const n = s.length;
  let i = 0;
  while (true) {
    if (i < n) {
      let _tmp;
      const _p = i;
      $bound_check(s, _p);
      if (s.charCodeAt(_p) === 27) {
        let _tmp$2;
        if ((i + 1 | 0) < n) {
          const _p$2 = i + 1 | 0;
          $bound_check(s, _p$2);
          _tmp$2 = s.charCodeAt(_p$2) === 91;
        } else {
          _tmp$2 = false;
        }
        _tmp = _tmp$2;
      } else {
        _tmp = false;
      }
      if (_tmp) {
        let j = i + 2 | 0;
        while (true) {
          let _tmp$2;
          if (j < n) {
            let _tmp$3;
            const _p$2 = j;
            $bound_check(s, _p$2);
            const _p$3 = s.charCodeAt(_p$2);
            if (_p$3 >= 48 && _p$3 <= 57) {
              _tmp$3 = true;
            } else {
              const _p$4 = j;
              $bound_check(s, _p$4);
              _tmp$3 = s.charCodeAt(_p$4) === 59;
            }
            _tmp$2 = _tmp$3;
          } else {
            _tmp$2 = false;
          }
          if (_tmp$2) {
            j = j + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        let _tmp$2;
        if (j < n) {
          const _p$2 = j;
          $bound_check(s, _p$2);
          _tmp$2 = _M0FP210nekoserver8buildlog9is__alpha(s.charCodeAt(_p$2));
        } else {
          _tmp$2 = false;
        }
        if (_tmp$2) {
          i = j + 1 | 0;
          continue;
        }
      }
      _M0IPB13StringBuilderPB6Logger13write__string(b, _M0FP210nekoserver8buildlog5slice(s, i, i + 1 | 0));
      i = i + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  return b.val;
}
function _M0FP210nekoserver8buildlog4trim(s) {
  let start = 0;
  let end = s.length;
  while (true) {
    let _tmp;
    if (start < end) {
      const _p = start;
      $bound_check(s, _p);
      _tmp = _M0FP210nekoserver8buildlog9is__space(s.charCodeAt(_p));
    } else {
      _tmp = false;
    }
    if (_tmp) {
      start = start + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  while (true) {
    let _tmp;
    if (end > start) {
      const _p = end - 1 | 0;
      $bound_check(s, _p);
      _tmp = _M0FP210nekoserver8buildlog9is__space(s.charCodeAt(_p));
    } else {
      _tmp = false;
    }
    if (_tmp) {
      end = end - 1 | 0;
      continue;
    } else {
      break;
    }
  }
  return _M0FP210nekoserver8buildlog5slice(s, start, end);
}
function _M0FP210nekoserver8buildlog12split__lines(log) {
  const lines = [];
  const n = log.length;
  let start = 0;
  let i = 0;
  while (true) {
    if (i < n) {
      const _p = i;
      $bound_check(log, _p);
      const c = log.charCodeAt(_p);
      if (c === 13 || c === 10) {
        _M0MPC15array5Array4pushGRP210nekoserver8buildlog4StepE(lines, _M0FP210nekoserver8buildlog5slice(log, start, i));
        let _tmp;
        if (c === 13) {
          let _tmp$2;
          if ((i + 1 | 0) < n) {
            const _p$2 = i + 1 | 0;
            $bound_check(log, _p$2);
            _tmp$2 = log.charCodeAt(_p$2) === 10;
          } else {
            _tmp$2 = false;
          }
          _tmp = _tmp$2;
        } else {
          _tmp = false;
        }
        if (_tmp) {
          i = i + 1 | 0;
        }
        start = i + 1 | 0;
      }
      i = i + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  _M0MPC15array5Array4pushGRP210nekoserver8buildlog4StepE(lines, _M0FP210nekoserver8buildlog5slice(log, start, n));
  return lines;
}
function _M0FP210nekoserver8buildlog12starts__with(s, prefix) {
  return s.length >= prefix.length && _M0FP210nekoserver8buildlog5slice(s, 0, prefix.length) === prefix;
}
function _M0FP210nekoserver8buildlog18starts__with__word(s, prefix) {
  if (_M0FP210nekoserver8buildlog12starts__with(s, prefix)) {
    let _tmp;
    if (s.length === prefix.length) {
      _tmp = true;
    } else {
      const _p = prefix.length;
      $bound_check(s, _p);
      _tmp = !_M0FP210nekoserver8buildlog8is__word(s.charCodeAt(_p));
    }
    return _tmp;
  } else {
    return false;
  }
}
function _M0FP210nekoserver8buildlog15skip__timestamp(s) {
  const n = s.length;
  if (n < 11) {
    return undefined;
  }
  const _bind = [0, 1, 2, 3, 5, 6, 8, 9];
  const _bind$2 = _bind.length;
  let _tmp = 0;
  while (true) {
    const _ = _tmp;
    if (_ < _bind$2) {
      const k = _bind[_];
      $bound_check(s, k);
      const _p = s.charCodeAt(k);
      if (!(_p >= 48 && _p <= 57)) {
        return undefined;
      }
      _tmp = _ + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  let _tmp$2;
  const _p = 4;
  $bound_check(s, _p);
  if (s.charCodeAt(_p) !== 45) {
    _tmp$2 = true;
  } else {
    const _p$2 = 7;
    $bound_check(s, _p$2);
    _tmp$2 = s.charCodeAt(_p$2) !== 45;
  }
  if (_tmp$2) {
    return undefined;
  }
  const _p$2 = 10;
  $bound_check(s, _p$2);
  const sep = s.charCodeAt(_p$2);
  if (sep !== 84 && sep !== 32) {
    return undefined;
  }
  let i = 11;
  while (true) {
    let _tmp$3;
    if (i < n) {
      let _tmp$4;
      const _p$3 = i;
      $bound_check(s, _p$3);
      const _p$4 = s.charCodeAt(_p$3);
      if (_p$4 >= 48 && _p$4 <= 57) {
        _tmp$4 = true;
      } else {
        let _tmp$5;
        const _p$5 = i;
        $bound_check(s, _p$5);
        if (s.charCodeAt(_p$5) === 58) {
          _tmp$5 = true;
        } else {
          const _p$6 = i;
          $bound_check(s, _p$6);
          _tmp$5 = s.charCodeAt(_p$6) === 46;
        }
        _tmp$4 = _tmp$5;
      }
      _tmp$3 = _tmp$4;
    } else {
      _tmp$3 = false;
    }
    if (_tmp$3) {
      i = i + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  if (i === 11) {
    return undefined;
  }
  let _tmp$3;
  if (i < n) {
    const _p$3 = i;
    $bound_check(s, _p$3);
    _tmp$3 = s.charCodeAt(_p$3) === 90;
  } else {
    _tmp$3 = false;
  }
  if (_tmp$3) {
    i = i + 1 | 0;
  }
  const ws = i;
  while (true) {
    let _tmp$4;
    if (i < n) {
      const _p$3 = i;
      $bound_check(s, _p$3);
      _tmp$4 = _M0FP210nekoserver8buildlog9is__space(s.charCodeAt(_p$3));
    } else {
      _tmp$4 = false;
    }
    if (_tmp$4) {
      i = i + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  return i === ws ? undefined : i;
}
function _M0FP210nekoserver8buildlog17parse__step__line(line) {
  const n = line.length;
  const candidates = [0];
  const _bind = _M0FP210nekoserver8buildlog15skip__timestamp(line);
  if (_bind === undefined) {
  } else {
    const _Some = _bind;
    const _p = _Some;
    _M0MPC15array5Array4pushGiE(candidates, _p);
  }
  const _bind$2 = candidates.length;
  let _tmp = 0;
  while (true) {
    const _ = _tmp;
    if (_ < _bind$2) {
      const start = candidates[_];
      _L: {
        let _tmp$2;
        if (start >= n) {
          _tmp$2 = true;
        } else {
          $bound_check(line, start);
          _tmp$2 = line.charCodeAt(start) !== 35;
        }
        if (_tmp$2) {
          break _L;
        }
        let i = start + 1 | 0;
        let id = 0n;
        let overflow = false;
        while (true) {
          let _tmp$3;
          if (i < n) {
            const _p = i;
            $bound_check(line, _p);
            const _p$2 = line.charCodeAt(_p);
            _tmp$3 = _p$2 >= 48 && _p$2 <= 57;
          } else {
            _tmp$3 = false;
          }
          if (_tmp$3) {
            if (BigInt.asIntN(64, id) > BigInt.asIntN(64, _M0FP210nekoserver8buildlog18max__safe__integer)) {
              overflow = true;
            } else {
              const _tmp$4 = BigInt.asUintN(64, id * 10n);
              const _p = i;
              $bound_check(line, _p);
              id = BigInt.asUintN(64, _tmp$4 + BigInt.asUintN(64, BigInt(line.charCodeAt(_p) - 48 | 0)));
            }
            i = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        if (i === (start + 1 | 0)) {
          break _L;
        }
        const ws = i;
        while (true) {
          let _tmp$3;
          if (i < n) {
            const _p = i;
            $bound_check(line, _p);
            _tmp$3 = _M0FP210nekoserver8buildlog9is__space(line.charCodeAt(_p));
          } else {
            _tmp$3 = false;
          }
          if (_tmp$3) {
            i = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        if (i === ws || i >= n) {
          break _L;
        }
        if (overflow || BigInt.asIntN(64, id) > BigInt.asIntN(64, _M0FP210nekoserver8buildlog18max__safe__integer)) {
          return undefined;
        }
        return { _0: id, _1: _M0FP210nekoserver8buildlog5slice(line, i, n) };
      }
      _tmp = _ + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  return undefined;
}
function _M0FP210nekoserver8buildlog15parse__terminal(text) {
  if (text === "DONE") {
    return { _0: "done", _1: undefined };
  }
  if (text === "CACHED") {
    return { _0: "cached", _1: undefined };
  }
  if (text === "CANCELED") {
    return { _0: "canceled", _1: undefined };
  }
  if (_M0FP210nekoserver8buildlog12starts__with(text, "ERROR:")) {
    return { _0: "error", _1: undefined };
  }
  if (_M0FP210nekoserver8buildlog12starts__with(text, "DONE")) {
    const n = text.length;
    let i = 4;
    while (true) {
      let _tmp;
      if (i < n) {
        const _p = i;
        $bound_check(text, _p);
        _tmp = _M0FP210nekoserver8buildlog9is__space(text.charCodeAt(_p));
      } else {
        _tmp = false;
      }
      if (_tmp) {
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp;
    if (i === 4) {
      _tmp = true;
    } else {
      let _tmp$2;
      if ((n - i | 0) < 2) {
        _tmp$2 = true;
      } else {
        const _p = n - 1 | 0;
        $bound_check(text, _p);
        _tmp$2 = text.charCodeAt(_p) !== 115;
      }
      _tmp = _tmp$2;
    }
    if (_tmp) {
      return undefined;
    }
    let _tmp$2 = i;
    while (true) {
      const k = _tmp$2;
      if (k < (n - 1 | 0)) {
        let _tmp$3;
        $bound_check(text, k);
        const _p = text.charCodeAt(k);
        if (_p >= 48 && _p <= 57) {
          _tmp$3 = true;
        } else {
          $bound_check(text, k);
          _tmp$3 = text.charCodeAt(k) === 46;
        }
        if (!_tmp$3) {
          return undefined;
        }
        _tmp$2 = k + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return { _0: "done", _1: _M0FP210nekoserver8buildlog5slice(text, i, n - 1 | 0) };
  }
  return undefined;
}
function _M0FP210nekoserver8buildlog15is__instruction(text) {
  let _tmp;
  if (text.length > 0) {
    const _p = 0;
    $bound_check(text, _p);
    const _p$2 = text.charCodeAt(_p);
    _tmp = _p$2 >= 48 && _p$2 <= 57;
  } else {
    _tmp = false;
  }
  if (_tmp) {
    return false;
  }
  const _bind = _M0FP210nekoserver8buildlog11skip__words.length;
  let _tmp$2 = 0;
  while (true) {
    const _ = _tmp$2;
    if (_ < _bind) {
      const w = _M0FP210nekoserver8buildlog11skip__words[_];
      if (_M0FP210nekoserver8buildlog18starts__with__word(text, w)) {
        return false;
      }
      _tmp$2 = _ + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  if (_M0FP210nekoserver8buildlog12starts__with(text, "[")) {
    return true;
  }
  const _bind$2 = _M0FP210nekoserver8buildlog11step__words.length;
  let _tmp$3 = 0;
  while (true) {
    const _ = _tmp$3;
    if (_ < _bind$2) {
      const w = _M0FP210nekoserver8buildlog11step__words[_];
      if (_M0FP210nekoserver8buildlog18starts__with__word(text, w)) {
        return true;
      }
      _tmp$3 = _ + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  return false;
}
function _M0FP210nekoserver8buildlog12handle__line(steps, raw) {
  const line = _M0FP210nekoserver8buildlog4trim(_M0FP210nekoserver8buildlog11strip__ansi(raw));
  const _bind = _M0FP210nekoserver8buildlog17parse__step__line(line);
  if (_bind === undefined) {
    return 0;
  } else {
    const _Some = _bind;
    const _x = _Some;
    const _id = _x._0;
    const _text = _x._1;
    const _bind$2 = _M0FP210nekoserver8buildlog15parse__terminal(_text);
    if (_bind$2 === undefined) {
    } else {
      const _Some$2 = _bind$2;
      const _x$2 = _Some$2;
      const _state = _x$2._0;
      const _seconds_text = _x$2._1;
      const _bind$3 = _M0MPB3Map3getGlRP210nekoserver8buildlog4StepE(steps, _id);
      let step;
      if (_bind$3 === undefined) {
        const s = new _M0TP210nekoserver8buildlog4Step(_id, _M0FP210nekoserver8buildlog11placeholder, "running", _M0DTPC16option6OptionGdE4None__);
        _M0MPB3Map3setGlRP210nekoserver8buildlog4StepE(steps, _id, s);
        step = s;
      } else {
        const _Some$3 = _bind$3;
        step = _Some$3;
      }
      step.state = _state;
      let _tmp;
      if (_seconds_text === undefined) {
        _tmp = _M0DTPC16option6OptionGdE4None__;
      } else {
        const _Some$3 = _seconds_text;
        const _t = _Some$3;
        const v = _M0FP210nekoserver8buildlog10js__number(_t);
        _tmp = v !== v || (v > _M0FPB18double__max__value || v < _M0FPB18double__min__value) ? _M0DTPC16option6OptionGdE4None__ : new _M0DTPC16option6OptionGdE4Some(v);
      }
      step.seconds = _tmp;
      return 0;
    }
    if (!_M0FP210nekoserver8buildlog15is__instruction(_text)) {
      return 0;
    }
    const label = _text.length > 1500 ? _M0FP210nekoserver8buildlog5slice(_text, 0, 1500) : _text;
    const _bind$3 = _M0MPB3Map3getGlRP210nekoserver8buildlog4StepE(steps, _id);
    if (_bind$3 === undefined) {
      _M0MPB3Map3setGlRP210nekoserver8buildlog4StepE(steps, _id, new _M0TP210nekoserver8buildlog4Step(_id, label, "running", _M0DTPC16option6OptionGdE4None__));
    } else {
      const _Some$2 = _bind$3;
      const _step = _Some$2;
      let _tmp;
      const _p = _step.label;
      if (!(_p === _M0FP210nekoserver8buildlog11placeholder)) {
        const _p$2 = _step.label;
        _tmp = !(_p$2 === label);
      } else {
        _tmp = false;
      }
      if (_tmp) {
        return 1;
      }
      _step.label = label;
    }
    return 0;
  }
}
function _M0FP210nekoserver8buildlog12json__string(b, s) {
  _M0IPB13StringBuilderPB6Logger11write__char(b, 34);
  const _bind = s.length;
  let _tmp = 0;
  while (true) {
    const i = _tmp;
    if (i < _bind) {
      $bound_check(s, i);
      const c = s.charCodeAt(i);
      if (c === 34) {
        _M0IPB13StringBuilderPB6Logger13write__string(b, "\\\"");
      } else {
        if (c === 92) {
          _M0IPB13StringBuilderPB6Logger13write__string(b, "\\\\");
        } else {
          if (c < 32) {
            _M0IPB13StringBuilderPB6Logger13write__string(b, "\\u00");
            _M0IPB13StringBuilderPB6Logger13write__string(b, _M0FP210nekoserver8buildlog5slice(_M0FP210nekoserver8buildlog12json__stringN3hexS19, c / 16 | 0, (c / 16 | 0) + 1 | 0));
            _M0IPB13StringBuilderPB6Logger13write__string(b, _M0FP210nekoserver8buildlog5slice(_M0FP210nekoserver8buildlog12json__stringN3hexS19, c % 16 | 0, (c % 16 | 0) + 1 | 0));
          } else {
            _M0IPB13StringBuilderPB6Logger13write__string(b, _M0FP210nekoserver8buildlog5slice(s, i, i + 1 | 0));
          }
        }
      }
      _tmp = i + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  _M0IPB13StringBuilderPB6Logger11write__char(b, 34);
}
function _M0FP210nekoserver8buildlog11error__json(code, detail) {
  const b = _M0MPB13StringBuilder21StringBuilder_2einner(0);
  _M0IPB13StringBuilderPB6Logger13write__string(b, "{\"ok\":false,\"errorCode\":");
  _M0FP210nekoserver8buildlog12json__string(b, code);
  _M0IPB13StringBuilderPB6Logger13write__string(b, ",\"detail\":");
  _M0FP210nekoserver8buildlog12json__string(b, detail);
  _M0IPB13StringBuilderPB6Logger13write__string(b, "}");
  return b.val;
}
function _M0FP210nekoserver8buildlog19analyze__build__log(log) {
  const _bind = [];
  const steps = _M0MPB3Map3MapGlRP210nekoserver8buildlog4StepE(new _M0TPB9ArrayViewGUlRP210nekoserver8buildlog4StepEE(_bind, 0, 0), undefined);
  const _bind$2 = _M0FP210nekoserver8buildlog12split__lines(log);
  const _bind$3 = _bind$2.length;
  let _tmp = 0;
  while (true) {
    const _ = _tmp;
    if (_ < _bind$3) {
      const raw = _bind$2[_];
      const _bind$4 = _M0FP210nekoserver8buildlog12handle__line(steps, raw);
      if (_bind$4 === 1) {
        return _M0FP210nekoserver8buildlog11error__json("step_id_reused", "ステップ番号が再使用されています。複数ビルドのログを分離してください");
      }
      _tmp = _ + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  if (steps.size > 500) {
    return _M0FP210nekoserver8buildlog11error__json("too_many_steps", "ステップ数が500件を超えています");
  }
  const list = [];
  const _it = _M0MPB3Map5iter2GlRP210nekoserver8buildlog4StepE(steps);
  while (true) {
    const _bind$4 = _M0MPB5Iter24nextGlRP210nekoserver8buildlog4StepE(_it);
    if (_bind$4 === undefined) {
      break;
    } else {
      const _Some = _bind$4;
      const _x = _Some;
      const _step = _x._1;
      _M0MPC15array5Array4pushGRP210nekoserver8buildlog4StepE(list, _step);
      continue;
    }
  }
  _M0MPC15array5Array13sort__by__keyGRP210nekoserver8buildlog4SteplE(list, (s) => s.id);
  const b = _M0MPB13StringBuilder21StringBuilder_2einner(0);
  _M0IPB13StringBuilderPB6Logger13write__string(b, "{\"ok\":true,\"steps\":[");
  const _bind$4 = list.length;
  let _tmp$2 = 0;
  while (true) {
    const i = _tmp$2;
    if (i < _bind$4) {
      const step = list[i];
      if (i > 0) {
        _M0IPB13StringBuilderPB6Logger11write__char(b, 44);
      }
      _M0IPB13StringBuilderPB6Logger13write__string(b, "{\"id\":");
      _M0IPB13StringBuilderPB6Logger13write__string(b, _M0MPC15int645Int6418to__string_2einner(step.id, 10));
      _M0IPB13StringBuilderPB6Logger13write__string(b, ",\"label\":");
      _M0FP210nekoserver8buildlog12json__string(b, step.label);
      _M0IPB13StringBuilderPB6Logger13write__string(b, ",\"state\":");
      _M0FP210nekoserver8buildlog12json__string(b, step.state);
      _M0IPB13StringBuilderPB6Logger13write__string(b, ",\"seconds\":");
      const _bind$5 = step.seconds;
      if (_bind$5.$tag === 1) {
        const _Some = _bind$5;
        const _v = _Some._0;
        _M0IPB13StringBuilderPB6Logger13write__string(b, _M0FP210nekoserver8buildlog20js__number__to__json(_v));
      } else {
        _M0IPB13StringBuilderPB6Logger13write__string(b, "null");
      }
      _M0IPB13StringBuilderPB6Logger11write__char(b, 125);
      _tmp$2 = i + 1 | 0;
      continue;
    } else {
      break;
    }
  }
  _M0IPB13StringBuilderPB6Logger13write__string(b, "]}");
  return b.val;
}
export { _M0FP210nekoserver8buildlog19analyze__build__log as analyze_build_log }
