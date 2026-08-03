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
2. 在回答的最末尾，另起一行，附上 3 個適合繼續追問的簡短問題，格式為：
[建議問題]
1. 問題一
2. 問題二
3. 問題三

【教材內容】:
${docContext || "無提供教材"}`;

    // 使用目前 OpenRouter 上穩定且免費的頂級模型 Meta Llama 3.3 70B
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
      return res.status(response.status).json({ 
        error: data.error?.message || "OpenRouter API 呼叫失敗" 
      });
    }

    const reply = data.choices?.[0]?.message?.content || "AI 暫時無法產生回應，請重試。";
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Vercel API Error:", error);
    return res.status(500).json({ error: error.message || "伺服器內部發生錯誤" });
  }
}
