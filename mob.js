var mob = {
    next_id: 0,
    num: function(v) { return {id: mob.next_id++, op: 'num', value: v, args: []}; },
    sym: function(s) { return {id: mob.next_id++, op: 'sym', symbol: s, args: []}; },
    add: function() { return {id: mob.next_id++, op: 'add', args: Array.from(arguments)}; },
    mul: function() { return {id: mob.next_id++, op: 'mul', args: Array.from(arguments)}; },
    sum: function(v) { return {id: mob.next_id++, op: 'add', args: Array.from(v)}; },
    prod: function(v) { return {id: mob.next_id++, op: 'mul', args: Array.from(v)}; },
    neg: function(x) { return mob.fun('neg', x); },
    recip: function(x) { return mob.fun('recip', x); },
    sub: function(x, y) { return mob.add(x, mob.neg(y)); },
    div: function(x, y) { return mob.mul(x, mob.recip(y)); },
    sqrt: function(x) { return mob.fun('sqrt', x); },
    erf: function(x) { return mob.fun('erf', x); },
    exp: function(x) { return mob.fun('exp', x); }, log: function(x) { return mob.fun('log', x); },
    sin: function(x) { return mob.fun('sin', x); }, cos: function(x) { return mob.fun('cos', x); },
    sinh: function(x) { return mob.fun('sinh', x); }, cosh: function(x) { return mob.fun('cosh', x); },
    gelu: function(x) { return mob.fun('gelu', x); },
    relu: function(x) { return mob.fun('relu', x); },
    tanh: function(x) { return mob.fun('tanh', x); },
    sigmoid: function(x) { return mob.fun('sigmoid', x); },
    sinc: function(x) { return mob.fun('sinc', x); },
    fun: function(f, x, y) { return {id: mob.next_id++, op: f, args: y ? [x, y] : [x]}; },
    eq: function(x, y) {
        if (x.op != y.op) return false;
        if (x.op == 'num') return x.value == y.value;
        if (x.op == 'sym') return x.symbol == y.symbol;
        if (x.args.length != y.args.length) return false;
        for(var i=0;i<x.args.length;i++) {
            if (!mob.eq(x.args[i], y.args[i])) return false;
        }
        return true;
    },
    diff: function(f, x) {
        if (mob.eq(f, x)) return mob.num(1);
        if (f.op == 'sym') return mob.num(0);
        if (f.op == 'num') return mob.num(0);
        var r = false;
        if (f.op == 'add') {
            var sum = [];
            for(var i=0;i<f.args.length;i++) {
                sum.push(mob.diff(f.args[i], x));
            }
            r = mob.sum(sum);
        }
        else if (f.op == 'mul') {
            var sum = [];
            for(var i=0;i<f.args.length;i++) {
                var term = [mob.diff(f.args[i], x)];
                for(var j=0;j<f.args.length;j++) {
                    if (i == j) continue;
                    term.push(f.args[j]);
                }
                sum.push(mob.prod(term));
            }
            r = mob.sum(sum);
        }
        else if (f.op == "exp") r = mob.mul(f, mob.diff(f.args[0], x));
        else if (f.op == "log") r = mob.div(mob.diff(f.args[0], x), f.args[0]);
        else if (f.op == "sqrt") r = mob.prod([mob.num(0.5), mob.diff(f.args[0], x), mob.recip(f)]);
        else if (f.op == "erf") r = mob.prod([mob.num(1.128379167095512), mob.diff(f.args[0], x), mob.exp(mob.neg(mob.mul(f.args[0], f.args[0])))]);
        else if (f.op == "sin") r = mob.mul(mob.cos(f.args[0]), mob.diff(f.args[0], x));
        else if (f.op == "cos") r = mob.neg(mob.mul(mob.sin(f.args[0]), mob.diff(f.args[0], x)));
        else if (f.op == "neg") r = mob.neg(mob.diff(f.args[0], x));
        else if (f.op == "recip") r = mob.neg(mob.div(mob.diff(f.args[0], x), mob.mul(f.args[0], f.args[0])));
        else if (f.op == "sinh") r = mob.mul(mob.cosh(f.args[0]), mob.diff(f.args[0], x));
        else if (f.op == "cosh") r = mob.mul(mob.sinh(f.args[0]), mob.diff(f.args[0], x));
        else if (f.op == "tanh") {
            var tmp = mob.cosh(f.args[0]);
            r = mob.div(mob.diff(f.args[0], x), mob.mul(tmp, tmp));
        }
        else if (f.op == "sinc") {
            var rfx = neg.recip(f.args[0]);
            var pifx = mob.mul(f.args[0], mob.num(Math.PI));
            r = mob.neg(mob.prod([
                mob.diff(f.args[0], x),
                mob.sub(mob.sin(pifx), mob.mul(pifx, mob.cos(pifx))),
                rfx, rfx, mob.num(1.0 / Math.PI)
            ]));
        }
        else r = mob.fun(f.op+'\'', f.args[0], f.args[1]);
        return r;
    },
    reduce: function(x) {
        if (x.op == 'add') {
            var sum = [];
            var neg_sum = [];
            var num = 0;
            var q = x.args.slice(), qi = [];
            for(var i=0;i<q.length;i++) q[i] = mob.reduce(q[i]);
            while (q.length || qi.length) {
                var isNeg = !q.length;
                var arg = isNeg ? qi.shift() : q.shift();
                if (arg.op == 'num') {
                    if (isNeg) num -= arg.value;
                    else num += arg.value;
                } else if (arg.op == 'neg') {
                    if (isNeg) q.push(arg.args[0]);
                    else qi.push(arg.args[0]);
                } else if (arg.op == 'add') {
                    if (isNeg) qi = qi.concat(arg.args);
                    else q = q.concat(arg.args);
                } else {
                    if (isNeg) neg_sum.push(arg);
                    else sum.push(arg);
                }
            }
            var const_term = mob.num(num);
            var pos_term = sum.length ? ((sum.length == 1) ? sum[0] : mob.sum(sum)) : false;
            var neg_term = neg_sum.length ? ((neg_sum.length == 1) ? neg_sum[0] : mob.sum(neg_sum)) : false;
            var result = false;
            if (pos_term && neg_term) result = mob.sub(pos_term, neg_term)
            else if (pos_term) result = pos_term;
            else if (neg_term) result = mob.neg(neg_term);
            if (!result) result = const_term;
            else if (num != 0) result = mob.add(const_term, result);
            return result;
        }
        if (x.op == 'mul') {
            var prod = [];
            var inv_prod = [];
            var num = 1;
            if (!x.args.slice) console.log("X W/ NO ARGS", window.wtf=x);
            var q = x.args.slice(), qi = [];
            for(var i=0;i<q.length;i++) q[i] = mob.reduce(q[i]);
            while (q.length || qi.length) {
                var isNeg = !q.length;
                var arg = isNeg ? qi.shift() : q.shift();
                if (arg.op == 'num') {
                    if (isNeg) num /= arg.value;
                    else num *= arg.value;
                } else if (arg.op == 'recip') {
                    if (isNeg) q.push(arg.args[0]);
                    else qi.push(arg.args[0]);
                } else if (arg.op == 'mul') {
                    if (isNeg) qi = qi.concat(arg.args);
                    else q = q.concat(arg.args);
                } else {
                    if (isNeg) inv_prod.push(arg);
                    else prod.push(arg);
                }
            }
            var const_term = mob.num(num);
            var pos_term = prod.length ? ((prod.length == 1) ? prod[0] : mob.prod(prod)) : false;
            var inv_term = inv_prod.length ? ((inv_prod.length == 1) ? inv_prod[0] : mob.prod(inv_prod)) : false;
            var result = false;
            if (pos_term && inv_term) result = mob.div(pos_term, inv_term)
            else if (pos_term) result = pos_term;
            else if (inv_term) result = mob.recip(inv_term);
            if (!result) result = const_term;
            else if (num != 1) result = mob.mul(const_term, result);
            return result;
        }
        return x;
    },
    subst: function(x, syms) {
        if (x.op == 'num') return x;
        if (x.op == 'sym') {
            var s = syms[x.symbol];
            if (!s) {
                for(var k in syms) {
                    var ks = syms[k];
                    var kb = k+"[";
                    if (x.symbol.substr(0, kb.length) == kb) {
                        var numbero = x.symbol.substr(k.length+1, x.symbol.length - k.length - 2);
                        if (typeof(ks) == "string") {
                            if (ks.indexOf("$") != -1) {
                                return mob.sym(ks.split("$").join(numbero));
                            } else {
                                return mob.sym(ks + x.symbol.substr(k.length));
                            }
                        } else if (typeof(ks) == "function") {
                            return ks(numbero);
                        } else {
                            return mob.subst(ks, {"$": mob.num(numbero)});
                        }
                    }
                }
            }
            if (typeof(s) == "string") {
                return mob.sym(s);
            }
            if (s) return s;
            return x;
        }
        var r = {id: mob.next_id++, op: x.op, args: []};
        for(var i=0;i<x.args.length;i++) {
            r.args.push(mob.subst(x.args[i], syms));
        }
        if (syms[r.op]) {
            if (typeof(syms[r.op]) == "string") {
                r.op = syms[r.op];
            } else {
                r = syms[r.op].apply(r.op, r.args);
            }
        }
        return r;
    },
    str: function(x) {
        if (x.op == 'num') return ""+x.value;
        if (x.op == 'sym') return ""+x.symbol;
        var oper = ',';
        if (x.op == 'add') oper = '+';
        if (x.op == 'mul') oper = '*';
        var s = "(";
        for(var i=0;i<x.args.length;i++) {
            if (s != "(") s += oper;
            s += mob.str(x.args[i]);
        }
        s += ")";
        if (x.op == 'neg') s = "-"+s;
        else if (x.op == 'recip') s = "1/"+s;
        else if (oper == ',') s = x.op+s;
        return s;
    },
    compile: function(x, args) {
        if (args === undefined) args = [];
        if (args) {
            var mobjs_last_compiled_function_ = false;
            eval("mobjs_last_compiled_function_ = function("+args.join(",")+"){return "+mob.compile(x, false)+";}");
            return mobjs_last_compiled_function_;
        }
        if (x.op == 'num') return ""+x.value;
        if (x.op == 'sym') return ""+x.symbol;
        var oper = ',';
        if (x.op == 'add') oper = '+';
        if (x.op == 'mul') oper = '*';
        var s = "(";
        for(var i=0;i<x.args.length;i++) {
            if (s != "(") s += oper;
            s += mob.compile(x.args[i], false);
        }
        s += ")";
        if (x.op == 'neg') s = "-"+s;
        else if (x.op == 'recip') s = "1/"+s;
        else if (oper == ',') {
            var fn = x.op.split("'").join("_d");
            if (mob.numer[fn]) {
                s = "mob.numer."+fn+s;
            } else if (Math[fn]) {
                s = "Math."+fn+s;
            } else {
                s = fn+s;
            }
        }
        return s;
    },
    compile_glsl: function(x, o) {
        if (!x) return false;
        if (!o) {
            var o = {temps:{}, imports: {}, value: []};
            if (Array.isArray(x)) {
                for(var i=0;i<x.length;i++) {
                    var oo = mob.compile_glsl(mob.reduce(x[i]), {value: "", temps: {}, imports: {}});
                    for(var k in oo.temps) o.temps[k] = oo.temps[k];
                    for(var k in oo.imports) o.imports[k] = oo.imports[k];
                    o.value.push(oo.value);
                }
            } else {
                o = mob.compile_glsl(mob.reduce(x), {value: "", temps: {}, imports: {}});
            }
            var keys = Object.keys(o.temps).sort(function(l, r) {
                return parseInt(l) < parseInt(r);
            });
            o.code = "";
            for(var i=0;i<keys.length;i++) {
                o.code += "float t"+keys[i]+" = "+o.temps[keys[i]]+";\n";
            }
            o.libs = "";
            var importq = Object.keys(o.imports);
            while (importq.length) {
                var k = importq.shift();
                var fn = mob.numer_glsl[k];
                if (!fn) continue;
                if (fn === true) continue;
                o.libs = fn.code + "\n" + o.libs;
                if (fn.imports) for(var i=0;i<fn.imports.length;i++) {
                    importq.push(fn.imports[i]);
                }
            }
            return o;
        }
        if (x.op == 'num') {
            var s = ""+parseFloat(x.value);
            if (s.indexOf(".") == -1 && s.toLowerCase().indexOf("e") == -1) s += ".0";
            return {value: s, temps: {}, imports: {}};
        }
        if (x.op == 'sym') {
            return {value: ""+x.symbol, temps: {}, imports: {}};
        }
        var oper = ',';
        if (x.op == 'add') oper = '+';
        if (x.op == 'mul') oper = '*';
        var s = "(";
        for(var i=0;i<x.args.length;i++) {
            if (s != "(") s += oper;
            if (x.args[i].op == 'num' || x.args[i].op == 'sym') {// || (x.args[i].op == 'add' && Math.random() < 0.9) || (x.args[i].op == 'mul' && Math.random() < 0.5)) {
                var id = x.args[i].id;
                var r = mob.compile_glsl(x.args[i], o);
                s += r.value;
                if (!o.temps[id]) {
                    for(var k in r.temps) o.temps[k] = r.temps[k];
                    for(var k in r.imports) o.imports[k] = o.imports[k] ? o.imports[k] : r.imports[k];
                }
            } else {
                var id = x.args[i].id;
                s += "t"+id;
                if (!o.temps[id]) {
                    var r = mob.compile_glsl(x.args[i], o);
                    o.temps[id] = r.value;
                    for(var k in r.temps) o.temps[k] = r.temps[k];
                    for(var k in r.imports) o.imports[k] = o.imports[k] ? o.imports[k] : r.imports[k];
                }
            }
        }
        s += ")";
        if (x.op == 'neg') s = "-"+s;
        else if (x.op == 'recip') s = "1.0/"+s;
        else if (oper == ',') {
            var fn = x.op.split("'").join("_d");
            if (mob.numer[fn]) {
                o.imports[fn] = true;
                s = "mob_numer_"+fn+s;
            } else {
                if (!o.imports[fn]) {
                    o.imports[fn] = false;
                }
                s = fn+s;
            }
        }
        o.value = s;
        return o;
    },
    numer: {
        exp: Math.exp,
        log: Math.log,
        sqrt: Math.sqrt,
        sin: Math.sin, cos: Math.cos,
        asin: Math.asin, acos: Math.acos,
        sinh: Math.sinh, cosh: Math.cosh,
        tanh: Math.tanh,
        sec: function(x) {return 1.0 / Math.cos(x);},
        csc: function(x) {return 1.0 / Math.sin(x);},
        cot: function(x) {return 1.0 / Math.tan(x);},
        sech: function(x) {return 1.0 / Math.cosh(x);},
        csch: function(x) {return 1.0 / Math.sinh(x);},
        coth: function(x) {return 1.0 / Math.tanh(x);},
        erf: function(x) {
            var s = (x < 0) ? -1 : 1;
            var m = [0.3275911, 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
            var y = 1.0 / (1.0 + m[0]*x);
            return s * (1.0 - Math.exp(-x*x) * y*(m[1] + y*(m[2] + y*(m[3] + y*(m[4] + y*m[5])))));
        },
        gelu: function(x) {return x * (0.5 + 0.5*mob.numer.erf(x * 0.7071067811865475));},
        gelu_d: function(x) {
            var a = (1.0 + mob.numer.erf(x * 0.7071067811865475)) / 2.0;
            var b = Math.exp(-0.5*x*x) * x * 0.3989422804014327;
            return a + b;
        },
        relu: function(x) {return (x < 0) ? 0 : x;},
        relu_d: function(x) {return (x < 0) ? 0 : 1;},
        sigmoid: function(x) {return 1.0 / (1.0 + Math.exp(-x));},
        sigmoid_d: function(x) {var ex = Math.exp(x); return 1.0 / (ex + 1.0/ex + 2.0);},
        sinc: function(x) {return Math.sin(x*Math.PI) / (x*Math.PI);},
        sinc_d: function(x) {return Math.cos(x*Math.PI) / x - Math.sin(x*Math.PI) / (x*x*Math.PI);},
    },
    numer_glsl: {
        exp: {code:"float mob_numer_exp(float x) {return exp(clamp(x, -25.0, 25.0));}", builtin: true},
        log: true,
        sqrt: true,
        sin: true, cos: true,
        asin: true, acos: true,
        sinh: {code:"float mob_numer_sinh(float x) {x=exp(clamp(x, -25.0, 25.0));return (x-1.0/x)/2.0;}", builtin: true},
        cosh: {code:"float mob_numer_cosh(float x) {x=exp(clamp(x, -25.0, 25.0));return (x+1.0/x)/2.0;}", builtin: true},
        tanh: {code:"float mob_numer_tanh(float x) {x=exp(clamp(2.0*x, -25.0, 25.0));return (x-1.0)/(x+1.0);}", builtin: true},
        sec: {code:"float mob_numer_sec(float x) {return 1.0/cos(x);}"},
        csc: {code:"float mob_numer_csc(float x) {return 1.0/sin(x);}"},
        cot: {code:"float mob_numer_cot(float x) {return 1.0/tan(x);}"},
        sech: {code:"float mob_numer_sech(float x) {return 1.0/mob_numer_cosh(x);}", imports:["cosh"]},
        csch: {code:"float mob_numer_csch(float x) {return 1.0/mob_numer_sinh(x);}", imports:["sinh"]},
        coth: {code:"float mob_numer_coth(float x) {return 1.0/mob_numer_tanh(x);}", imports:["tanh"]},
        erf: {code:"float mob_numer_erf(float x) {x=clamp(x,-5.0,5.0);float s=(x<0.0)?-1.0:1.0;float y=1.0/(1.0+x*0.3275911);return s-s*exp(-x*x)*y*(0.254829592+y*(-0.284496736+y*(1.421413741+y*(-1.453152027+y*1.061405429))));}"},
        gelu: {code:"float mob_numer_gelu(float x) {return x*(0.5+0.5*mob_numer_erf(x*0.7071067811865475));}", imports:["erf"]},
        gelu_d: {code:"float mob_numer_gelu_d(float x) {return (0.5+0.5*mob_numer_erf(x*0.7071067811865475)) + mob_numer_exp(-0.5*x*x)*x*0.3989422804014327;}", imports:["erf","exp"]},
        relu: {code:"float mob_numer_relu(float x) {return max(x,0.0);}"},
        relu_d: {code:"float mob_numer_relu_d(float x) {return (x<0.0)?0.0:1.0;}"},
        sigmoid: {code:"float mob_numer_sigmoid(float x) {return 1.0/(1.0+exp(clamp(-x, -25.0, 25.0)));}"},
        sigmoid_d: {code:"float mob_numer_sigmoid_d(float x) {x=exp(clamp(x, -25.0, 25.0));return 1.0/(2.0+x+1.0/x);}"},
        sinc: {code:"float mob_numer_sinc(float x) {return sin(x*3.141592653589793)*0.3183098861837907/x;}"},
        sinc_d: {code:"float mob_numer_sinc(float x) {float ix=1.0/x;return ix*(cos(x*3.141592653589793)-ix*sin(x*3.141592653589793)*0.3183098861837907);}"}
    },
    tensor: {
        map: function(shape, f, x) {
            var out = [];
            var tmp = shape.slice();
            var elem_dim = tmp.shift();
            var size = elem_dim;
            var outer_dim = false;
            while (tmp.length) {
                var dim = tmp.pop();
                if (!outer_dim) outer_dim = dim;
                size *= dim;
            }
            if (x && (typeof(x) != "object" || x.length == size)) {
                throw new Error("tensor.shape.map: input argument must match the given shape");
            }
            for(var i=0;i<size;i+=elem_dim) {
                var v = x ? [] : false;
                if (x) for(var j=0;j<elem_dim;j++) v.push(x[i+j]);
                var y = f(i, elem_dim, v);
                if (!Array.isArray(y)) {
                    if (elem_dim == 1) {
                        if (typeof(y) == "number") {
                            y = [mob.num(y)];
                        } else if (typeof(y) == "string") {
                            y = [mob.sym(y)];
                        } else if (typeof(y) == "object" && y.op) {
                            y = [y];
                        } else {
                            throw new Error("tensor.map: Failed to convert return value to a math type");
                        }
                    }
                    if (y.length != elem_dim) throw new Error("tensor.map: Callback must return arrays of size "+elem_dim);
                }
                out = out.concat(y);
            }
            out.shape = shape;
            return out;
        },
        map1: function(shape, f, x) {
            var r = mob.tensor.map([1].concat(shape), f, x);
            r.shape.shift();
            return r;
        },
        eq: function(l,r) {
            if (l.length != r.length) return false;
            for(var i=0;i<l.length;i++) {
                if (l[i] != r[i]) return false;
            }
            return true;
        },
        sym: function(shape, str) {
            return mob.tensor.map1(shape, function(i) {return str+"["+i+"]";});
        },
        num: function(shape, num) {
            return mob.tensor.map1(shape, function() {return num;});
        },
        fun: function(f, x, y) {
            return mob.tensor.map1(x.shape, function(i) {return mob.fun(f, x[i], y ? y[i] : undefined);});
        },
        add: function(x, y) {return mob.tensor.fun("add", x, y);},
        sub: function(x, y) {return mob.tensor.fun("sub", x, y);},
        mul: function(x, y) {return mob.tensor.fun("mul", x, y);},
        div: function(x, y) {return mob.tensor.fun("div", x, y);},
        dot: function(x, y) {
            if (x.length != y.length) throw new Error("tensor.dot: Inputs must have same number of elements.");
            var sum = [];
            for(var i=0;i<x.length;i++) {
                sum.push(mob.mul(x[i], y[i]));
            }
            var r = [mob.sum(sum)];
            r.shape = [1];
            return r;
        },
        length: function(x) {
            var sum = [];
            for(var i=0;i<x.length;i++) {
                sum.push(mob.mul(x[i], x[i]));
            }
            var r = [mob.sqrt(mob.sum(sum))];
            r.shape = [1];
            return r;
        },
        softmax: function(x) {
            var r = [];
            for(var i=0;i<x.length;i++) {
                r.push(mob.exp(x[i]));
            }
            var rsum = mob.sum(r);
            var scale = mob.recip(rsum);
            for(var i=0;i<x.length;i++) {
                r[i] = mob.mul(r[i], scale);
            }
            r.shape = x.shape;
            return r;
        }
    },
    layer: {
        FullyConnected: function(options) {
            var f = function(tensor) {
                var params = [];
                var neurons = mob.tensor.map1(f.output_shape, function(i) {
                    var sum = [];
                    for(var i=0;i<tensor.length;i++) {
                        var wt = mob.sym("w"+mob.next_id++);
                        sum.push(mob.mul(wt, tensor[i]));
                        params.push(wt);
                    }
                    return mob.fun(f.activation, mob.sum(sum));
                });
                neurons.params = params;
                return neurons;
            };
            f.output_shape = [1];
            f.activation = "gelu";
            if (options) for(var k in options) f[k] = options[k];
            return f;
        }
    }
};
