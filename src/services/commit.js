/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS203: Remove `|| {}` from converted for-own loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Busboy = require("busboy");
const Promise = require("bluebird");
const _path = require("path");
const {
  workdir,
  httpify
} = require("../helpers");
const {
  createWriteStream
} = require("fs");
const rimraf = Promise.promisify(require("rimraf"));
const mkdirp = Promise.promisify(require("mkdirp"));
const git = require("../ezgit");

const processCommitForm = function(req, workdir, path) {
  const bb = new Busboy({
    headers: req.headers
  });
  const files = [];
  const add = [];
  bb.on("file", function(filepath, file) {
    filepath = _path.join((path || ""), filepath);
    const dest = _path.join(workdir, filepath);
    return files.push((mkdirp(_path.dirname(dest))).then(() =>
      new Promise(function(resolve, reject) {
        file.on("end", function() {
          add.push(filepath);
          return resolve();
        });
        file.on("error", reject);
        return file.pipe(createWriteStream(dest));
      })
    ));
  });

  const commit = {};
  const remove = [];
  bb.on("field", function(fieldname, value) {
    if (fieldname === "remove") {
      return remove.push(value);
    } else {
      return commit[fieldname] = value;
    }
  });

  const form = new Promise(function(resolve) {
    return bb.on("finish", () =>
      Promise.all(files)
      .then(() => resolve({
        add,
        remove,
        commit
      }))
    );
  });
  req.pipe(bb);
  return form;
};

module.exports = function(app, options) {
  const {
    ConflictError,
    BadRequestError
  } = app.errors;

  return app.post("/:git_repo(.*).git/:refname(.*)?/commit/:path(.*)?", app.authorize("commit"), function(req, res, next) {
    let author, committer;
    let {
      git_repo,
      refname,
      path
    } = req.params;
    const {
      repositories,
      disposable
    } = req.git;
    const etag = req.headers['x-parent-id'] || (req.query != null ? req.query.parent : undefined) || `${git.Oid.ZERO}`;
    const WORKDIR = workdir();
    const form = processCommitForm(req, WORKDIR, path);
    const repo = repositories.openOrInit(git_repo).then(function(...args) {
      let repo;
      [repo] = Array.from(args[0]);
      return repo;
    });
    const ref = repo.then(function(repo) {
      if (refname == null) {
        refname = "HEAD";
      }
      return git.Reference.find(repo, refname)
        .then(disposable)
        .catch(httpify(404))
        .then(function(ref) {
          if (ref != null ? ref.isSymbolic() : undefined) {
            refname = ref.symbolicTarget();
            ref = null;
          } else if (ref != null) {
            refname = ref.name();
          }
          if ((ref != null) && (`${ref.target()}` !== etag)) {
            throw new ConflictError;
          }
          return ref;
        });
    });

    const parent = Promise.join(repo, ref, function(repo, ref) {
      if (ref != null) {
        return disposable(repo.getCommit(ref.target()));
      } else {
        return null;
      }
    });
    const tree = parent.then(parent =>
      parent != null ? parent.getTree()
      .then(disposable)
      .then(function(tree) {
        if (!path) {
          return tree;
        }
        return (tree != null ? tree.entryByPath(path)
          .then(disposable)
          .then(function(entry) {
            if (entry.isBlob()) {
              throw new BadRequestError("Entry is not a blob");
            }
            return tree;
          }) : undefined);
      }) : undefined
    );

    const index = Promise.join(repo, tree, (repo, tree) =>
      repo.index()
      .then(disposable)
      .then(function(index) {
        index.clear();
        if (tree) {
          index.readTree(tree);
        }
        return index;
      })
    );

    disposable(author = Promise.join(repo, form, function(repo, {
      commit
    }) {
      let created_at;
      ({
        created_at,
        author
      } = commit);
      if (author) {
        return git.Signature.create(author, new Date(created_at));
      } else {
        return repo.defaultSignature();
      }
    }));

    disposable(committer = Promise.join(author, form, function(author, {
      commit
    }) {
      ({
        committer
      } = commit);
      if (committer) {
        return git.Signature.create(committer, new Date());
      } else {
        return git.Signature.create(author, new Date());
      }
    }));

    const addremove = Promise.join(repo, index, form, function(repo, index, {
      remove,
      add
    }) {
      repo.setWorkdir(WORKDIR, 0);
      for (let r of Array.from(remove)) {
        index.removeByPath(r);
      }
      for (let a of Array.from(add)) {
        index.addByPath(a);
      }
      return index.writeTree()
        .then(disposable);
    });

    return Promise.all([
        repo,
        form,
        author,
        committer,
        parent,
        addremove
      ])
      .then(function(...args) {
        let repo, form, author, committer, parent, tree;
        [repo, form, author, committer, parent, tree] = Array.from(args[0]);
        const commit = {
          // Make everything modifiable
          parents: parent ? [`${parent.id()}`] : [],
          ref: refname,
          tree: `${tree}`,
          author: author.toJSON(),
          committer: committer.toJSON(),
          message: form.commit.message
        };
        return app.emit("pre-commit", repo, commit)
          .then(() => repo.commit(commit))
          .then(disposable)
          .then(function(result) {
            commit.id = `${result.id()}`;
            return app.emit("post-commit", repo, commit)
              .then(() => result);
          }).then(commit => res.json(commit));
      }).finally(() => rimraf(WORKDIR))
      .then(() => next())
      .catch(next);
  });
};

const object = {
  processCommitForm
};
for (let key of Object.keys(object || {})) {
  const value = object[key];
  module.exports[key] = value;
}