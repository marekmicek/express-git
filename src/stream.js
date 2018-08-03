/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
  Transform
} = require("stream");

const ZERO_PKT_LINE = new Buffer("0000");
const PACK = new Buffer("PACK");

class GitUpdateRequest extends Transform {
  constructor() {
    super(...arguments);
    this.pos = 0;
    this.buffer = null;
    this.changes = [];
    this.capabilities = null;
  }

  _transform(chunk, encoding, callback) {
    if (this.pos < 0) {
      return callback(null, chunk);
    }
    const buffer = (this.buffer != null) ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (true) {
      const end = this.pos + 4;
      if (buffer.length < end) {
        this.buffer = buffer;
        break;
      }

      const head = buffer.slice(this.pos, end);
      if (head.equals(ZERO_PKT_LINE)) {
        this.emit("changes", this.changes, this.capabilities);
        this.push(buffer.slice(end));
        this.buffer = null;
        this.pos = -1;
        break;
      }

      const offset = parseInt(`${head}`, 16);
      if (offset > 0) {
        this.pos += offset;
        let line = buffer.toString("utf8", end, this.pos);
        if (this.capabilities == null) {
          [line, this.capabilities] = Array.from(line.split("\0"));
        }
        const [before, after, ref] = Array.from(line.split(" "));
        this.changes.push({
          before,
          after,
          ref
        });
      } else {
        this.emit("error", new Error("Invalid pkt line"));
        this.push(null);
        break;
      }
    }
    return callback();
  }
}

module.exports = {
  PACK,
  ZERO_PKT_LINE,
  GitUpdateRequest
};