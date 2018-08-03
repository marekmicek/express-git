/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
require("shelljs/global");
const Promise = require("bluebird");
const execp = Promise.promisify(require("child_process").exec);
const expressGit = require("../src/index");
const assert = require("assert");

describe("git-http-backend service", function() {
  let DEST_DIR, GIT_PROJECT_ROOT, SOURCE_DIR;
  const DATA_DIR = `${__dirname}/data/repo`;
  let TMP_DIR = (GIT_PROJECT_ROOT = (SOURCE_DIR = (DEST_DIR = null)));
  const PORT = (20000 + (new Date().getTime() % 10000)) | 0;
  const REPO = `testrepo-${new Date().getTime()}`;
  before(function() {
    mkdir("-p", (TMP_DIR = `${process.cwd()}/tmp/express-git-test-${new Date().getTime()}`));
    mkdir(GIT_PROJECT_ROOT = `${TMP_DIR}/repos`);
    mkdir(SOURCE_DIR = `${TMP_DIR}/source`);
    return mkdir(DEST_DIR = `${TMP_DIR}/dest`);
  });
  let app = null;
  let server = null;
  before(function() {
    app = expressGit.serve(GIT_PROJECT_ROOT, {});
    return server = app.listen(PORT);
  });

  it("Clones empty repos", function() {
    cd(SOURCE_DIR);
    return execp(`git clone http://localhost:${PORT}/${REPO}.git`)
      .then(() => assert.ok((test("-d", REPO)), "Cloned empty repo"));
  });

  it("Pushes refs", function() {
    cd(REPO);
    cp(`${DATA_DIR}/README.md`, ".");
    exec("git add README.md");
    exec("git commit -m 'Initial commit'");
    return execp("git push origin master");
  });

  it("Clones ", function() {
    cd(DEST_DIR);
    return execp(`git clone http://localhost:${PORT}/${REPO}.git`)
      .then(function() {
        assert.ok((test("-d", REPO)), "Cloned repo");
        cd(REPO);
        assert.ok((test("-f", "README.md")), "Cloned repo");
        return assert.equal((cat("README.md")), "# Foo Bar Baz\n", "README is ok");
      });
  });

  it("Pushes from non-empty repo", function() {
    cd(DEST_DIR);
    cd(REPO);
    cp("-R", `${DATA_DIR}/foo`, ".");
    exec("git add foo");
    exec("git commit -m 'Add foo'");
    return execp("git push origin master")
      .then(() => assert.ok((test("-f", "foo/bar/baz.txt")), "Pushed Code"));
  });

  it("Pulls changes", function() {
    cd(SOURCE_DIR);
    cd(REPO);
    return execp("git pull")
      .then(function() {
        assert.ok(test("-d", "foo"));
        assert.ok(test("-d", "foo/bar"));
        assert.ok(test("-f", "foo/bar/baz.txt"));
        return assert.equal((cat("foo/bar/baz.txt")), "foo bar baz\n");
      });
  });

  after(() => server.close());
  return after(() => rm("-rf", TMP_DIR));
});