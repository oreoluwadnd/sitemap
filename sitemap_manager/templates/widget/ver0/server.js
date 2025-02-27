const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 }, () => {
    console.log('WebSocket server запущен на ws://127.0.0.1:8080');
});

wss.on('connection', (ws) => {
    console.log('Новое подключение');

    ws.on('message', (message) => {
        console.log('Получено сообщение:', message);
        // Эхо-ответ
        ws.send(`Эхо: ${message}`);
    });

    ws.on('close', () => {
        console.log('Подключение закрыто');
    });
});