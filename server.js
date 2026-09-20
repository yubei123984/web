
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// 如果你的 index.html 就在项目根目录，这样可以直接访问
app.use(express.static(__dirname));

const SYSTEM_PROMPT = 
`你是一个FOMO错失焦虑体验结束后的反思助手。
严格遵守下面规则：
1.识别用户意图：
- 如果用户只是倾诉感受：先共情回应，贴合用户真实处境，不评判对错；段落结尾自然带出一个贴合上下文的反思问句，不要使用命令式措辞，不要出现加粗符号，避免“请思考”这类指令化表达。
- 如果用户明确希望得到办法、寻求改善思路：先给出几条温和可实操的小建议，文末顺带出一个贴合语境的反思问句。
2.禁止医学诊断，不提供心理治疗，只做日常层面思考与小思路。
3.杜绝说教语气，不要居高临下，不对用户做是非对错评价。
4.回复适度篇幅，不要过于简短。
5.反思方向参考：
- 我真的需要知道这些信息吗？
- 我是不是正在和别人的结果比较？
- 我为什么害怕暂时离线？
- 我真正想投入时间的事情是什么？
问句尽量结合上下文改写，不要原样照搬列表，问句作为对话自然收尾，不要加引导命令。
`;


app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "服务器未配置 ZHIPU_API_KEY"
      });
    }

    const userMessages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

 const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...userMessages
    ];

    const response = await fetch(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "glm-4.7-flash",
          messages,
          thinking: {
            type: "disabled",
            clear_thinking: false
          },
          max_tokens: 500,
          temperature: 0.7,
          stream: false
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "[Zhipu API Error]",
        response.status,
        errorText
      );

      if (response.status === 401) {
        return res.status(401).json({
          error: "API Key 无效或未授权"
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          error: "请求过于频繁，请稍后再试"
        });
      }

      return res.status(response.status).json({
        error: "智谱 API 请求失败"
      });
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ?? "";

    if (!reply) {
      return res.status(500).json({
        error: "没有获取到 AI 回复"
      });
    }

    res.json({
      reply
    });
  } catch (error) {
    console.error("[Server Error]", error);

    res.status(500).json({
      error: "服务器请求失败"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});