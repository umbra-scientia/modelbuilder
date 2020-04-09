var nextid = 0;
var weightid = 0;
function Reflex(options) {
    this.type = "reflex";
    this.input_shape = false;
    this.output_shape = false;
    this.hidden_shape = [1];
    this.activation = "gelu";
    this.name = "R";
    for(var k in options) this[k] = options[k];
    this.name += nextid++;
    return this;
}
Reflex.prototype.Compile = function(input) {
    var code = {
        params: [],
        layers: [input],
        output: input
    };
    for(var l=0;l<this.hidden_shape.length;l++) {
        var next_layer = [];
        for(var k=0;k<this.hidden_shape[l];k++) {
            var wt = "w" + weightid++;
            code.params.push(wt);
            var out = mob.sym(wt);
            for(var i=0;i<code.output.length;i++) {
                var wt = "w" + weightid++; 
                code.params.push(wt);
                out = mob.add(out, mob.mul(mob.sym(wt), code.output[i]));
            }
            if (this.activation) {
                out = mob.fun(this.activation, out);
            }
            out = mob.reduce(out);
            next_layer.push(out);
        }
        code.output = next_layer;
        code.layers.push(next_layer);
    }
    return code;
}