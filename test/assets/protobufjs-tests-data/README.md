# protobuf.js Tests/Data Fixtures

These fixtures mirror the `.proto` files from:

https://github.com/protobufjs/protobuf.js/tree/master/tests/data

Imported upstream revision:

`6b57a8a39f9c2524df59f6bf48e9f5b47a0a6892`

Only `.proto` files and relevant license files are copied. Generated upstream
JavaScript, TypeScript declarations, JSON, binary, and text fixtures are not
copied because this project only uses the schema corpus.

Some upstream `.proto` files are intentionally invalid or reference missing
imports. Tests keep those files in the corpus and assert their expected parser
failures instead of omitting them.
