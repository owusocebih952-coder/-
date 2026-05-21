const WebSocket = require('ws');
const { OpenAI } = require('openai'); 

const PORT = process.env.PORT || 8080; 
const wss = new WebSocket.Server({ port: PORT });

// 【修改点 1】：全面切换回 DeepSeek 核心接口
const aiClient = new OpenAI({
    baseURL: 'https://api.deepseek.com', // DeepSeek 官方 API 地址
    apiKey: process.env.AI_API_KEY 
});

console.log('=========================================');
console.log('🏫 智能教师端 WebSocket 服务器已升级并启动！');
console.log(`📡 正在监听 ${PORT} 端口，已接入 DeepSeek 深度诊断引擎...`);
console.log('=========================================\n');

wss.on('connection', function connection(ws) {
    ws.on('message', async function incoming(message) {
        const msgString = message.toString(); 

        try {
            const data = JSON.parse(msgString);
            
            if (data.action === 'request_ai_diagnosis') {
                console.log('🧠 收到深度诊断请求，正在让 DeepSeek 分析多维数据...');
                const classData = data.currentData;
                
                let total = 0;
                let studentDetails = "";

                // 【核心优化】：将多维打点数据全部“序列化”，提供给 AI 进行细粒度分析
                for (const [name, info] of Object.entries(classData)) {
                    total++;
                    studentDetails += `- ${name}: 进度[关卡${info.level + 1}], 累计错误[${info.errors}次], 本关初判[${info.currentFirstTry}], 动手验证[${info.currentSlider}]\n`;
                }

                if (total === 0) {
                    ws.send(JSON.stringify({ action: 'ai_diagnosis_result', content: "当前暂无学生接入，请等待学生上线。" }));
                    return;
                }

                // 【修改点 2】：极具深度的 Prompt 设计，针对性剖析学生行为特征
                const prompt = `
                你是一位极具经验的小学数学教研员，倡导“探究式学习”。当前有 ${total} 名学生正在使用平板探究“正方体展开图”。
                我们采集了每位学生的细粒度行为数据，包括进度、累计错误、本关的初步空间想象判断，以及【是否动手拖动了 3D 折叠滑块进行空间验证】。

                【全班实时行为快照】
                ${studentDetails}

                【诊断任务】
                请你根据上述数据，进行深度的学情诊断。绝不能直接给出题目答案，而是提供具有启发性的思维支架建议。
                请输出一份简明的实时诊断报告，包含：
                1. 整体画像：一句话概括全班的探究节奏与主要卡点。
                2. 精准干预（点出具体学生名字）：
                   - “盲目试错型”预警：找出【判断错误且未拖动滑块验证】的学生，提供引导他们使用工具验证的策略。
                   - “空间想象遇阻型”关怀：找出【使用了滑块验证但依旧判断错误或累计错误高】的学生，提供降级拆解的辅导话术。
                   - “探究学霸型”进阶：对进度快且准确率高的学生，提供后续总结规律（如1-4-1型）的进阶挑战建议。

                【输出规范】
                直接输出诊断文本，适当使用 emoji，排版美观。不要输出 markdown 的代码块符号。
                `;

                try {
                    // 【修改点 3】：调用 DeepSeek 强大的推理模型
                    const response = await aiClient.chat.completions.create({
                        model: "deepseek-chat", 
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.4
                    });

                    let advice = response.choices[0].message.content.trim();
                    // 将 AI 生成的换行符转化为 HTML 的 <br> 标签，完美适配大屏的排版
                    advice = advice.replace(/```html/g, '').replace(/```/g, '').replace(/\n/g, '<br>');

                    console.log('💡 DeepSeek 深度诊断生成完毕');

                    ws.send(JSON.stringify({
                        action: 'ai_diagnosis_result',
                        content: advice
                    }));

                } catch (apiError) {
                    console.error("❌ DeepSeek API 调用失败:", apiError);
                    ws.send(JSON.stringify({
                        action: 'ai_diagnosis_result',
                        content: "网络连接波动，建议教师按既定教案，优先巡视未进行动手验证的学生。"
                    }));
                }
                
                return; 
            }

            // ... (下方保留原有数据广播分发逻辑) ...
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