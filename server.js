const WebSocket = require('ws');
const { OpenAI } = require('openai'); 

const PORT = process.env.PORT || 8080; 
const wss = new WebSocket.Server({ port: PORT });

// 【修改点1】：这里已经换成了智谱的 API 地址
const aiClient = new OpenAI({
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/', 
    apiKey: process.env.AI_API_KEY 
});

console.log('=========================================');
console.log('🏫 智能教师端 WebSocket 服务器已升级并启动！');
console.log(`📡 正在监听 ${PORT} 端口，接入智谱大模型...`);
console.log('=========================================\n');

wss.on('connection', function connection(ws) {
    ws.on('message', async function incoming(message) {
        const msgString = message.toString(); 

        try {
            const data = JSON.parse(msgString);
            
            if (data.action === 'request_ai_diagnosis') {
                console.log('🧠 收到大屏请求，正在调用智谱 GLM-4 生成学情诊断...');
                const classData = data.currentData;
                
                let total = 0;
                let struggling = [];
                let fast = [];

                for (const [name, info] of Object.entries(classData)) {
                    total++;
                    if (info.errors >= 3) struggling.push(name);
                    if (info.level >= 15) fast.push(name);
                }

                const prompt = `
                你是一位资深小学数学教研员。全班 ${total} 名学生正在使用平板探究正方体展开图。
                当前学情快照：
                - 空间折叠频繁试错（首误>=3次）学生：${struggling.length > 0 ? struggling.length + '人 (' + struggling.join(', ') + ')' : '无'}。
                - 进度极快（到达第15关以上）学生：${fast.length > 0 ? fast.length + '人' : '无'}。
                请结合上述数据，为正在使用大屏授课的教师提供一句（不超过40字）的实时课堂巡视与干预建议。
                要求：直接给出具体的操作建议，不需要分析过程。体现“玩中学”和“引导探究”的理念。
                `;

                try {
                    const response = await aiClient.chat.completions.create({
                        model: "glm-4", // 【修改点2】：这里换成了智谱的模型名称
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.3
                    });

                    const advice = response.choices[0].message.content.trim();
                    console.log('💡 智谱诊断生成完毕:', advice);

                    ws.send(JSON.stringify({
                        action: 'ai_diagnosis_result',
                        content: advice
                    }));

                } catch (apiError) {
                    console.error("❌ 智谱 API 调用失败:", apiError);
                    ws.send(JSON.stringify({
                        action: 'ai_diagnosis_result',
                        content: "网络连接波动，建议教师按既定教案巡视指导。"
                    }));
                }
                
                return; 
            }

            const studentName = data.studentName || '未知学生';
            
            if(data.action === 'student_login') console.log(`[上线] 🟢 学生【${studentName}】已进入挑战！`);
            else if(data.action === 'level_complete') console.log(`[过关] 🏆 【${studentName}】完成了第 ${data.level} 关`);
            
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msgString);
                }
            });

        } catch (error) { 
            console.error('❌ 解析数据出错:', error); 
        }
    });
});