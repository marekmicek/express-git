/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const expressGit = require("../src/index");
const Promise = require("bluebird");
const rimraf = Promise.promisify(require("rimraf"));
const os = require("os");
const path = require("path");
const supertest = require("supertest-as-promised");
const {
  assert
} = require("chai");
const {
  cat
} = require("shelljs");
const GIT_PROJECT_ROOT = path.join(os.tmpdir(), `express-git-test-${new Date().getTime()}`);
const app = expressGit.serve(GIT_PROJECT_ROOT, {});
const agent = supertest(app);

describe("POST /*.git/commit", function() {
  const FILE = `${__dirname}/data/test.txt`;
  const FILEDATA = cat(FILE);

  after(() => rimraf(GIT_PROJECT_ROOT));
  it("creates a repo on first commit", () =>
    agent.post("/test.git/commit")
    .field("message", "Commit message")
    .field("author", "John Doe <john@doe.com>")
    .attach("foo/bar/test.txt", FILE)
    .attach("foo/test.txt", FILE)
    .expect(200)
  );

  it("browses the commit", () =>
    agent.get("/test.git/commit")
    .expect(function(res) {
      assert(res.body.author.email === "john@doe.com");
      assert(res.body.committer.email === "john@doe.com");
      assert(res.body.id.length === 40);
      return assert(res.body.message === "Commit message");
    })
  );

  it("Can browse the created blobs", function() {
    const blobA = agent.get("/test.git/blob/foo/test.txt")
      .expect({
        id: "980a0d5f19a64b4b30a87d4206aade58726b60e3",
        path: "foo/test.txt",
        type: "blob",
        mime: "text/plain",
        size: FILEDATA.length,
        contents: FILEDATA,
        encoding: "utf8",
        binary: false,
        truncated: false,
        filename: "test.txt"
      });
    const blobB = agent.get("/test.git/blob/foo/bar/test.txt")
      .expect({
        id: "980a0d5f19a64b4b30a87d4206aade58726b60e3",
        path: "foo/bar/test.txt",
        mime: "text/plain",
        size: FILEDATA.length,
        contents: FILEDATA,
        encoding: "utf8",
        binary: false,
        truncated: false,
        type: "blob",
        filename: "test.txt"
      });

    return Promise.join(blobA, blobB);
  });

  it("Can browse the created dirs", function() {
    const dirA = agent.get("/test.git/tree/foo/bar")
      .expect({
        id: "376357880b048faf2553da6bc58ae820cea3690a",
        type: "tree",
        path: "foo/bar",
        name: "bar",
        entries: [{
          id: "980a0d5f19a64b4b30a87d4206aade58726b60e3",
          path: "foo/bar/test.txt",
          type: "blob",
          filename: "test.txt",
          attr: "100644"
        }]
      });
    const dirB = agent.get("/test.git/tree/foo")
      .expect({
        id: "9868d83040a01353c11c7aec46364e817ba51643",
        type: "tree",
        path: "foo",
        name: "foo",
        entries: [{
            id: "376357880b048faf2553da6bc58ae820cea3690a",
            type: "tree",
            path: "foo/bar",
            filename: "bar",
            attr: "40000"
          },
          {
            id: "980a0d5f19a64b4b30a87d4206aade58726b60e3",
            path: "foo/test.txt",
            type: "blob",
            filename: "test.txt",
            attr: "100644"
          }
        ]
      });
    return Promise.join(dirA, dirB);
  });

  it("finds the created files", function() {
    const fileA = agent.get("/test.git/raw/foo/bar/test.txt")
      .expect(200)
      .expect(FILEDATA);
    const fileB = agent.get("/test.git/raw/foo/test.txt")
      .expect(200)
      .expect(FILEDATA);
    return Promise.join(fileA, fileB);
  });

  it("should return 404 on non-existing blob browses", () =>
    agent.get("/test.git/blob/foo.txt")
    .expect(404)
  );

  it("should return 400 on browsing dirs as blob", () =>
    agent.get("/test.git/blob/foo")
    .expect(400)
  );

  return it("Should return 404 on non-existent repos", () =>
    agent.get("/test-1.git/commit")
    .expect(404)
  );
});