const net = require('net');
const dns = require('dns');

// Configure DNS to use Google
dns.setServers(['8.8.8.8', '8.8.4.4']);

const LOCAL_PORT = 5433; // Use 5433 to avoid conflict
const REMOTE_HOST = 'ep-rough-water-a1f60bcx.ap-southeast-1.aws.neon.tech';
const REMOTE_PORT = 5432;

console.log(`Starting Database Proxy on 127.0.0.1:${LOCAL_PORT} -> ${REMOTE_HOST}:${REMOTE_PORT}`);

const server = net.createServer((socket) => {
    console.log('New connection from client');

    const remoteSocket = net.connect(REMOTE_PORT, REMOTE_HOST, () => {
        console.log('Connected to remote database');
        socket.pipe(remoteSocket);
        remoteSocket.pipe(socket);
    });

    remoteSocket.on('error', (err) => {
        console.error('Remote Socket Error:', err.message);
        socket.destroy();
    });

    socket.on('error', (err) => {
        console.error('Client Socket Error:', err.message);
        remoteSocket.destroy();
    });

    socket.on('close', () => remoteSocket.destroy());
    remoteSocket.on('close', () => socket.destroy());
});

server.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`Proxy is listening on 127.0.0.1:${LOCAL_PORT}`);
});
