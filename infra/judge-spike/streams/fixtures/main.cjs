'use strict';
const fs = require('node:fs');
if ([process.getuid(), process.geteuid(), process.getgid(), process.getegid()]
    .some(value => value !== 60000)) process.exit(3);
const mode = Number(fs.readFileSync(0, 'utf8').trim());
if (!Number.isInteger(mode) || mode < 0 || mode > 9) process.exit(2);
const pairs = [
  [Buffer.alloc(0), Buffer.alloc(0)], [Buffer.from('42\r\n'), Buffer.from('debug\n')],
  [Buffer.from([195, 169, 0, 240, 159, 154, 128, 10]), Buffer.alloc(0)],
  [Buffer.from([255, 254]), Buffer.from([255])],
  [Buffer.alloc(1048576, 'x'), Buffer.alloc(65536, 'd')],
  [Buffer.alloc(1048577, 'x'), Buffer.alloc(65537, 'd')],
  [Buffer.alloc(2097169, 'x'), Buffer.alloc(131089, 'd')],
  [Buffer.from('41\n'), Buffer.alloc(0)], [Buffer.from(' 42 \t\r\n\v\f'), Buffer.alloc(0)],
  [Buffer.from('1\u00a02\n'), Buffer.alloc(0)],
];
function write(fd, buffer) {
  for (let offset = 0; offset < buffer.length;) {
    const n = fs.writeSync(fd, buffer, offset, buffer.length - offset);
    if (n <= 0) process.exit(4);
    offset += n;
  }
}
setTimeout(() => { write(1, pairs[mode][0]); write(2, pairs[mode][1]); }, 100);
