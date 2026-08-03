export default async function handler(req, res) {
  // 1. 僅允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, docContext } = req.body;

  // 2. 讀取與驗證 API Key
  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 OPENROUTER_API_KEY 環境變數' });
  }

  // 3. 安全防禦：確保 messages 是陣列
  const safeMessages = Array.isArray(messages) ? messages : [];

  // 4. 設定系統提示詞 (System Prompt)
  const systemPrompt = `你是一名課程助教 (GEK2033-TA)。
請遵守以下規則：
1. 整合資料簡明回答，字數控制在 300 字內。
2. 在回答的最末尾，另起一行，附上 3 個適合繼續追問的簡短問題，格式為：
[建議問題]
1. 問題一
2. 問題二
3. 問題三

【教材內容】:
${docContext || "無提供教材"}`;

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
       model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages
        ],
        temperature: 0.5,
        max_tokens: 400
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "OpenRouter API 呼叫失敗");
    }

    // 5. 安全解析 AI 回覆內容
    const reply = data.choices?.[0]?.message?.content || "AI 暫時無法產生回應，請重試。";
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("API Handling Error:", error);
    return res.status(500).json({ error: error.message || "伺服器內部錯誤" });
  }
}
