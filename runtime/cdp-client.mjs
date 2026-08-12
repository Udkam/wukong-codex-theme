import http from 'node:http';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

// Historical vendored clients remain in the repository for audit evidence, but the
// portable runtime neither imports nor packages them.
const VendoredWebSocket = globalThis.__WUKONG_BUNDLED_WEBSOCKET__;

const assertPort = port => {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Port must be 1024..65535');
};

export const requestJson = (port, requestPath) => new Promise((resolve, reject) => {
  assertPort(port);
  const request = http.get({ host: '127.0.0.1', port, path: requestPath, timeout: 2400 }, response => {
    let data = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { data += chunk; });
    response.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (error) { reject(Error(`Invalid CDP JSON from ${requestPath}: ${error.message}`)); }
    });
  });
  request.on('error', reject);
  request.on('timeout', () => request.destroy(Error('CDP timeout')));
});

export async function getBrowserVersion(port) {
  const version = await requestJson(port, '/json/version');
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(version.webSocketDebuggerUrl || '')) {
    throw Error('Refusing non-loopback CDP endpoint');
  }
  return version;
}

export const getTargets = port => requestJson(port, '/json/list');

export const isCodexAvatarOverlayTarget = target => {
  try {
    return new URL(target?.url || '').searchParams.get('initialRoute') === '/avatar-overlay';
  } catch {
    return false;
  }
};

export const isCodexTarget = (target, options = {}) => {
  const allowLocalDevelopment = options.allowLocalDevelopment ?? process.env.WUKONG_ALLOW_LOCAL_CDP === '1';
  return target?.type === 'page' && !isCodexAvatarOverlayTarget(target) && (
    /^app:\/\/codex\//.test(target.url || '') ||
    (target.title === 'Codex' && /^app:\/\/-\/index\.html(?:[?#]|$)/.test(target.url || '')) ||
    (allowLocalDevelopment && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(target.url || ''))
  );
};

export const commandTimeoutMs = (method, params = {}) => (
  method === 'Runtime.evaluate' && typeof params.expression === 'string' && params.expression.length > 1_000_000
    ? 45000
    : method === 'Page.captureScreenshot'
      ? 20000
      : 12000
);

const clientFrame = (value, opcode = 0x1, fin = true, compressed = false) => {
  const payload = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  const mask = crypto.randomBytes(4);
  const sizeBytes = payload.length < 126 ? 0 : payload.length <= 0xffff ? 2 : 8;
  const header = Buffer.alloc(2 + sizeBytes + 4);
  header[0] = (fin ? 0x80 : 0) | (compressed ? 0x40 : 0) | opcode;
  if (sizeBytes === 0) header[1] = 0x80 | payload.length;
  else if (sizeBytes === 2) {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const maskOffset = 2 + sizeBytes;
  mask.copy(header, maskOffset);
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
  return Buffer.concat([header, masked]);
};

const clientMessage = (value, compressionAccepted) => {
  const payload = Buffer.from(String(value), 'utf8');
  if (!compressionAccepted || payload.length < 512) return clientFrame(payload);
  const compressed = zlib.deflateRawSync(payload, {
    flush: zlib.constants.Z_SYNC_FLUSH,
    finishFlush: zlib.constants.Z_SYNC_FLUSH
  });
  const wirePayload = compressed.subarray(0, Math.max(0, compressed.length - 4));
  return clientFrame(wirePayload, 0x1, true, true);
};

const rawCommandTarget = (target, method, params = {}) => new Promise((resolve, reject) => {
  const debug = message => { if (process.env.WUKONG_CDP_DEBUG === '1') process.stderr.write(`[forge-cdp] ${message}\n`); };
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(target?.webSocketDebuggerUrl || '')) {
    reject(Error('Refusing non-loopback target WebSocket'));
    return;
  }
  const endpoint = new URL(target.webSocketDebuggerUrl);
  const port = Number(endpoint.port);
  assertPort(port);
  const key = crypto.randomBytes(16).toString('base64');
  const expectedAccept = crypto.createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  let socket = null;
  let upgradeRequest = null;
  let incoming = Buffer.alloc(0);
  let fragmentedOpcode = null;
  let fragmentedCompressed = false;
  let fragments = [];
  let settled = false;
  const timeout = setTimeout(() => {
    finish(Error('CDP command timeout'));
  }, commandTimeoutMs(method, params));
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    try { socket?.destroy(); } catch { }
    try { upgradeRequest?.destroy(); } catch { }
    if (error) reject(error);
    else resolve(value);
  };
  const handleMessage = raw => {
    let message;
    try { message = JSON.parse(raw.toString('utf8')); }
    catch (error) { finish(error); return; }
    if (message.id !== 1) return;
    if (message.error) finish(Error(message.error.message || 'CDP command failed'));
    else finish(null, message.result);
  };
  const decodeMessage = (payload, compressed) => compressed
    ? zlib.inflateRawSync(Buffer.concat([payload, Buffer.from([0x00, 0x00, 0xff, 0xff])]), {
        finishFlush: zlib.constants.Z_SYNC_FLUSH
      })
    : payload;
  const consumeFrames = chunk => {
    debug(`receive chunk=${chunk.length} head=${Buffer.from(chunk).subarray(0, Math.min(12, chunk.length)).toString('hex')}`);
    incoming = Buffer.concat([incoming, chunk]);
    try {
      while (incoming.length >= 2) {
        const first = incoming[0];
        const second = incoming[1];
        const fin = Boolean(first & 0x80);
        const compressed = Boolean(first & 0x40);
        const opcode = first & 0x0f;
        const masked = Boolean(second & 0x80);
        let length = second & 0x7f;
        let offset = 2;
        if (length === 126) {
          if (incoming.length < 4) return;
          length = incoming.readUInt16BE(2);
          offset = 4;
        } else if (length === 127) {
          if (incoming.length < 10) return;
          const largeLength = incoming.readBigUInt64BE(2);
          if (largeLength > 16n * 1024n * 1024n) throw Error('CDP WebSocket frame exceeds the 16 MiB limit');
          length = Number(largeLength);
          offset = 10;
        }
        const maskLength = masked ? 4 : 0;
        if (incoming.length < offset + maskLength + length) return;
        const mask = masked ? incoming.subarray(offset, offset + 4) : null;
        offset += maskLength;
        const payload = Buffer.from(incoming.subarray(offset, offset + length));
        incoming = incoming.subarray(offset + length);
        if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
        if (opcode === 0x8) { finish(Error('CDP WebSocket closed before the command completed')); return; }
        if (opcode === 0x9) { socket.write(clientFrame(payload, 0xA)); continue; }
        if (opcode === 0xA) continue;
        if (opcode === 0x1 || opcode === 0x2) {
          if (fin) handleMessage(decodeMessage(payload, compressed));
          else { fragmentedOpcode = opcode; fragmentedCompressed = compressed; fragments = [payload]; }
        } else if (opcode === 0x0 && fragmentedOpcode != null) {
          fragments.push(payload);
          if (fin) {
            handleMessage(decodeMessage(Buffer.concat(fragments), fragmentedCompressed));
            fragmentedOpcode = null;
            fragmentedCompressed = false;
            fragments = [];
          }
        }
        if (settled) return;
      }
    } catch (error) {
      finish(error);
    }
  };
  upgradeRequest = http.request({
    host: '127.0.0.1',
    port,
    path: `${endpoint.pathname}${endpoint.search}`,
    method: 'GET',
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': key,
      'Sec-WebSocket-Extensions': 'permessage-deflate; client_no_context_takeover; server_no_context_takeover; client_max_window_bits'
    }
  });
  upgradeRequest.on('upgrade', (response, upgradedSocket, head) => {
    debug(`upgrade ${response.statusCode} ${endpoint.pathname} ext=${response.headers['sec-websocket-extensions'] || 'none'} head=${head?.length || 0}`);
    if (response.headers['sec-websocket-accept'] !== expectedAccept) {
      upgradedSocket.destroy();
      finish(Error('CDP WebSocket handshake validation failed'));
      return;
    }
    socket = upgradedSocket;
    const compressionAccepted = /(?:^|,)\s*permessage-deflate(?:\s*;|\s*$)/i.test(response.headers['sec-websocket-extensions'] || '');
    socket.setNoDelay(true);
    socket.on('data', consumeFrames);
    socket.on('error', error => finish(error));
    socket.on('close', () => {
      if (!settled) finish(Error('CDP WebSocket closed before the command completed'));
    });
    socket.resume();
    if (head?.length) consumeFrames(head);
    const outgoing = clientMessage(JSON.stringify({ id: 1, method, params }), compressionAccepted);
    debug(`send ${method} frame=${outgoing.subarray(0, Math.min(16, outgoing.length)).toString('hex')} bytes=${outgoing.length}`);
    const lengthCode = outgoing[1] & 0x7f;
    const headerLength = 2 + (lengthCode === 126 ? 2 : lengthCode === 127 ? 8 : 0) + 4;
    socket.cork();
    socket.write(outgoing.subarray(0, headerLength));
    socket.write(outgoing.subarray(headerLength));
    socket.uncork();
  });
  upgradeRequest.on('response', response => {
    debug(`response ${response.statusCode}`);
    finish(Error(`CDP WebSocket upgrade failed with HTTP ${response.statusCode}`));
  });
  upgradeRequest.on('error', error => { debug(`request error ${error.message}`); finish(error); });
  upgradeRequest.end();
});

// This built-in implementation is retained as a diagnostic fallback. Node's WHATWG
// WebSocket does not expose Chromium's per-message compression controls, so large theme
// payloads use the dependency-free raw client above.
const builtInCommandTarget = (target, method, params = {}) => new Promise((resolve, reject) => {
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(target?.webSocketDebuggerUrl || '')) {
    reject(Error('Refusing non-loopback target WebSocket'));
    return;
  }

  let settled = false;
  let socket;
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    try { socket?.close(); } catch { }
    if (error) reject(error);
    else resolve(value);
  };
  const timeout = setTimeout(() => {
    try { socket?.close(); } catch { }
    finish(Error('CDP command timeout'));
  }, commandTimeoutMs(method, params));

  try {
    if (typeof globalThis.WebSocket !== 'function') {
      throw Error('Codex embedded Node does not provide WebSocket');
    }
    socket = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  } catch (error) {
    finish(error);
    return;
  }

  socket.addEventListener('open', () => {
    try { socket.send(JSON.stringify({ id: 1, method, params })); }
    catch (error) { finish(error); }
  }, { once: true });
  socket.addEventListener('message', async event => {
    let message;
    try {
      const raw = event.data instanceof Blob
        ? await event.data.text()
        : event.data instanceof ArrayBuffer
          ? Buffer.from(event.data).toString('utf8')
          : String(event.data);
      message = JSON.parse(raw);
    }
    catch (error) { finish(error); return; }
    if (message.id !== 1) return;
    if (message.error) finish(Error(message.error.message || 'CDP command failed'));
    else finish(null, message.result);
  });
  socket.addEventListener('error', () => finish(Error('CDP WebSocket error')), { once: true });
  socket.addEventListener('close', () => {
    if (!settled) finish(Error('CDP WebSocket closed before the command completed'));
  }, { once: true });
});

// Production transport: a single-file vendored ws build with its MIT license retained.
// The raw and WHATWG implementations above remain available as diagnostic history.
const bundledCommandTarget = (target, method, params = {}) => new Promise((resolve, reject) => {
  const debug = message => { if (process.env.WUKONG_CDP_DEBUG === '1') process.stderr.write(`[forge-ws] ${message}\n`); };
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(target?.webSocketDebuggerUrl || '')) {
    reject(Error('Refusing non-loopback target WebSocket'));
    return;
  }
  if (typeof VendoredWebSocket !== 'function') {
    reject(Error('Optional bundled WebSocket diagnostic is not loaded'));
    return;
  }
  if (typeof VendoredWebSocket !== 'function') {
    reject(Error('Optional bundled WebSocket diagnostic is not loaded'));
    return;
  }
  const socket = new VendoredWebSocket(target.webSocketDebuggerUrl, {
    perMessageDeflate: {
      clientNoContextTakeover: true,
      serverNoContextTakeover: true
    },
    maxPayload: 16 * 1024 * 1024
  });
  let settled = false;
  const timeout = setTimeout(() => {
    try { socket.terminate(); } catch { }
    finish(Error('CDP command timeout'));
  }, commandTimeoutMs(method, params));
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    try { socket.close(); } catch { }
    if (error) {
      debug(`finish error=${error.message}`);
      reject(error);
    }
    else resolve(value);
  };
  socket.once('open', () => {
    debug(`open method=${method}`);
    socket.send(JSON.stringify({ id: 1, method, params }), error => {
      if (error) finish(error);
      else debug(`sent method=${method}`);
    });
  });
  socket.on('message', raw => {
    debug(`message bytes=${raw.length ?? raw.byteLength ?? 0}`);
    let message;
    try { message = JSON.parse(raw.toString('utf8')); }
    catch (error) { finish(error); return; }
    if (message.id !== 1) return;
    if (message.error) finish(Error(message.error.message || 'CDP command failed'));
    else finish(null, message.result);
  });
  socket.once('error', error => finish(error));
  socket.once('unexpected-response', (_request, response) => finish(Error(`CDP WebSocket returned HTTP ${response.statusCode}`)));
  socket.once('close', () => {
    if (!settled) finish(Error('CDP WebSocket closed before the command completed'));
  });
});

const browserSessionCommandTarget = async (target, method, params = {}) => {
  const debug = message => { if (process.env.WUKONG_CDP_DEBUG === '1') process.stderr.write(`[forge-session] ${message}\n`); };
  if (!target?.id || !/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(target.webSocketDebuggerUrl || '')) {
    throw Error('Refusing invalid or non-loopback target WebSocket');
  }
  const targetEndpoint = new URL(target.webSocketDebuggerUrl);
  const port = Number(targetEndpoint.port);
  assertPort(port);
  const version = await requestJson(port, '/json/version');
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\/devtools\/browser\//.test(version.webSocketDebuggerUrl || '')) {
    throw Error('Refusing non-loopback browser CDP endpoint');
  }

  return new Promise((resolve, reject) => {
    const socket = new VendoredWebSocket(version.webSocketDebuggerUrl, {
      perMessageDeflate: {
        clientNoContextTakeover: true,
        serverNoContextTakeover: true
      },
      maxPayload: 16 * 1024 * 1024
    });
    let settled = false;
    let sessionId = null;
    const timeout = setTimeout(() => finish(Error('CDP command timeout')), commandTimeoutMs(method, params));
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (sessionId && socket.readyState === VendoredWebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ id: 3, method: 'Target.detachFromTarget', params: { sessionId } }));
        } catch { }
      }
      try { socket.close(); } catch { }
      if (error) {
        debug(`finish error=${error.message}`);
        reject(error);
      } else {
        resolve(value);
      }
    };
    socket.once('open', () => {
      debug(`attach target=${target.id}`);
      socket.send(JSON.stringify({
        id: 1,
        method: 'Target.attachToTarget',
        params: { targetId: target.id, flatten: true }
      }), error => { if (error) finish(error); });
    });
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString('utf8')); }
      catch (error) { finish(error); return; }
      debug(`message id=${message.id ?? '-'} session=${message.sessionId ?? '-'} method=${message.method ?? '-'}`);
      if (message.id === 1) {
        if (message.error) { finish(Error(message.error.message || 'CDP target attach failed')); return; }
        sessionId = message.result?.sessionId;
        if (!sessionId) { finish(Error('CDP target attach returned no session')); return; }
        debug(`attached session=${sessionId} method=${method}`);
        socket.send(JSON.stringify({ id: 2, sessionId, method, params }), error => {
          if (error) finish(error);
        });
        return;
      }
      if (message.id !== 2 || message.sessionId !== sessionId) return;
      if (message.error) finish(Error(message.error.message || 'CDP command failed'));
      else finish(null, message.result);
    });
    socket.once('error', error => finish(error));
    socket.once('unexpected-response', (_request, response) => finish(Error(`CDP WebSocket returned HTTP ${response.statusCode}`)));
    socket.once('close', () => {
      if (!settled) finish(Error('CDP browser session closed before the command completed'));
    });
  });
};

const browserTunnelCommandTarget = async (target, method, params = {}) => {
  const debug = message => { if (process.env.WUKONG_CDP_DEBUG === '1') process.stderr.write(`[forge-tunnel] ${message}\n`); };
  if (!target?.id || !/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(target.webSocketDebuggerUrl || '')) {
    throw Error('Refusing invalid or non-loopback target WebSocket');
  }
  const targetEndpoint = new URL(target.webSocketDebuggerUrl);
  const port = Number(targetEndpoint.port);
  assertPort(port);
  const version = await requestJson(port, '/json/version');
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\/devtools\/browser\//.test(version.webSocketDebuggerUrl || '')) {
    throw Error('Refusing non-loopback browser CDP endpoint');
  }

  return new Promise((resolve, reject) => {
    if (typeof VendoredWebSocket !== 'function') {
      reject(Error('Optional bundled WebSocket diagnostic is not loaded'));
      return;
    }
    const socket = new VendoredWebSocket(version.webSocketDebuggerUrl, {
      perMessageDeflate: {
        clientNoContextTakeover: true,
        serverNoContextTakeover: true
      },
      maxPayload: 16 * 1024 * 1024
    });
    let settled = false;
    let sessionId = null;
    const timeout = setTimeout(() => finish(Error('CDP command timeout')), commandTimeoutMs(method, params));
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (sessionId && socket.readyState === VendoredWebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ id: 3, method: 'Target.detachFromTarget', params: { sessionId } }));
        } catch { }
      }
      try { socket.close(); } catch { }
      if (error) reject(error);
      else resolve(value);
    };
    socket.once('open', () => {
      debug(`attach target=${target.id}`);
      socket.send(JSON.stringify({
        id: 1,
        method: 'Target.attachToTarget',
        params: { targetId: target.id, flatten: false }
      }), error => { if (error) finish(error); });
    });
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString('utf8')); }
      catch (error) { finish(error); return; }
      debug(`message id=${message.id ?? '-'} method=${message.method ?? '-'}`);
      if (message.id === 1) {
        if (message.error) { finish(Error(message.error.message || 'CDP target attach failed')); return; }
        sessionId = message.result?.sessionId;
        if (!sessionId) { finish(Error('CDP target attach returned no session')); return; }
        const innerMessage = JSON.stringify({ id: 1, method, params });
        socket.send(JSON.stringify({
          id: 2,
          method: 'Target.sendMessageToTarget',
          params: { sessionId, message: innerMessage }
        }), error => { if (error) finish(error); });
        return;
      }
      if (message.id === 2 && message.error) {
        finish(Error(message.error.message || 'CDP target message failed'));
        return;
      }
      if (message.method !== 'Target.receivedMessageFromTarget' || message.params?.sessionId !== sessionId) return;
      let inner;
      try { inner = JSON.parse(message.params.message); }
      catch (error) { finish(error); return; }
      if (inner.id !== 1) return;
      if (inner.error) finish(Error(inner.error.message || 'CDP command failed'));
      else finish(null, inner.result);
    });
    socket.once('error', error => finish(error));
    socket.once('unexpected-response', (_request, response) => finish(Error(`CDP WebSocket returned HTTP ${response.statusCode}`)));
    socket.once('close', () => {
      if (!settled) finish(Error('CDP browser tunnel closed before the command completed'));
    });
  });
};

export const commandTarget = rawCommandTarget;

export async function evaluateTarget(target, expression, { awaitPromise = true } = {}) {
  const response = await commandTarget(target, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise
  });
  if (response?.exceptionDetails) throw Error(response.exceptionDetails.text || 'Renderer expression failed');
  return response?.result?.value;
}
