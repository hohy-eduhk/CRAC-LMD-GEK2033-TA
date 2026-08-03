export default async function handler(req, res) {
  // 強制以 JSON 回傳所有回應，避免前端遇到 Unexpected token '<'
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, docContext } = req.body || {};
    // 讀取 Vercel 的 GEMINI_API_KEY 環境變數
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY 環境變數' });
    }

    const safeMessages = Array.isArray(messages) ? messages : [];

    // 格式化對話歷史紀錄符合 Gemini 格式
    const formattedContents = safeMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));

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

    // 呼叫 Google 官方 Gemini 2.0 Flash REST API
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(googleApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: formattedContents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 400
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || "Google Gemini API 回傳錯誤" 
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 暫時無法產生回應，請重試。";
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Vercel Function Error:", error);
    return res.status(500).json({ error: error.message || "伺服器內部發生未知錯誤" });
  }
}
