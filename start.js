#!/usr/bin/env node

// Set FFmpeg path BEFORE requiring anything else
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');

// Add FFmpeg to PATH
const ffmpegDir = path.dirname(ffmpegStatic);
process.env.PATH = ffmpegDir + path.delimiter + process.env.PATH;

console.log('[BOT SETUP] FFmpeg path set:', ffmpegDir);
console.log('[BOT SETUP] PATH:', process.env.PATH.substring(0, 100));

// NOW require the bot manager
require('./bot-manager.js');
