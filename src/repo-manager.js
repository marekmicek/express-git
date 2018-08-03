/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require("lodash");
const _path = require("path");
const Promise = require("bluebird");
const git = require("./ezgit");

const EventEmitter = require("events-as-promised");
const using = (handler, chain) => git.using(chain, handler);
const DEFAULT_PATTERN = /.*/;

class RepoManager extends EventEmitter {
  static initClass() {
    module.exports = this;
  }

  constructor(root, disposables, options) {
    super()
    this.root = root;
    if (disposables == null) {
      disposables = [];
    }
    if (options == null) {
      options = {};
    }
    this.options = options;
    this.disposables = disposables;
    this.disposable = function(obj) {
      disposables.push(obj);
      return obj;
    };
  }


  parse(path) {
    const name = path.replace(/\.git$/, "");
    const pattern = (this.options != null ? this.options.pattern : undefined) || DEFAULT_PATTERN;
    const match = name.match(pattern);
    return Promise.resolve(match || [])
      .then((...args) => {
        let params;
        let name;
        [name, ...params] = Array.from(args[0]);
        if (name == null) {
          throw new Error(`Invalid repo path '${path}'`);
        }
        const git_dir = _path.join(this.root, name);
        return [name, params, git_dir];
      });
  }

  ref(path, refname) {
    return this.open(path)
      .then(repo => {
        if ((repo == null)) {
          return [null, null];
        } else if (refname) {
          return repo.getReference(refname)
            .then(this.disposable)
            .then(ref => [ref, repo]);
        } else {
          return repo.head()
            .then(this.disposable)
            .then(ref => [ref, repo]);
        }
      });
  }

  openOrInit(path, options) {
    return this.open(path)
      .then(repo => {
        if (repo != null) {
          return [repo, false];
        } else if (this.options.auto_init !== false) {
          return this.init(path, options)
            .then(repo => [repo, true]);
        } else {
          return [null, false];
        }
      });
  }

  open(path) {
    return this.parse(path)
      .then((...args) => {
        const [name, params, git_dir] = Array.from(args[0]);
        return git.Repository.open(git_dir, {
            bare: true,
            ceilings: [this.root]
          })
          .then(this.disposable)
          .catch(() => null)
          .then(repo => _.assign(repo, {
            name,
            params,
            git_dir
          }));
      });
  }

  init(path, options) {
    if (options == null) {
      options = {};
    }
    return this.parse(path)
      .then((...args) => {
        const [name, params, git_dir] = Array.from(args[0]);
        const init_options = _.assign({}, this.options.init_options, options);
        return this.emit("pre-init", name, params, init_options)
          .then(() => git.Repository.init(git_dir, options))
          .then(this.disposable)
          .catch(() => null)
          .then(repo => _.assign(repo, {
            name,
            params,
            git_dir
          }))
          .then(repo => {
            if (repo != null) {
              return this.emit("post-init", repo)
                .then(() => repo);
            } else {
              return repo;
            }
          });
      });
  }

  blob(reponame, oid, handler) {
    return this.open(reponame)
      .then(repo => {
        return repo.getBlob(oid)
          .then(this.disposable)
          .then(blob => [blob, repo]);
      });
  }

  entry(reponame, refname, path, handler) {
    return this.commit(reponame, refname)
      .then(function(...args) {
        const [commit, ref, repo] = Array.from(args[0]);
        if (commit == null) {
          return [null, null, null, null];
        }
        return commit.getEntry(path)
          .then(this.disposable)
          .then(entry => [entry, commit, ref, repo]);
      }.bind(this));
  }

  commit(reponame, refname, handler) {
    return this.ref(reponame, refname)
      .then((...args) => {
        const [ref, repo] = Array.from(args[0]);
        if (repo == null) {
          return [null, null, null];
        }
        return repo.getCommit(ref.target())
          .then(this.disposable)
          .then(commit => [commit, ref, repo]);
      });
  }
}
RepoManager.initClass();