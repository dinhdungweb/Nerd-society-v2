
const net = require('net');

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log(`✅ Port ${port} is OPEN on ${host}`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ Port ${port} is CLOSED (Timeout) on ${host}`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (err) => {
      console.log(`❌ Port ${port} is CLOSED (Error: ${err.message}) on ${host}`);
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

async function run() {
  const host = '14.248.150.254';
  const ports = [18240, 18244, 7900, 4370];
  for (const port of ports) {
    await checkPort(host, port);
  }
}

run();
