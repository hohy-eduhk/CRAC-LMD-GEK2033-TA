export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, docContext } = req.body || {};
    const API_KEY = process.env.OPENROUTER_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: '伺服器未設定 OPENROUTER_API_KEY 環境變數' });
    }

    const safeMessages = Array.isArray(messages) ? messages : [];

    const systemPrompt = `你是一名課程助教 (GEK2033-TA)。
請遵守以下規則：
1. 整合資料簡明回答，字數控制在 300 字內。
2. 在回答的最末尾，另起一行，嚴格附上 3 個適合繼續追問的簡短問題，格式必須如下：
[建議問題]
1. 問題一
2. 問題二
3. 問題三

【教材內容】:
${docContext || "無提供教材"}`;

    // 免費穩定模型備選陣列
    const freeModels = [
      "qwen/qwen-2.5-72b-instruct:free",
      "google/gemini-2.0-flash-lite-001",
      "mistralai/mistral-7b-instruct:free",
      "gryphe/mythomax-l2-13b:free"
    ];

    let lastErrorMessage = "";

    for (const model of freeModels) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vercel.com",
            "X-Title": "GEK2033 Course TA Bot"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              ...safeMessages
            ],
            temperature: 0.3,
            max_tokens: 500
          })
        });

        const data = await response.json();

        if (response.ok && data.choices?.[0]?.message?.content) {
          let rawReply = data.choices[0].message.content.trim();

          // 💡 安全防護：如果模型忘記輸出 [建議問題] 標籤，自動補上以防前端比對失敗
          if (!rawReply.includes('[建議問題]')) {
            rawReply += '\n\n[建議問題]\n1. 請說明更多細節\n2. 這項內容的應用是什麼？\n3. 有相關的範例嗎？';
          }

          return res.status(200).json({ reply: rawReply });
        }

        lastErrorMessage = data.error?.message || `Model ${model} failed`;
      } catch (err) {
        lastErrorMessage = err.message;
      }
    }

    return res.status(500).json({ error: `所有免費模型皆無法回應：${lastErrorMessage}` });

  } catch (error) {
    console.error("Vercel API Error:", error);
    return res.status(500).json({ error: error.message || "伺服器內部發生錯誤" });
  }
}
