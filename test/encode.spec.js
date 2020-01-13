var should = require("should");
var helper = require("node-red-node-test-helper");
var encode = require("../src/nodes/encode");
var protofile = require("../src/nodes/protofile");

helper.init(require.resolve("node-red"));

var encodeFlow = [
  {
    id: "encode-node",
    type: "encode",
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

describe("protobuf encode node", function() {
  afterEach(function() {
    helper.unload();
    should();
  });

  it("should be loaded", function(done) {
    var flow = [
      {
        id: "n1",
        type: "encode",
        name: "test name",
        protoType: "TestType"
      }
    ];
    helper.load(encode, flow, function() {
      var n1 = helper.getNode("n1");
      n1.should.have.property("name", "test name");
      n1.should.have.property("protoType", "TestType");
      done();
    });
  });

  it("should encode a message into a buffer", function(done) {
    helper.load([encode, protofile], encodeFlow, function() {
      let testMessage = {
        timestamp: 1533295590569,
        foo: 1.0,
        bar: true,
        test: "A string value"
      };
      var encodeNode = helper.getNode("encode-node");
      var helperNode = helper.getNode("helper-node");
      helperNode.on("input", function(msg) {
        should(msg.payload instanceof Buffer).equal(true);
        done();
      });
      encodeNode.receive({
        payload: testMessage
      });
    });
  });

  it("should encode a message into a buffer with type specified in incomming message", function(done) {
    helper.load([encode, protofile], encodeFlow, function() {
      let testMessage = {
        timestamp: 1533295590569,
        foo: 1.0,
        bar: true,
        test: "A string value"
      };
      var encodeNode = helper.getNode("encode-node");
      var helperNode = helper.getNode("helper-node");
      helperNode.on("input", function(msg) {
        should(msg.payload instanceof Buffer).equal(true);
        done();
      });
      encodeNode.receive({
        payload: testMessage,
        protobufType: "TestType"
      });
    });
  });
});
