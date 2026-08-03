export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, docContext } = req.body;
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

  // 💡 備援模型清單：若第一個模型呼叫失敗，自動嘗試下一個！
  const candidateModels = [
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free"
  ];

  let lastError = null;

  for (const model of candidateModels) {
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
          temperature: 0.5,
          max_tokens: 400
        })
      });

      const data = await response.json();

      if (response.ok && data.choices?.[0]?.message?.content) {
        // 成功取得回應，直接回傳
        return res.status(200).json({ reply: data.choices[0].message.content });
      }

      // 如果當前模型回傳錯誤，記錄錯誤並嘗試下一個模型
      lastError = data.error?.message || `模型 ${model} 呼叫失敗`;
      console.warn(`[Model Fallback] ${model} 失敗:`, lastError);

    } catch (err) {
      lastError = err.message;
      console.warn(`[Model Fallback] 請求異常:`, err);
    }
  }

  // 若所有模型都嘗試失敗，才回傳錯誤訊息
  return res.status(500).json({ error: `所有免費模型皆無回應，最後錯誤：${lastError}` });
}
