const WebSocket = require('ws');

// 获取云端平台动态分配的端口，如果在本地测试则回退到 8080
const PORT = process.env.PORT || 8080; 
const wss = new WebSocket.Server({ port: PORT });

console.log('=========================================');
console.log('🏫 教师端 WebSocket 服务器已升级并启动！');
console.log(`📡 正在监听 ${PORT} 端口，开启全局广播模式...`);
console.log('=========================================\n');
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        // 1. 将接收到的 Buffer 数据强制转换为字符串
        const msgString = message.toString(); 

        try {
            const data = JSON.parse(msgString);
            const studentName = data.studentName || '未知学生';
            
            // 2. 打印关键日志（跟之前一样）
            if(data.action === 'student_login') console.log(`[上线] 🟢 学生【${studentName}】已进入挑战！`);
            else if(data.action === 'level_complete') console.log(`[过关] 🏆 【${studentName}】完成了第 ${data.level} 关`);
            
            // 3. 【核心新增】：大喇叭广播！把收到的消息原封不动发给所有连接的网页（包括大屏）
            wss.clients.forEach(function each(client) {
                // 只要网页连着线，就发给它
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msgString);
                }
            });

        } catch (error) { 
            console.error('❌ 解析数据出错:', error); 
        }
    });
});