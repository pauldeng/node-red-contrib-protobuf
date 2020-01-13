var should = require("should");
var helper = require("node-red-node-test-helper");
var decode = require("../src/nodes/decode");

helper.init(require.resolve("node-red"));

describe("protobuf decode node", function() {
  afterEach(function() {
    helper.unload();
    should();
  });

  it("should be loaded", function(done) {
    var flow = [{ id: "n1", type: "decode", name: "test name" }];
    helper.load(decode, flow, function() {
      var n1 = helper.getNode("n1");
      n1.should.have.property("name", "test name");
      done();
    });
  });
});
