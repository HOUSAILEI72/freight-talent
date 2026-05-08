#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

const rawPath = process.argv[2];
const logPath = process.argv[3];

if (!rawPath || !logPath) {
  console.error('Usage: stream_json_to_text.js <raw-jsonl-path> <human-log-path>');
  process.exit(1);
}

const raw = fs.createWriteStream(rawPath, { flags: 'a' });
const log = fs.createWriteStream(logPath, { flags: 'a' });

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function write(text) {
  process.stdout.write(text);
  log.write(text);
}

function line(text = '') {
  write(`${text}\n`);
}

function eventLine(text) {
  line(`\n[${stamp()}] ${text}`);
}

function preview(value, max = 240) {
  let text;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function textFromContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('');
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let sawTextDelta = false;
let toolJsonOpen = false;

rl.on('line', (input) => {
  raw.write(`${input}\n`);

  if (!input.trim()) return;

  let obj;
  try {
    obj = JSON.parse(input);
  } catch {
    eventLine(`RAW ${input}`);
    return;
  }

  if (obj.type === 'system') {
    const bits = ['system'];
    if (obj.subtype) bits.push(obj.subtype);
    if (obj.session_id) bits.push(`session=${obj.session_id}`);
    if (obj.cwd) bits.push(`cwd=${obj.cwd}`);
    eventLine(bits.join(' '));
    return;
  }

  if (obj.type === 'stream_event') {
    const event = obj.event || {};

    if (event.type === 'message_start') {
      eventLine('assistant message started');
      return;
    }

    if (event.type === 'content_block_start') {
      const block = event.content_block || {};
      if (block.type === 'tool_use') {
        eventLine(`tool_use start name=${block.name || 'unknown'} id=${block.id || 'unknown'}`);
        if (block.input) line(`tool_input: ${preview(block.input)}`);
      } else if (block.type && block.type !== 'text') {
        eventLine(`content_block start type=${block.type}`);
      }
      return;
    }

    if (event.type === 'content_block_delta') {
      const delta = event.delta || {};
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        sawTextDelta = true;
        write(delta.text);
        return;
      }
      if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
        if (!toolJsonOpen) {
          eventLine('tool_input delta');
          toolJsonOpen = true;
        }
        write(delta.partial_json);
        return;
      }
      if (delta.type === 'thinking_delta' || delta.type === 'signature_delta') {
        return;
      }
      if (delta.type) {
        eventLine(`delta type=${delta.type} ${preview(delta)}`);
      }
      return;
    }

    if (event.type === 'content_block_stop') {
      if (toolJsonOpen) {
        line('');
        toolJsonOpen = false;
      }
      return;
    }

    if (event.type === 'message_delta') {
      const usage = event.usage || {};
      if (Object.keys(usage).length) {
        eventLine(`usage ${preview(usage)}`);
      }
      return;
    }

    if (event.type === 'message_stop') {
      eventLine('assistant message stopped');
      return;
    }

    eventLine(`stream_event ${event.type || 'unknown'} ${preview(event)}`);
    return;
  }

  if (obj.type === 'assistant') {
    const text = textFromContent(obj.message?.content);
    if (text && !sawTextDelta) {
      eventLine('assistant text');
      line(text);
    }
    const content = obj.message?.content || [];
    for (const item of content) {
      if (item?.type === 'tool_use') {
        eventLine(`tool_use name=${item.name || 'unknown'} id=${item.id || 'unknown'} input=${preview(item.input)}`);
      }
    }
    return;
  }

  if (obj.type === 'user') {
    const content = obj.message?.content || [];
    for (const item of content) {
      if (item?.type === 'tool_result') {
        eventLine(`tool_result id=${item.tool_use_id || 'unknown'} ${item.is_error ? 'ERROR' : 'OK'} ${preview(item.content)}`);
      }
    }
    return;
  }

  if (obj.type === 'result') {
    eventLine(`result subtype=${obj.subtype || 'unknown'} error=${obj.is_error ? 'true' : 'false'} turns=${obj.num_turns ?? 'unknown'} cost=${obj.total_cost_usd ?? 'unknown'} duration_ms=${obj.duration_ms ?? 'unknown'}`);
    if (obj.is_error && obj.result) {
      line(`result error: ${obj.result}`);
    }
    return;
  }

  eventLine(`${obj.type || 'event'} ${preview(obj)}`);
});

rl.on('close', () => {
  raw.end();
  log.end();
});
