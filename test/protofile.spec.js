var should = require("should");
var helper = require("node-red-node-test-helper");
var protofile = require("../src/nodes/protofile");
var fs = require("fs");

helper.init(require.resolve("node-red"));

describe("protobuf protofile node", function() {
  afterEach(function() {
    helper.unload();
    should();
  });

  it("test.proto should be loadable", function(done) {
    fs.access("test/assets/test.proto", error => {
      if (!error) done();
    });
  });

  it("should be loaded", function(done) {
    var flow = [
      {
        id: "n1",
        type: "protobuf-file",
        name: "test name",
        protopath: "test/assets/test.proto"
      }
    ];
    helper.load(protofile, flow, function() {
      var n1 = helper.getNode("n1");
      n1.should.have.property("name", "test name");
      n1.should.have.property("protopath", "test/assets/test.proto");
      n1.should.have.property("prototypes").which.is.a.Object();
      done();
    });
  });
});
