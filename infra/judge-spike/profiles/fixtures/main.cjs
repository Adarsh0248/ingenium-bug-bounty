'use strict';
const fs = require('node:fs');
if ([process.getuid(), process.geteuid(), process.getgid(), process.getegid()]
    .some(value => value !== 60000)) process.exit(3);
const [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
setTimeout(() => process.stdout.write(String(a + b) + '\n'), 100);
