const { WebSocketServer } = require("ws");

const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

function createWsServer(port) {
  const wss = new WebSocketServer({ port });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
    ws.on("close", () => clients.delete(ws));
  });
  console.log(`WS server running on ws://localhost:${port}`);
  return { wss, broadcast };
}

module.exports = { createWsServer, broadcast };
