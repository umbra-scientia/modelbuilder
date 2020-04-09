var nextid = 0;
function Model(options) {
    this.batch_size = 1;
    for(var k in options) this[k] = options[k];
    this.name += nextid++;
    this.blocks = [];
    return this;
}
Model.prototype.AddBlock = function(x) {
    if (this.blocks.indexOf(x) == -1) {
        this.blocks.push(x);
    }
    x.model = this;
}
Model.prototype.RemoveBlock = function(x) {
    var offset = this.blocks.indexOf(x);
    if (offset != -1) {
        this.blocks.splice(offset, 1);
        x.model = undefined;
    }
}
Model.prototype.Compile = function(inputs) {
    this.code = {};
    var tmp = inputs;
    for(var k in this.blocks) {
        tmp = this.blocks[k].Compile(tmp);
        this.code[k] = tmp;
    }
    return tmp;
}
