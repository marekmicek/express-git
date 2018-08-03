/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _path = require("path");
const Promise = require("bluebird");
const g = require("nodegit");
const {
  assign
} = Object;


const {
  INIT_FLAG,
  INIT_MODE
} = g.Repository;
g.RepositoryInitOptions.fromObject = function(options) {
  const opt = assign({}, g.Repository.INIT_DEFAULTS, options);
  const result = new g.RepositoryInitOptions();
  result.flags = 0;
  if (!opt.reinit) {
    result.flags |= INIT_FLAG.NO_REINIT;
  }
  if (!opt.dotgit) {
    result.flags |= INIT_FLAG.NO_DOTGIT_DIR;
  }
  if (opt.description) {
    result.description = opt.description;
  }
  result.initialHead = opt.head ? `${opt.head}` : "master";
  if (opt.origin) {
    result.originUrl = `${opt.origin}`;
  }
  if (opt.workdir) {
    result.workdirPath = `${opt.workdir}`;
  }
  if (opt.relative_gitlink) {
    result.flags |= INIT_FLAG.RELATIVE_GITLINK;
  }
  if (opt.bare) {
    result.flags |= INIT_FLAG.BARE;
  }
  if (opt.template) {
    result.flags |= INIT_FLAG.EXTERNAL_TEMPLATE;
    result.templatePath = opt.template;
  }
  if (opt.mkdirp || opt.mkdir) {
    result.flags |= INIT_FLAG.MKDIR;
  }
  if (opt.mkdirp) {
    result.flags |= INIT_FLAG.MKPATH;
  }
  result.mode = 0;
  switch (opt.shared) {
    // nodegit.Repository.INIT_MODE values are wrong
    case "umask":
      result.mode = 0;
      break;
    case "group":
      result.mode = 0x2775;
      break;
    case "all":
      result.mode = 0x2777;
      break;
    default:
      result.mode |= `${result.mode}` | 0;
  }
  return result;
};

const OIDS = new Map();
OIDS.set(g.AnnotatedCommit, commit => commit.id());
OIDS.set(g.Blob, blob => blob.id());
OIDS.set(g.Commit, commit => commit.id());
OIDS.set(g.DiffFile, diff => diff.id());
OIDS.set(g.IndexEntry, entry => entry.id);
OIDS.set(g.Note, node => node.id());
OIDS.set(g.Object, o => o.id());
OIDS.set(g.OdbObject, o => o.id());
OIDS.set(g.Oid, o => o);
OIDS.set(g.RebaseOperation, op => op.id);
OIDS.set(g.Reference, ref => ref.target());
OIDS.set(g.Tag, tag => tag.id());
OIDS.set(g.Tree, tree => tree.id());
OIDS.set(g.TreeEntry, entry => entry.oid);

const ZEROID_STRING = (new Array(40)).join("0");
const ZEROID = (g.Oid.ZERO = g.Oid.fromString(ZEROID_STRING));

g.Oid.fromAnything = function(item) {
  if (OIDS.has(item.constructor)) {
    return OIDS.get(item.constructor)(item);
  } else {
    return g.Oid.fromString(`${item}` || ZEROID_STRING);
  }
};

g.Repository.INIT_DEFAULTS = Object.freeze({
  bare: true,
  reinit: true,
  template: null,
  mkdir: true,
  mkdirp: false,
  dotgit: true,
  head: null,
  workdir: null,
  origin: null,
  relative_gitlink: false
});

g.Repository.OPEN_DEFAULTS = Object.freeze({
  bare: false,
  search: true,
  crossfs: false
});
g.Repository._open = g.Repository.open;
g.Repository.open = function(path, options) {
  if (options == null) {
    options = {};
  }
  const ceilings = ([].concat((options.ceilings || ""))).join(_path.delimiter);
  options = assign({}, g.Repository.OPEN_DEFAULTS, options);
  let flags = 0;
  if (!options.search) {
    flags |= this.OPEN_FLAG.OPEN_NO_SEARCH;
  }
  if (options.bare) {
    flags |= this.OPEN_FLAG.OPEN_BARE;
  }
  if (options.crossfs) {
    flags |= this.OPEN_FLAG.OPEN_CROSS_FS;
  }

  return Promise.resolve(this.openExt(path, flags, ceilings));
};

g.Repository._init = g.Repository.init;
g.Repository.init = function(path, options) {
  if (options == null) {
    options = {};
  }
  return Promise.resolve(this.initExt(path, g.RepositoryInitOptions.fromObject(options)));
};

const asrev = (g.Revparse.toSpec = function(value) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return `HEAD@{${value | 0}}`;
    case "object":
      if (!value) {
        return "HEAD";
      } else if (value instanceof Date) {
        return `HEAD@{${value.toISOString()}}`;
      } else {
        const {
          id,
          rev,
          tag,
          ref,
          branch,
          date,
          path,
          offset,
          search,
          upstream,
          type
        } = value;
        let result = `${id || rev || tag || ref || branch || 'HEAD'}`;
        if (upstream && (`${branch}` === result)) {
          result = `${branch}@{upstream}`;
        }

        if (offset) {
          result = `${result}@{${offset | 0}}`;
        }

        if (date) {
          result = `${result}@{${date}}`;
        }

        if (path) {
          result = `${result}:${path.replace(/^\/+/, '')}`;
        } else if (search) {
          result = `${result}:/${search}`;
        } else if (type) {
          result = `${result}^{${type}}`;
        }

        return result;
      }
  }
});

g.Revparse._single = g.Revparse.single;
g.Revparse.single = function(repo, where) {
  return g.Revparse._single(repo, this.toSpec(where));
};

assign(g.Repository.prototype, {
  headRefName() {
    if (this.isEmpty()) {
      return this.head().catch(err => err.message.replace(/.*'([^']+)'.*/, '$1'));
    } else {
      return this.head().then(function(head) {
        const name = head.name();
        head.free();
        return name;
      });
    }
  },

  commit(options) {
    let {
      ref,
      tree
    } = options;
    if (ref instanceof g.Reference) {
      ref = ref.name();
    } else if (ref) {
      ref = `${ref}`;
    } else {
      ref = null;
    }

    if (!(tree instanceof g.Tree)) {
      tree = g.Tree.lookup(this, g.Oid.fromString(`${tree}`));
    }

    let author = g.Signature.create(options.author);
    let committer = g.Signature.create(options.committer);

    const parents = Promise.resolve((options.parents || []).filter(a => a))
      .map(parent => {
        if (parent instanceof g.Commit) {
          return parent;
        } else {
          return this.getCommit(`${parent}`);
        }
      });

    const message = options.message || `Commit ${new Date()}`;

    return Promise.all([ref, tree, parents])
      .then((...args) => {
        let ref, tree, parents;
        [ref, tree, parents] = Array.from(args[0]);
        if (author == null) {
          author = this.defaultSignature();
        }
        if (committer == null) {
          committer = this.defaultSignature();
        }
        const parent_count = parents.length;
        return Promise.resolve(g.Commit.create(this, ref, author, committer, null, message, tree, parent_count, parents));
      }).then(oid => {
        return Promise.resolve(g.Commit.lookup(this, oid));
      });
  },

  find(where) {
    return g.Revparse.single(this, where);
  },

  createRef(name, target, options) {
    if (options == null) {
      options = {};
    }
    const oid = g.Oid.fromAnything(target);
    const force = options.force ? 1 : 0;
    const sig = options.signature || Signature.default(this);
    return Promise.resolve(g.Reference.create(this, name, oid, force, sig, message || ""));
  }
});


g.Blob.prototype.toJSON = function() {
  return {
    id: `${this.id()}`,
    size: `${this.rawsize()}`,
    binary: this.isBinary() ? true : false,
    filemode: `${this.filemode().toString(8)}`
  };
};

g.TreeEntry.prototype.toJSON = function() {
  return {
    id: this.oid(),
    path: this.path(),
    type: this.isBlob() ? "blob" : "tree",
    filename: this.filename(),
    attr: this.attr().toString(8)
  };
};

g.Tree.prototype.toJSON = function() {
  return {
    id: `${this.id()}`,
    type: "tree",
    path: typeof this.path === "string" ? this.path : undefined,
    entries: this.entries().map(entry =>
      ({
        id: `${entry.oid()}`,
        filename: `${entry.filename()}`,
        type: entry.isBlob() ? "blob" : "tree"
      })
    )
  };
};

const trim = function(value) {
  if (typeof value === "string") {
    return value.replace(/(^[<\s]+|[\s>]+$)/g, "");
  } else {
    return value;
  }
};

g.Time.parse = function(date) {
  let d = new Date(date);
  let time = d.getTime();
  if (!time) {
    d = new Date();
    time = d.getTime();
  }
  const offset = d.getTimezoneOffset();
  time = (time / 1000) | 0;
  return {
    time,
    offset
  };
};

g.Signature._create = g.Signature.create;
g.Signature.create = function(...args) {
  let email, name, offset, time;
  let date, signature;
  switch (args.length) {
    case 4:
      [name, email, time, offset] = Array.from(args);
      break;
    case 3:
      [name, email, date] = Array.from(args);
      ({
        time,
        offset
      } = g.Time.parse(date));
      break;
    case 2:
      [signature, date] = Array.from(args);
      ({
        time,
        offset
      } = g.Time.parse(date));
      if (typeof signature === "string") {
        ({
          name,
          email
        } = g.Signature.parse(signature));
      } else if (signature instanceof g.Signature) {
        name = signature.name();
        email = signature.email();
      } else if (typeof signature === "object") {
        ({
          name,
          email
        } = signature);
      }
      break;
    case 1:
      [signature] = Array.from(args);
      if (signature instanceof g.Signature) {
        return signature;
      } else if (typeof signature === "string") {
        ({
          name,
          email
        } = g.Signature.parse(signature));
        ({
          time,
          offset
        } = g.Time.parse(null));
      } else if (typeof signature === "object") {
        ({
          name,
          email,
          date
        } = signature);
        ({
          time,
          offset
        } = g.Time.parse(date));
      }
      break;
  }
  time = parseInt(time);
  offset = parseInt(offset);
  name = trim(name);
  email = trim(email);
  if (!name || !time || !offset) {
    throw new TypeError("Invalid signature arguments");
  }
  return g.Signature._create(name, email, time, offset);
};

g.Signature.parse = function(signature) {
  const m = `${signature}`.match(/^([^<]+)(?:<([^>]+)>)?$/);
  if (m == null) {
    throw new TypeError("Cannot parse signature");
  }
  const [name, email] = Array.from(m.slice(1));
  return {
    name,
    email
  };
};

g.Signature.fromString = function(signature, date) {
  let {
    name,
    email
  } = this.parse(signature);
  const {
    time,
    offset
  } = g.Time.parse(date);
  email = trim(email);
  name = trim(name);
  return this.create(name, email, time, offset);
};

g.Signature.prototype.getDate = function() {
  const d = new Date();
  d.setTime(this.when().time() * 1000);
  return d;
};

g.Signature.prototype.toJSON = function() {
  return {
    name: this.name(),
    email: this.email(),
    date: this.getDate()
  };
};

g.Commit.prototype.toJSON = function() {
  return {
    id: `${this.id()}`,
    type: "commit",
    tree: `${this.treeId()}`,
    parents: this.parents().map(p => `${p}`),
    date: this.date(),
    committer: this.committer().toJSON(),
    author: this.author().toJSON(),
    message: `${this.message()}`
  };
};

g.Reference.find = function(repo, refname) {
  if (refname == null) {
    refname = "HEAD";
  }
  const ref =
    this.isValidName(refname) ?
    this.lookup(repo, refname).catch(() => null) :
    this.dwim(repo, refname);
  return ref.then(r => {
    if (r != null ? r.isSymbolic() : undefined) {
      refname = r.symbolicTarget();
      return this.find(repo, refname)
        .catch(() => r);
    } else {
      return ref;
    }
  });
};

g.Tag.prototype.toJSON = function() {
  return {
    id: `${this.id()}`,
    name: `${this.name()}`,
    target: `${this.targetId()}`,
    message: `${this.message()}`,
    tagger: `${__guard__(this.tagger(), x => x.toJSON())}`,
    type: `${this.targetType()}`
  };
};

module.exports = g;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}