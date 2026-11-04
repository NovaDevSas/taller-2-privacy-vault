import { connect as connectSocket } from 'cloudflare:sockets';
import { EventEmitter } from 'node:events';

// The MongoDB driver expects a Node-style TLS stream. Pages provides TLS
// through Cloudflare sockets, so this adapter exposes the small stream surface
// the driver uses while keeping certificate validation in the runtime.
export function connect(options = {}) {
  const host = options.host;
  const port = Number(options.port || 27017);
  const socket = new EventEmitter();
  let connection;
  let writer;
  let reader;
  let destination;
  let timeoutId;
  let reading = false;
  let closed = false;

  socket.connecting = true;
  socket.destroyed = false;
  socket.remoteAddress = host;
  socket.remotePort = port;
  socket.encrypted = true;

  socket.setTimeout = (milliseconds) => {
    clearTimeout(timeoutId);
    if (milliseconds > 0) {
      timeoutId = setTimeout(() => socket.emit('timeout'), milliseconds);
    }
    return socket;
  };
  socket.disableRenegotiation = () => {};
  socket.pause = () => socket;
  socket.resume = () => socket;
  socket.write = (data) => {
    if (!writer || socket.destroyed) return false;
    writer.write(data instanceof Uint8Array ? data : new Uint8Array(data))
      .catch((error) => socket.emit('error', error));
    return true;
  };
  socket.end = (data, encoding, callback) => {
    if (data) socket.write(data);
    if (writer) {
      writer.close().catch(() => {}).finally(() => connection?.close().catch(() => {}));
    } else {
      connection?.close().catch(() => {});
    }
    if (typeof encoding === 'function') encoding();
    else if (typeof callback === 'function') callback();
    return socket;
  };
  socket.destroy = () => {
    if (socket.destroyed) return socket;
    socket.destroyed = true;
    clearTimeout(timeoutId);
    reader?.cancel().catch(() => {});
    writer?.abort().catch(() => {});
    connection?.close().catch(() => {});
    if (!closed) {
      closed = true;
      socket.emit('close');
    }
    return socket;
  };
  socket.pipe = (stream) => {
    destination = stream;
    if (reader && !reading) readFromSocket();
    return stream;
  };

  try {
    // Standard TLS validation is provided by the runtime for this hostname.
    connection = connectSocket({ hostname: host, port }, { secureTransport: 'on' });
    writer = connection.writable.getWriter();
    reader = connection.readable.getReader();
  } catch (error) {
    queueMicrotask(() => socket.emit('error', error));
    return socket;
  }

  connection.opened.then(() => {
    if (socket.destroyed) return;
    clearTimeout(timeoutId);
    socket.connecting = false;
    socket.emit('secureConnect');
    if (destination && !reading) readFromSocket();
  }).catch((error) => socket.emit('error', error));

  connection.closed.then(() => {
    socket.destroyed = true;
    if (!closed) {
      closed = true;
      destination?.end();
      socket.emit('end');
      socket.emit('close');
    }
  }).catch((error) => socket.emit('error', error));

  function readFromSocket() {
    if (!reader || !destination || reading || socket.destroyed) return;
    reading = true;
    (async () => {
      try {
        while (!socket.destroyed) {
          const {done, value} = await reader.read();
          if (done) break;
          if (value?.length && !destination.write(value)) {
            await new Promise((resolve) => destination.once('drain', resolve));
          }
        }
        destination.end();
      } catch (error) {
        socket.emit('error', error);
      } finally {
        reading = false;
      }
    })();
  }

  return socket;
}

export default {connect};
