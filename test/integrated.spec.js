var should = require("should");
var helper = require("node-red-node-test-helper");
var encode = require("../src/nodes/encode");
var decode = require("../src/nodes/decode");
var protofile = require("../src/nodes/protofile");

helper.init(require.resolve("node-red"));

var integratedFlow = [
  {
    id: "encode-node",
    type: "encode",
    z: "e4c459b3.cc22e8",
    name: "",
    protofile: "c55e9eb5.3175",
    protoType: "TestType",
    wires: [["decode-node"]]
  },
  {
    id: "decode-node",
    type: "decode",
    z: "e4c459b3.cc22e8",
    name: "",
    protofile: "c55e9eb5.3175",
    protoType: "TestType",
    wires: [["helper-node"]]
  },
  {
    id: "helper-node",
    type: "helper",
    z: "e4c459b3.cc22e8",
    name: "",
    outputs: 1,
    noerr: 0,
    wires: [[]]
  },
  {
    id: "c55e9eb5.3175",
    type: "protobuf-file",
    z: "",
    protopath: "test/assets/test.proto"
  }
];

describe("protobuf integration test", function() {
  afterEach(function() {
    helper.unload();
    should();
  });

  it("should be loaded", function(done) {
    var flow = [
      { id: "n1", type: "protobuf-file", name: "test name" },
      { id: "n2", type: "encode", name: "test name" },
      { id: "n3", type: "decode", name: "test name" }
    ];
    helper.load([protofile, encode, decode], flow, function() {
      var n1 = helper.getNode("n1");
      n1.should.have.property("name", "test name");
      var n2 = helper.getNode("n2");
      n2.should.have.property("name", "test name");
      var n3 = helper.getNode("n3");
      n3.should.have.property("name", "test name");
      done();
    });
  });

  it("should encode and decode a message with idempotence", function(done) {
    helper.load([encode, decode, protofile], integratedFlow, function() {
      let testMessage = {
        timestamp: 1533295590569,
        foo: 1.0,
        bar: true,
        test: "A string value"
      };
      var encodeNode = helper.getNode("encode-node");
      var helperNode = helper.getNode("helper-node");
      helperNode.on("input", function(msg) {
        JSON.stringify(testMessage).should.equal(JSON.stringify(msg.payload));
        done();
      });
      encodeNode.receive({
        payload: testMessage
      });
    });
  });
});
