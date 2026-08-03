export default async function handler(req, res) {
  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, docContext } = req.body;
  // 從 Vercel 環境變數讀取 OpenRouter API Key
  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 OPENROUTER_API_KEY 環境變數' });
  }

  const systemPrompt = `你是一名課程助教 (GEK2033-TA)。
請遵守以下規則：
1. 整合資料簡明回答，字數控制在 300 字內。
2. 在回答的最末尾，另起一行，附上 3 個適合繼續追問的簡短問題，格式為：
[建議問題]
1. 問題一
2. 問題二
3. 問題三

【教材內容】:
${docContext}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.com", // OpenRouter 要求的標頭
        "X-Title": "GEK2033 Course TA Bot"
      },
      body: JSON.stringify({
        // 使用 OpenRouter 免費且極速的模型
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        temperature: 0.5,
        max_tokens: 400
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "API 呼叫失敗");
    }

    const reply = data.choices[0].message.content;
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message || "伺服器內部錯誤" });
  }
}
